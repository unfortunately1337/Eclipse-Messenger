import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { redis } from "./redis";
import { getAutoDeletedDirectChatIds } from "./privacy-settings";

type AccountSession = { userId: string; sessionId: string };
type Membership = { userId: string; chatId: string; chatType: "group" | "channel" };

/** Counts all dialogs, independent of pagination, without reading message contents. */
export async function getAccountUnreadCounts(accounts: AccountSession[]): Promise<Map<string, number>> {
  const unique = [...new Map(accounts.map(account => [account.userId, account])).values()];
  const counts = new Map(unique.map(account => [account.userId, 0]));
  if (!unique.length) return counts;
  const ids = Prisma.join(unique.map(account => account.userId));
  const [memberships, direct] = await Promise.all([
    prisma.$queryRaw<Membership[]>`
      SELECT "userId", "groupId" AS "chatId", 'group' AS "chatType" FROM "GroupMember" WHERE "userId" IN (${ids})
      UNION SELECT "userId", "channelId", 'channel' FROM "ChannelSubscriber" WHERE "userId" IN (${ids})
      UNION SELECT "ownerId", "id", 'channel' FROM "Channel" WHERE "ownerId" IN (${ids})
    `,
    prisma.$queryRaw<Array<{ userId: string; conversationId: string; updatedAt: Date; count: bigint }>>`
      SELECT cp."userId", c."id" AS "conversationId", c."updatedAt", COUNT(*)::bigint AS "count"
      FROM "ConversationParticipant" cp
      JOIN (VALUES ${Prisma.join(unique.map(account => Prisma.sql`(${account.userId}::text, ${account.sessionId}::text)`))})
        AS account("userId", "sessionId") ON account."userId" = cp."userId"
      JOIN "Conversation" c ON c."id" = cp."conversationId" AND c."type" IN ('direct', 'eclipse')
      JOIN "Message" m ON m."conversationId" = c."id" AND m."senderId" <> cp."userId"
      WHERE (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
        AND (c."type" <> 'direct' OR EXISTS (
          SELECT 1 FROM "ConversationParticipant" peer
          JOIN "User" u ON u."id" = peer."userId"
          WHERE peer."conversationId" = c."id" AND peer."userId" <> cp."userId"
            AND NOT (u."isBot" = true AND u."isSystemAccount" = true)
        ))
        AND (c."type" <> 'eclipse' OR (c."ownerUserId" = cp."userId" AND m."isSystemMessage" = true
          AND NOT (COALESCE(m."systemPayload"->>'eventType', '') = 'new_login'
            AND COALESCE(m."systemPayload"#>>'{metadata,sessionId}', '') = account."sessionId")))
        AND NOT EXISTS (SELECT 1 FROM "HiddenChatMessage" h WHERE h."userId" = cp."userId"
          AND h."messageId" = m."id" AND h."chatType" = CASE WHEN c."type" = 'eclipse' THEN 'eclipse' ELSE 'direct' END)
      GROUP BY cp."userId", c."id", c."updatedAt"
    `,
  ]);
  const add = (rows: Array<{ userId: string; count: bigint }>) => rows.forEach(row => {
    if (counts.has(row.userId)) counts.set(row.userId, (counts.get(row.userId) ?? 0) + Number(row.count));
  });
  // The chat list hides expired auto-delete dialogs; their old rows must not keep a badge alive.
  const visibleDirect = await Promise.all(unique.map(async account => {
    const rows = direct.filter(row => row.userId === account.userId);
    const deleted = await getAutoDeletedDirectChatIds(account.userId, rows.map(row => ({ id: row.conversationId, updatedAt: row.updatedAt })));
    return rows.filter(row => !deleted.has(row.conversationId));
  }));
  add(visibleDirect.flat());
  if (!memberships.length) return counts;
  const markers = await redis.mget(...memberships.map(m => `chat:read:${m.chatType}:${m.userId}:${m.chatId}`));
  const values = Prisma.join(memberships.map((member, index) => {
    const timestamp = Date.parse(markers[index] ?? "");
    const readAt = Number.isFinite(timestamp) ? new Date(timestamp) : null;
    return Prisma.sql`(${member.userId}::text, ${member.chatId}::text, ${member.chatType}::text, ${readAt}::timestamptz)`;
  }));
  const shared = await prisma.$queryRaw<Array<{ userId: string; count: bigint }>>`
    WITH markers("userId", "chatId", "chatType", "readAt") AS (VALUES ${values}), unread AS (
      SELECT marker."userId", COUNT(*)::bigint AS "count"
      FROM markers marker JOIN "GroupMessage" m ON marker."chatType" = 'group' AND m."groupId" = marker."chatId"
      WHERE m."senderId" <> marker."userId" AND (marker."readAt" IS NULL OR m."createdAt" > marker."readAt")
        AND NOT EXISTS (SELECT 1 FROM "HiddenChatMessage" h WHERE h."userId" = marker."userId" AND h."chatType" = 'group' AND h."messageId" = m."id")
      GROUP BY marker."userId"
      UNION ALL
      SELECT marker."userId", COUNT(*)::bigint AS "count"
      FROM markers marker JOIN "ChannelPost" m ON marker."chatType" = 'channel' AND m."channelId" = marker."chatId"
      WHERE m."authorId" <> marker."userId" AND (marker."readAt" IS NULL OR m."createdAt" > marker."readAt")
        AND NOT EXISTS (SELECT 1 FROM "HiddenChatMessage" h WHERE h."userId" = marker."userId" AND h."chatType" = 'channel' AND h."messageId" = m."id")
      GROUP BY marker."userId"
    ) SELECT "userId", SUM("count")::bigint AS "count" FROM unread GROUP BY "userId"
  `;
  add(shared);
  return counts;
}
