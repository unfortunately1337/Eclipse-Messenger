import { readBotContent } from "./bot-content";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { redis } from "@/lib/server/redis";
import {
  ECLIPSE_DIALOG_LINK,
  ECLIPSE_DIALOG_TITLE,
  findSavedDialog,
  getOrCreateEclipseDialog,
  SAVED_DIALOG_LINK,
  SAVED_DIALOG_TITLE,
} from "@/lib/server/chat";
import { ECLIPSE_LIST_STATUS, type EclipseSystemPayload } from "@/lib/eclipse-system";
import { getChannelReadMarkers, getGroupReadMarkers } from "@/lib/server/chat-read-state";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { getPrivacyDisplayName, getPrivacySettingsBatch, getAutoDeletedDirectChatIds } from "@/lib/server/privacy-settings";

export type DirectChat = {
  isBot?: boolean;
  chatType: "direct";
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  contactTag: string | null;
  contactTagVariant: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  lastMessageCipherText: string | null;
  lastMessageIv: string | null;
  lastMessageEncryptedKey: string | null;
  peerReadAt?: string | null;
  unreadCount?: number;
  isGroupOwner?: boolean;
  systemPayload?: Prisma.JsonValue;
  wallpaperUrl?: string | null;
  wallpaperPosY?: number | null;
};

export type EclipseChat = {
  chatType: "eclipse";
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  contactTag: null;
  contactTagVariant: "outline";
  avatarUrl: null;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: false;
  lastMessageCipherText: null;
  lastMessageIv: null;
  lastMessageEncryptedKey: null;
  peerReadAt?: null;
  unreadCount?: number;
  isGroupOwner?: false;
  isSystem: true;
  isVerified: true;
  statusText: string;
};

export type SavedChat = {
  chatType: "saved";
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  contactTag: null;
  contactTagVariant: "outline";
  avatarUrl: null;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  lastMessageCipherText: string | null;
  lastMessageIv: string | null;
  lastMessageEncryptedKey: string | null;
  peerReadAt?: null;
  unreadCount?: 0;
  isGroupOwner?: false;
};

export type GroupChatBase = {
  lastMessageIsService?: boolean;
  chatType: "group";
  canSendMessages: boolean;
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  avatarUrl: string | null;
  membersCount: string;
  contactTag: null;
  contactTagVariant: "outline";
  lastMessage: string;
  lastMessageText?: string;
  lastMessageSenderId: string | null;
  lastMessageSenderAlias: string | null;
  lastMessageAt: string;
  lastMessageMine: boolean;
  lastMessageCipherText: string | null;
  lastMessageIv: string | null;
  lastMessageKeyVersion: number | null;
  lastMessageEncryptedKey: null;
  unreadCount?: number;
  isGroupOwner: boolean;
};

export type ChannelChat = {
  lastMessageIsService?: boolean;
  chatType: "channel";
  canSendMessages: boolean;
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  avatarUrl: string | null;
  subscribersCount: string;
  contactTag: null;
  contactTagVariant: "outline";
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  lastMessageCipherText: string | null;
  lastMessageIv: string | null;
  lastMessageKeyVersion: number | null;
  lastMessageEncryptedKey: null;
  unreadCount?: number;
  isGroupOwner: false;
  ownerId?: string;
  isChannelOwner?: boolean;
};

export type ChatListPayload = {
  chats: Array<DirectChat | SavedChat | EclipseChat | GroupChatBase | ChannelChat>;
  hasMore: boolean;
  nextCursor: string | null;
};

const DIRECT_PREVIEW_MAX_CIPHERTEXT_CHARS = 12_000;
const DIRECT_PREVIEW_MAX_ENCRYPTED_KEY_CHARS = 8_000;
const CHAT_LIST_CACHE_INDEX_PREFIX = "chats:list:v3:index:";

function getChatListCacheIndexKey(userId: string) {
  return `${CHAT_LIST_CACHE_INDEX_PREFIX}${userId}`;
}

function buildUnreadMarkerValuesSql(markers: Map<string, Date | null>) {
  const entries = Array.from(markers.entries());
  if (entries.length === 0) return null;
  return Prisma.join(
    entries.map(
      ([chatId, readAt]) =>
        Prisma.sql`(CAST(${chatId} AS TEXT), CAST(${readAt} AS TIMESTAMPTZ))`,
    ),
    ", ",
  );
}

export async function invalidateChatListPayloadCache(userIds: string | string[]) {
  const normalized = Array.from(new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean)));
  if (normalized.length === 0) return;
  const indexes = normalized.map(getChatListCacheIndexKey);
  const entries = await Promise.all(indexes.map(index => redis.smembers(index).catch(() => [] as string[])));
  const keys = [...new Set([...indexes, ...entries.flat()])];
  const deletions: Promise<unknown>[] = [];
  for (let i = 0; i < keys.length; i += 1000) deletions.push(redis.del(...keys.slice(i, i + 1000)));
  await Promise.allSettled(deletions);
}

export async function getChatListPayload(userId: string, limit: number, cursor: string | null, sessionId?: string | null): Promise<ChatListPayload> {
  const cacheKey = `chats:list:v3:${userId}:${limit}:${cursor ?? "root"}:${sessionId ?? "null"}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ChatListPayload;
    }
  } catch {
    // cache is best-effort
  }

  const cursorTs = cursor ? Date.parse(cursor) : Number.NaN;
  const hasValidCursor = Number.isFinite(cursorTs);
  const perTypeLimit = Math.min(90, Math.max(24, Math.ceil(limit * 1.25)));
  const [savedConversationRef, eclipseConversationId] = await Promise.all([
    findSavedDialog(userId),
    getOrCreateEclipseDialog(userId),
  ]);

  const [savedConversation, eclipseConversation, conversations, groups, channels] = await Promise.all([
    savedConversationRef
      ? prisma.conversation.findUnique({
          where: { id: savedConversationRef.id },
          select: {
            id: true,
            updatedAt: true,
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                createdAt: true,
                senderId: true,
                cipherText: true,
                iv: true,
                encryptedKeyForSender: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.conversation.findUnique({
      where: { id: eclipseConversationId },
      select: {
        id: true,
        updatedAt: true,
        participants: {
          where: { userId },
          select: { lastReadAt: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          where: { isSystemMessage: true },
          select: {
            id: true,
            createdAt: true,
            systemPayload: true,
            botContentEnc: true,
          },
        },
      },
    }),
    prisma.conversation.findMany({
      where: {
        type: "direct",
        participants: {
          some: { userId },
        },
        messages: {
          some: {},
        },
      },
      orderBy: { updatedAt: "desc" },
      take: perTypeLimit,
      select: {
        id: true,
        updatedAt: true,
        participants: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                link: true,
                displayName: true,
                avatarUrl: true,
                isBot: true,
                isSystemAccount: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            senderId: true,
            cipherText: true,
            iv: true,
            encryptedKeyForSender: true,
            encryptedKeyForRecipient: true,
            isSystemMessage: true,
            systemPayload: true,
            botContentEnc: true,
          },
        },
      },
    }),
    prisma.$queryRaw<
      Array<{
        id: string;
        link: string;
        name: string;
        avatarUrl: string | null;
        ownerId: string;
        updatedAt: Date;
        lastMessageAt: Date | null;
        lastMessageText: string | null;
        lastMessageCipherText: string | null;
        lastMessageIv: string | null;
        lastMessageKeyVersion: number | null;
        lastMessageSenderId: string | null;
        membersCount: bigint | number;
        canSendMessages: boolean;
      }>
    >`
      SELECT
        g."id",
        g."link",
        g."name",
        g."avatarUrl",
        g."ownerId",
        g."updatedAt",
        (g."ownerId" = ${userId} OR my."canPostMessages") AS "canSendMessages",
        lm."createdAt" AS "lastMessageAt",
        lm."text" AS "lastMessageText",
        lm."cipherText" AS "lastMessageCipherText",
        lm."iv" AS "lastMessageIv",
        lm."keyVersion" AS "lastMessageKeyVersion",
        lm."senderId" AS "lastMessageSenderId",
        (
          SELECT COUNT(*)::bigint
          FROM "GroupMember" gm_count
          WHERE gm_count."groupId" = g."id"
        ) AS "membersCount"
      FROM "GroupMember" my
      JOIN "Group" g ON g."id" = my."groupId"
      LEFT JOIN LATERAL (
        SELECT gm."createdAt", gm."text", gm."cipherText", gm."iv", gm."keyVersion", gm."senderId"
        FROM "GroupMessage" gm
        WHERE gm."groupId" = g."id"
        ORDER BY gm."createdAt" DESC
        LIMIT 1
      ) lm ON TRUE
      WHERE my."userId" = ${userId}
      ORDER BY COALESCE(lm."createdAt", g."updatedAt") DESC
      LIMIT ${perTypeLimit}
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        link: string;
        name: string;
        avatarUrl: string | null;
        ownerId: string;
        updatedAt: Date;
        lastPostAt: Date | null;
        lastPostText: string | null;
        lastPostCipherText: string | null;
        lastPostIv: string | null;
        lastPostKeyVersion: number | null;
        subscribersCount: bigint | number;
        canSendMessages: boolean;
      }>
    >`
      SELECT
        c."id",
        c."link",
        c."name",
        c."avatarUrl",
        c."ownerId",
        c."updatedAt",
        (c."ownerId" = ${userId} OR (cs."role" = 'admin' AND cs."canPostMessages")) AS "canSendMessages",
        lp."createdAt" AS "lastPostAt",
        lp."text" AS "lastPostText",
        lp."cipherText" AS "lastPostCipherText",
        lp."iv" AS "lastPostIv",
        lp."keyVersion" AS "lastPostKeyVersion",
        (
          SELECT COUNT(*)::bigint
          FROM "ChannelSubscriber" cs_count
          WHERE cs_count."channelId" = c."id"
        ) AS "subscribersCount"
      FROM "ChannelSubscriber" cs
      JOIN "Channel" c ON c."id" = cs."channelId"
      LEFT JOIN LATERAL (
        SELECT cp."createdAt", cp."text", cp."cipherText", cp."iv", cp."keyVersion"
        FROM "ChannelPost" cp
        WHERE cp."channelId" = c."id"
        ORDER BY cp."createdAt" DESC
        LIMIT 1
      ) lp ON TRUE
      WHERE cs."userId" = ${userId}
      ORDER BY COALESCE(lp."createdAt", c."updatedAt") DESC
      LIMIT ${perTypeLimit}
    `,
  ]);

  const directConversationIds = conversations.map((conversation) => conversation.id);
  const participantReadRows =
    directConversationIds.length > 0
      ? await prisma.$queryRaw<Array<{ conversationId: string; userId: string; lastReadAt: Date | null; wallpaperUrl: string | null; wallpaperPosY: number | null }>>`
          SELECT cp."conversationId", cp."userId", cp."lastReadAt", cp."wallpaperUrl", cp."wallpaperPosY"
          FROM "ConversationParticipant" cp
          WHERE cp."conversationId" IN (${Prisma.join(directConversationIds)})
        `
      : [];
  const peerReadAtByConversationId = new Map<string, string | null>();
  const wallpaperByConversationId = new Map<string, { wallpaperUrl: string | null; wallpaperPosY: number | null }>();
  for (const row of participantReadRows) {
    if (row.userId !== userId) {
      peerReadAtByConversationId.set(row.conversationId, row.lastReadAt?.toISOString() ?? null);
    } else {
      wallpaperByConversationId.set(row.conversationId, {
        wallpaperUrl: row.wallpaperUrl ?? null,
        wallpaperPosY: row.wallpaperPosY ?? null,
      });
    }
  }
  const unreadDirectRows =
    directConversationIds.length > 0
      ? await prisma.$queryRaw<Array<{ conversationId: string; unreadCount: bigint | number }>>`
          SELECT
            m."conversationId",
            COUNT(*)::bigint AS "unreadCount"
          FROM "Message" m
          LEFT JOIN "ConversationParticipant" cp
            ON cp."conversationId" = m."conversationId"
           AND cp."userId" = ${userId}
          WHERE m."conversationId" IN (${Prisma.join(directConversationIds)})
            AND m."senderId" <> ${userId}
            AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
          GROUP BY m."conversationId"
        `
      : [];
  const unreadCountByConversationId = new Map(
    unreadDirectRows.map((row) => [row.conversationId, Math.max(0, Number(row.unreadCount) || 0)]),
  );
  const groupIds = groups.map((group) => group.id);
  const channelIds = channels.map((channel) => channel.id);
  const [groupReadMarkers, channelReadMarkers] = await Promise.all([
    getGroupReadMarkers(userId, groupIds),
    getChannelReadMarkers(userId, channelIds),
  ]);
  const groupMarkerValuesSql = buildUnreadMarkerValuesSql(groupReadMarkers);
  const channelMarkerValuesSql = buildUnreadMarkerValuesSql(channelReadMarkers);
  const unreadGroupRows =
    groupMarkerValuesSql
      ? await prisma.$queryRaw<Array<{ groupId: string; unreadCount: bigint | number }>>`
          SELECT
            gm."groupId",
            COUNT(*)::bigint AS "unreadCount"
          FROM "GroupMessage" gm
          JOIN (
            VALUES ${groupMarkerValuesSql}
          ) AS markers("groupId", "lastReadAt")
            ON markers."groupId" = gm."groupId"
          WHERE gm."senderId" <> ${userId}
            AND (markers."lastReadAt" IS NULL OR gm."createdAt" > markers."lastReadAt")
          GROUP BY gm."groupId"
        `
      : [];
  const unreadChannelRows =
    channelMarkerValuesSql
      ? await prisma.$queryRaw<Array<{ channelId: string; unreadCount: bigint | number }>>`
          SELECT
            cp."channelId",
            COUNT(*)::bigint AS "unreadCount"
          FROM "ChannelPost" cp
          JOIN (
            VALUES ${channelMarkerValuesSql}
          ) AS markers("channelId", "lastReadAt")
            ON markers."channelId" = cp."channelId"
          WHERE cp."authorId" <> ${userId}
            AND (markers."lastReadAt" IS NULL OR cp."createdAt" > markers."lastReadAt")
          GROUP BY cp."channelId"
        `
      : [];
  const unreadCountByGroupId = new Map(
    unreadGroupRows.map((row) => [row.groupId, Math.max(0, Number(row.unreadCount) || 0)]),
  );
  const unreadCountByChannelId = new Map(
    unreadChannelRows.map((row) => [row.channelId, Math.max(0, Number(row.unreadCount) || 0)]),
  );

  let eclipseChat: EclipseChat | null = null;
  try {
    const eclipseVisibleMessages = await prisma.$queryRaw<
      Array<{
        id: string;
        createdAt: Date;
        systemPayload: Prisma.JsonValue | null;
      }>
    >`
      SELECT m."id", m."createdAt", m."systemPayload"
      FROM "Message" m
      LEFT JOIN "HiddenChatMessage" h
        ON h."userId" = ${userId}
        AND h."chatType" = 'eclipse'
        AND h."messageId" = m."id"
      WHERE m."conversationId" = ${eclipseConversationId}
        AND m."isSystemMessage" = true
        AND h."id" IS NULL
      ORDER BY m."createdAt" DESC
      LIMIT 10
    `;
    const eclipseLastMessage = eclipseVisibleMessages.find((msg) => {
      const payload = msg.systemPayload as EclipseSystemPayload | null;
      if (payload?.eventType === "new_login" && payload?.metadata?.sessionId === sessionId) {
        return false;
      }
      return true;
    }) ?? null;
    const eclipseLastPayload = (eclipseLastMessage?.systemPayload ?? null) as EclipseSystemPayload | null;
    const eclipseReadAt = eclipseConversation?.participants[0]?.lastReadAt ?? null;

    const unreadEclipseMessages = await prisma.$queryRaw<
      Array<{
        id: string;
        systemPayload: Prisma.JsonValue | null;
      }>
    >`
      SELECT m."id", m."systemPayload"
      FROM "Message" m
      LEFT JOIN "HiddenChatMessage" h
        ON h."userId" = ${userId}
        AND h."chatType" = 'eclipse'
        AND h."messageId" = m."id"
      WHERE m."conversationId" = ${eclipseConversationId}
        AND m."isSystemMessage" = true
        AND m."senderId" <> ${userId}
        AND h."id" IS NULL
        ${eclipseReadAt ? Prisma.sql`AND m."createdAt" > ${eclipseReadAt}` : Prisma.empty}
    `;
    const eclipseUnreadCount = unreadEclipseMessages.filter((msg) => {
      const payload = msg.systemPayload as EclipseSystemPayload | null;
      if (payload?.eventType === "new_login" && payload?.metadata?.sessionId === sessionId) {
        return false;
      }
      return true;
    }).length;

    if (eclipseLastMessage) {
      eclipseChat = {
        chatType: "eclipse",
        conversationId: eclipseConversation?.id ?? eclipseConversationId,
        peerId: eclipseConversationId,
        link: ECLIPSE_DIALOG_LINK,
        displayName: ECLIPSE_DIALOG_TITLE,
        avatarUrl: null,
        contactTag: null,
        contactTagVariant: "outline",
        lastMessage: eclipseLastPayload?.title ?? "Служебные уведомления",
        lastMessageAt: eclipseLastMessage.createdAt.toISOString(),
        lastMessageMine: false,
        lastMessageCipherText: null,
        lastMessageIv: null,
        lastMessageEncryptedKey: null,
        unreadCount: eclipseUnreadCount,
        isGroupOwner: false,
        isSystem: true,
        isVerified: true,
        statusText: ECLIPSE_LIST_STATUS,
      };
    }
  } catch (err) {
    console.warn("Failed to load eclipse dialog payload:", err);
  }

  const savedChat: SavedChat = (() => {
        const lastMessage = savedConversation?.messages[0] ?? null;
        const includeEncryptedPreview = Boolean(
          lastMessage &&
            (lastMessage.cipherText?.length ?? 0) <= DIRECT_PREVIEW_MAX_CIPHERTEXT_CHARS &&
            (lastMessage.encryptedKeyForSender?.length ?? 0) <= DIRECT_PREVIEW_MAX_ENCRYPTED_KEY_CHARS,
        );
        return {
          chatType: "saved",
          conversationId: savedConversation?.id ?? `saved:${userId}`,
          peerId: userId,
          link: SAVED_DIALOG_LINK,
          displayName: SAVED_DIALOG_TITLE,
          avatarUrl: null,
          contactTag: null,
          contactTagVariant: "outline",
          lastMessage: lastMessage ? "" : "Добро пожаловать в Eclipse",
          lastMessageAt: (lastMessage?.createdAt ?? savedConversation?.updatedAt ?? new Date(0)).toISOString(),
          lastMessageMine: true,
          lastMessageCipherText: includeEncryptedPreview ? lastMessage?.cipherText ?? null : null,
          lastMessageIv: includeEncryptedPreview ? lastMessage?.iv ?? null : null,
          lastMessageEncryptedKey: includeEncryptedPreview ? lastMessage?.encryptedKeyForSender ?? null : null,
          peerReadAt: null,
          unreadCount: 0,
          isGroupOwner: false,
        };
      })();

  const autoDeletedIds = await getAutoDeletedDirectChatIds(userId, conversations);
  const directChats = (
    await Promise.all(
      conversations.map(async (conversation): Promise<DirectChat | null> => {
      if (autoDeletedIds.has(conversation.id)) return null;
      const peerParticipant = conversation.participants.find((item) => item.user.id !== userId);
      const peer = peerParticipant?.user;
      if (!peer || (peer.isBot && peer.isSystemAccount)) return null;
      const lastMessage = conversation.messages[0] ?? null;
      if (!lastMessage) return null;
      const previewEncryptedKey =
        (lastMessage.senderId === userId ? lastMessage.encryptedKeyForSender : lastMessage.encryptedKeyForRecipient) ?? "";
      const includeEncryptedPreview = Boolean(
        lastMessage &&
          (lastMessage.cipherText?.length ?? 0) <= DIRECT_PREVIEW_MAX_CIPHERTEXT_CHARS &&
          previewEncryptedKey.length <= DIRECT_PREVIEW_MAX_ENCRYPTED_KEY_CHARS,
      );
      return {
        chatType: "direct",
        conversationId: conversation.id,
        peerId: peer.id,
        isBot: peer.isBot,
        link: peer.link,
        displayName: peer.displayName,
        contactTag: null,
        contactTagVariant: "outline",
        avatarUrl: peer.avatarUrl,
        lastMessage: lastMessage?.isSystemMessage ? (lastMessage.systemPayload as { title?: string } | null)?.title || "" : readBotContent(lastMessage?.botContentEnc)?.text ?? "",
        lastMessageAt: (lastMessage?.createdAt ?? conversation.updatedAt).toISOString(),
        lastMessageMine: lastMessage ? lastMessage.senderId === userId : false,
        lastMessageCipherText: includeEncryptedPreview ? lastMessage?.cipherText ?? null : null,
        lastMessageIv: includeEncryptedPreview ? lastMessage?.iv ?? null : null,
        lastMessageEncryptedKey: includeEncryptedPreview && lastMessage ? previewEncryptedKey : null,
        peerReadAt: peerReadAtByConversationId.get(conversation.id) ?? null,
        unreadCount: unreadCountByConversationId.get(conversation.id) ?? 0,
        systemPayload: lastMessage?.isSystemMessage ? lastMessage.systemPayload : null,
        wallpaperUrl: wallpaperByConversationId.get(conversation.id)?.wallpaperUrl ?? null,
        wallpaperPosY: wallpaperByConversationId.get(conversation.id)?.wallpaperPosY ?? null,
      };
    }),
    )
  ).filter((item): item is DirectChat => item !== null);

  const groupChats = groups.map(
    (group): GroupChatBase => ({
      chatType: "group",
      canSendMessages: group.canSendMessages,
      conversationId: `group:${group.id}`,
      peerId: group.id,
      link: group.link,
      displayName: group.name,
      avatarUrl: group.avatarUrl ?? generateDefaultAvatarDataUrl(group.name, group.link),
      membersCount: String(Math.max(0, Number(group.membersCount) || 0)),
      contactTag: null,
      contactTagVariant: "outline",
      lastMessage: group.lastMessageCipherText
        ? ""
        : (group.lastMessageText ?? (group.ownerId === userId ? "Вы создали группу" : "Вы были добавлены.")),
      lastMessageIsService: !group.lastMessageCipherText && group.lastMessageText == null,
      lastMessageText: group.lastMessageCipherText
        ? undefined
        : (group.lastMessageText ?? (group.ownerId === userId ? "Вы создали группу" : "Вы были добавлены.")),
      lastMessageCipherText: group.lastMessageCipherText ?? null,
      lastMessageIv: group.lastMessageIv ?? null,
      lastMessageKeyVersion: group.lastMessageKeyVersion ?? null,
      lastMessageSenderId: group.lastMessageSenderId ?? null,
      lastMessageSenderAlias: null,
      lastMessageAt: (group.lastMessageAt ?? group.updatedAt).toISOString(),
      lastMessageMine: group.lastMessageSenderId === userId,
      lastMessageEncryptedKey: null,
      unreadCount: unreadCountByGroupId.get(group.id) ?? 0,
      isGroupOwner: group.ownerId === userId,
    }),
  );

  const channelChats = channels.map(
    (channel): ChannelChat => ({
      chatType: "channel",
      canSendMessages: channel.canSendMessages,
      conversationId: `channel:${channel.id}`,
      peerId: channel.id,
      link: channel.link,
      displayName: channel.name,
      avatarUrl: channel.avatarUrl ?? generateDefaultAvatarDataUrl(channel.name, channel.link),
      subscribersCount: String(Math.max(0, Number(channel.subscribersCount) || 0)),
      contactTag: null,
      contactTagVariant: "outline",
      lastMessage: channel.lastPostCipherText
        ? ""
        : (channel.lastPostText ?? (channel.ownerId === userId ? "Вы создали канал" : "Вы были добавлены.")),
      lastMessageIsService: !channel.lastPostCipherText && channel.lastPostText == null,
      lastMessageCipherText: channel.lastPostCipherText ?? null,
      lastMessageIv: channel.lastPostIv ?? null,
      lastMessageKeyVersion: channel.lastPostKeyVersion ?? null,
      lastMessageAt: (channel.lastPostAt ?? channel.updatedAt).toISOString(),
      lastMessageMine: channel.ownerId === userId,
      lastMessageEncryptedKey: null,
      unreadCount: unreadCountByChannelId.get(channel.id) ?? 0,
      isGroupOwner: false,
      ownerId: channel.ownerId,
      isChannelOwner: channel.ownerId === userId,
    }),
  );

  const chats: Array<DirectChat | SavedChat | EclipseChat | GroupChatBase | ChannelChat> = [
    savedChat,
    ...(eclipseChat ? [eclipseChat] : []),
    ...directChats,
    ...groupChats,
    ...channelChats,
  ].sort((a, b) => {
    if (a.chatType === "saved" && b.chatType !== "saved") return -1;
    if (b.chatType === "saved" && a.chatType !== "saved") return 1;
    if (a.chatType === "eclipse" && b.chatType !== "eclipse" && b.chatType !== "saved") return -1;
    if (b.chatType === "eclipse" && a.chatType !== "eclipse" && a.chatType !== "saved") return 1;
    return a.lastMessageAt < b.lastMessageAt ? 1 : -1;
  });

  const filtered = hasValidCursor ? chats.filter((chat) => Date.parse(chat.lastMessageAt) < cursorTs) : chats;
  const page = filtered.slice(0, limit);
  const contactIds = Array.from(
    new Set(
      page.flatMap((chat) => {
        if (chat.chatType === "direct") return [chat.peerId];
        if (chat.chatType === "group" && chat.lastMessageSenderId) return [chat.lastMessageSenderId];
        return [];
      }),
    ),
  );
  const [contactRows, directPrivacyByPeerId] = await Promise.all([
    contactIds.length ? prisma.contact.findMany({
      where: { ownerId: userId, peerId: { in: contactIds } }, select: { peerId: true, alias: true },
    }) : [],
    getPrivacySettingsBatch(page.filter((chat): chat is DirectChat => chat.chatType === "direct").map(chat => chat.peerId)),
  ]);
  const contactsMap = new Map(contactRows.map(row => [row.peerId, { alias: row.alias }]));

  const pageWithContacts = page.map((chat) => {
    if (chat.chatType === "direct") {
      const saved = contactsMap.get(chat.peerId);
      const privacy = directPrivacyByPeerId.get(chat.peerId);
      return {
        ...chat,
        contactAlias: saved?.alias ?? null,
        displayName: saved?.alias || (privacy ? getPrivacyDisplayName(userId, chat.peerId, chat.displayName, privacy) : chat.displayName),
        contactTag: null,
        contactTagVariant: "outline",
      };
    }
    if (chat.chatType === "saved" || chat.chatType === "eclipse") {
      return chat;
    }
    if (chat.chatType === "group") {
      const senderAlias = chat.lastMessageSenderId ? contactsMap.get(chat.lastMessageSenderId)?.alias : null;
      const lastMessage = chat.lastMessageText ?? "";
      return {
        chatType: "group" as const,
        canSendMessages: chat.canSendMessages,
        conversationId: chat.conversationId,
        peerId: chat.peerId,
        link: chat.link,
        displayName: chat.displayName,
        avatarUrl: chat.avatarUrl,
        membersCount: chat.membersCount,
        contactTag: null,
        contactTagVariant: "outline" as const,
        lastMessage: senderAlias && lastMessage ? `${senderAlias}: ${lastMessage}` : lastMessage,
        lastMessageIsService: chat.lastMessageIsService,
        lastMessageCipherText: chat.lastMessageCipherText ?? null,
        lastMessageIv: chat.lastMessageIv ?? null,
        lastMessageKeyVersion: chat.lastMessageKeyVersion ?? null,
        lastMessageSenderId: chat.lastMessageSenderId ?? null,
        lastMessageSenderAlias: senderAlias ?? null,
        lastMessageAt: chat.lastMessageAt,
        lastMessageMine: chat.lastMessageMine,
        lastMessageEncryptedKey: null,
        isGroupOwner: chat.isGroupOwner,
      };
    }
    return chat;
  });

  const hasMore = filtered.length > page.length;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].lastMessageAt : null;
  const payload = { chats: pageWithContacts, hasMore, nextCursor };

  try {
    await Promise.all([
      redis.set(cacheKey, JSON.stringify(payload), "EX", 5),
      redis.sadd(getChatListCacheIndexKey(userId), cacheKey),
      redis.expire(getChatListCacheIndexKey(userId), 300),
    ]);
  } catch {
    // cache is best-effort
  }

  return payload;
}
