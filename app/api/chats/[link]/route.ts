import { readJsonBody } from "@/lib/server/request-body";
import { readBotContent } from "@/lib/server/bot-content";
import { withSharedMessageEdit } from "@/lib/server/shared-message-write";
import { writeSecretMessage } from "@/lib/server/secret-message-write";
import { after, NextRequest } from "next/server";
import { secretDeviceEnvelope } from "@/lib/server/secret-device-keys";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { cipherTextSchema, messageIvSchema, wrappedMessageKeySchema, directMessageEnvelopeSchema } from "@/lib/server/message-envelope";
import { requireSecretChatAccess } from "@/lib/server/secret-chat-access";
import {
  findDirectConversation,
  getOrCreateDirectConversation,
  getOrCreateSavedDialog,
  ECLIPSE_DIALOG_LINK,
  ECLIPSE_DIALOG_TITLE,
  getOrCreateEclipseDialog,
  SAVED_DIALOG_LINK,
  SAVED_DIALOG_TITLE,
} from "@/lib/server/chat";
import type { EclipseSystemPayload } from "@/lib/eclipse-system";
import { revealEclipsePayload } from "@/lib/server/eclipse-payload";
import { requireUserFromRequest } from "@/lib/server/auth";
import { getContact } from "@/lib/server/contacts";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { getUserPublicKey } from "@/lib/server/e2e-key";
import { publicEncryptedMessageText } from "@/lib/server/e2e-shared-member";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { triggerRealtimeChannels, triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { grantInteractionPresence } from "@/lib/server/presence";
import { publishBeamsMessageToUser } from "@/lib/server/beams";
import { getChannelReadMarkers, getChannelReadMarkersForUsers, getGroupReadMarkersForUsers } from "@/lib/server/chat-read-state";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { invalidateChatListPayloadCache } from "@/lib/server/chat-list";
import { normalizeLink } from "@/lib/server/validation";
import {
  canUserStartConversation,
  getPrivacyDisplayName,
  getPrivacySettings,
  getPrivacySettingsBatch,
  scheduleDirectChatAutoDelete,
  shouldHideUsername,
} from "@/lib/server/privacy-settings";

type Params = {
  params: Promise<{ link: string }>;
};
type ChatType = "direct" | "group" | "channel" | "saved" | "eclipse";

const directBodySchema = directMessageEnvelopeSchema;

const groupBodySchema = z
  .object({
    text: z.string().trim().min(1).max(900_000).optional(),
    cipherText: cipherTextSchema.optional(),
    iv: messageIvSchema.optional(),
    keyVersion: z.number().int().min(1).optional(),
    replyToMessageId: z.string().min(1).max(128).nullable().optional(),
    clientMessageId: z.string().trim().min(8).max(128).optional(),
  })
  .refine(
    (value) => value.cipherText && value.iv && typeof value.keyVersion === "number",
    { message: "Invalid group message payload" },
  );

const channelBodySchema = z
  .object({
    text: z.string().trim().min(1).max(900_000).optional(),
    cipherText: cipherTextSchema.optional(),
    iv: messageIvSchema.optional(),
    keyVersion: z.number().int().min(1).optional(),
    replyToMessageId: z.string().min(1).max(128).nullable().optional(),
    clientMessageId: z.string().trim().min(8).max(128).optional(),
  })
  .refine(
    (value) => value.cipherText && value.iv && typeof value.keyVersion === "number",
    { message: "Invalid channel message payload" },
  );

const editDirectSchema = z.object({
  messageId: z.string().min(1).max(128),
  cipherText: cipherTextSchema,
  iv: messageIvSchema,
  encryptedKeyForSender: wrappedMessageKeySchema,
  encryptedKeyForRecipient: wrappedMessageKeySchema,
});

const editGroupSchema = z
  .object({
    messageId: z.string().min(1).max(128),
    text: z.string().trim().min(1).max(900_000).optional(),
    cipherText: cipherTextSchema.optional(),
    iv: messageIvSchema.optional(),
    keyVersion: z.number().int().min(1).optional(),
  })
  .refine(
    (value) => value.cipherText && value.iv && typeof value.keyVersion === "number",
    { message: "Invalid group edit payload" },
  );

const deleteBodySchema = z.object({
  messageId: z.string().min(1).max(128),
  mode: z.enum(["mine", "everyone"]).optional(),
});

const MIN_MESSAGES_LIMIT = 15;
const MAX_MESSAGES_LIMIT = 120;
const DEFAULT_MESSAGES_LIMIT = 24;
const DIRECT_PAYLOAD_BUDGET_CHARS = 1_200_000;
const REALTIME_TEXT_BUDGET_CHARS = 8000;
const REALTIME_CIPHERTEXT_BUDGET_CHARS = 12_000;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REACTIONS_PER_MESSAGE = 40;
const MESSAGE_SEND_IDEMPOTENCY_TTL_MS = 90_000;

const messageSendInflight = new Map<string, Promise<unknown>>();
const messageSendResultCache = new Map<string, { expiresAt: number; value: unknown }>();

function buildMessageSendDedupKey(params: {
  userId: string;
  chatScope: string;
  clientMessageId?: string;
}) {
  const clientMessageId = params.clientMessageId?.trim();
  if (!clientMessageId) return null;
  return `${params.userId}:${params.chatScope}:${clientMessageId}`;
}

function cleanupMessageSendCaches(now = Date.now()) {
  messageSendResultCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      messageSendResultCache.delete(key);
    }
  });
}

async function withSendIdempotency<T>(key: string | null, task: () => Promise<T>): Promise<T> {
  if (!key) return task();
  cleanupMessageSendCaches();
  const cached = messageSendResultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }
  const inflight = messageSendInflight.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }
  const run = (async () => {
    try {
      const result = await task();
      messageSendResultCache.set(key, {
        expiresAt: Date.now() + MESSAGE_SEND_IDEMPOTENCY_TTL_MS,
        value: result,
      });
      return result;
    } finally {
      messageSendInflight.delete(key);
    }
  })();
  messageSendInflight.set(key, run as Promise<unknown>);
  return run;
}

type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
  avatarUrl?: string | null;
};

function isReactionsStorageMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2021" || code === "P2022";
}

async function buildMessageReactions(
  messageIds: string[],
  userId: string,
): Promise<Map<string, ReactionSummary[]>> {
  if (messageIds.length === 0) return new Map();
  let counts: Array<{ messageId: string; emoji: string; _count: { _all: number } }> = [];
  let mine: Array<{ messageId: string; emoji: string }> = [];
  let latestReactions: Array<{ messageId: string; emoji: string; user: { avatarUrl: string | null } }> = [];
  try {
    [counts, mine, latestReactions] = await Promise.all([
      prisma.messageReaction.groupBy({
        by: ["messageId", "emoji"],
        _count: { _all: true },
        where: { messageId: { in: messageIds } },
      }),
      prisma.messageReaction.findMany({
        where: { messageId: { in: messageIds }, userId },
        select: { messageId: true, emoji: true },
      }),
      prisma.messageReaction.findMany({
        where: { messageId: { in: messageIds } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          messageId: true,
          emoji: true,
          user: { select: { avatarUrl: true } },
        },
      }),
    ]);
  } catch (error) {
    if (isReactionsStorageMissing(error)) return new Map();
    throw error;
  }

  const mineSet = new Set(mine.map((row) => `${row.messageId}:${row.emoji}`));
  const latestAvatarMap = new Map<string, string | null>();
  latestReactions.forEach((row) => {
    const key = `${row.messageId}:${row.emoji}`;
    if (!latestAvatarMap.has(key)) {
      latestAvatarMap.set(key, row.user.avatarUrl ?? null);
    }
  });
  const map = new Map<string, ReactionSummary[]>();
  counts.forEach((row) => {
    const list = map.get(row.messageId) ?? [];
    const key = `${row.messageId}:${row.emoji}`;
    list.push({
      emoji: row.emoji,
      count: row._count._all,
      reacted: mineSet.has(key),
      avatarUrl: latestAvatarMap.get(key) ?? null,
    });
    map.set(row.messageId, list);
  });
  map.forEach((list, key) => {
    list.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    map.set(key, list.slice(0, MAX_REACTIONS_PER_MESSAGE));
  });
  return map;
}

async function buildGroupMessageReactions(
  messageIds: string[],
  userId: string,
): Promise<Map<string, ReactionSummary[]>> {
  if (messageIds.length === 0) return new Map();
  let counts: Array<{ groupMessageId: string; emoji: string; _count: { _all: number } }> = [];
  let mine: Array<{ groupMessageId: string; emoji: string }> = [];
  let latestReactions: Array<{ groupMessageId: string; emoji: string; user: { avatarUrl: string | null } }> = [];
  try {
    [counts, mine, latestReactions] = await Promise.all([
      prisma.groupMessageReaction.groupBy({
        by: ["groupMessageId", "emoji"],
        _count: { _all: true },
        where: { groupMessageId: { in: messageIds } },
      }),
      prisma.groupMessageReaction.findMany({
        where: { groupMessageId: { in: messageIds }, userId },
        select: { groupMessageId: true, emoji: true },
      }),
      prisma.groupMessageReaction.findMany({
        where: { groupMessageId: { in: messageIds } },
        orderBy: [{ createdAt: "desc" }],
        select: {
          groupMessageId: true,
          emoji: true,
          user: { select: { avatarUrl: true } },
        },
      }),
    ]);
  } catch (error) {
    if (isReactionsStorageMissing(error)) return new Map();
    throw error;
  }
  const mineSet = new Set(mine.map((row) => `${row.groupMessageId}:${row.emoji}`));
  const latestAvatarMap = new Map<string, string | null>();
  latestReactions.forEach((row) => {
    const key = `${row.groupMessageId}:${row.emoji}`;
    if (!latestAvatarMap.has(key)) {
      latestAvatarMap.set(key, row.user.avatarUrl ?? null);
    }
  });
  const map = new Map<string, ReactionSummary[]>();
  counts.forEach((row) => {
    const list = map.get(row.groupMessageId) ?? [];
    const key = `${row.groupMessageId}:${row.emoji}`;
    list.push({
      emoji: row.emoji,
      count: row._count._all,
      reacted: mineSet.has(key),
      avatarUrl: latestAvatarMap.get(key) ?? null,
    });
    map.set(row.groupMessageId, list);
  });
  map.forEach((list, key) => {
    list.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    map.set(key, list.slice(0, MAX_REACTIONS_PER_MESSAGE));
  });
  return map;
}

async function buildChannelPostReactions(
  messageIds: string[],
  userId: string,
): Promise<Map<string, ReactionSummary[]>> {
  if (messageIds.length === 0) return new Map();
  let counts: Array<{ postId: string; emoji: string; _count: { _all: number } }> = [];
  let mine: Array<{ postId: string; emoji: string }> = [];
  try {
    [counts, mine] = await Promise.all([
      prisma.channelPostReaction.groupBy({
        by: ["postId", "emoji"],
        _count: { _all: true },
        where: { postId: { in: messageIds } },
      }),
      prisma.channelPostReaction.findMany({
        where: { postId: { in: messageIds }, userId },
        select: { postId: true, emoji: true },
      }),
    ]);
  } catch (error) {
    if (isReactionsStorageMissing(error)) return new Map();
    throw error;
  }
  const mineSet = new Set(mine.map((row) => `${row.postId}:${row.emoji}`));
  const map = new Map<string, ReactionSummary[]>();
  counts.forEach((row) => {
    const list = map.get(row.postId) ?? [];
    list.push({
      emoji: row.emoji,
      count: row._count._all,
      reacted: mineSet.has(`${row.postId}:${row.emoji}`),
    });
    map.set(row.postId, list);
  });
  map.forEach((list, key) => {
    list.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    map.set(key, list.slice(0, MAX_REACTIONS_PER_MESSAGE));
  });
  return map;
}

function parsePreferredChatType(raw: string | null): ChatType | null {
  if (raw === "direct" || raw === "group" || raw === "channel" || raw === "saved" || raw === "eclipse") {
    return raw;
  }
  return null;
}

function applyChatTypePreference<TPeer, TGroup, TChannel>(input: {
  peer: TPeer | null;
  memberGroup: TGroup | null;
  channel: TChannel | null;
  preferredChatType: ChatType | null;
}) {
  const { preferredChatType } = input;
  if (preferredChatType === "direct" && input.peer) {
    return { peer: input.peer, memberGroup: null, channel: null };
  }
  if (preferredChatType === "group" && input.memberGroup) {
    return { peer: null, memberGroup: input.memberGroup, channel: null };
  }
  if (preferredChatType === "channel" && input.channel) {
    return { peer: null, memberGroup: null, channel: input.channel };
  }
  if (preferredChatType === "saved" || preferredChatType === "eclipse") {
    return { peer: null, memberGroup: null, channel: null };
  }
  return {
    peer: input.peer,
    memberGroup: input.memberGroup,
    channel: input.channel,
  };
}

async function resolveDirectPeer(currentUserId: string, link: string) {
  const normalized = normalizeLink(link);
  let peer = await prisma.user.findFirst({
    where: { link: { equals: normalized, mode: "insensitive" } },
    select: {
      id: true,
      link: true,
      link2: true,
      link3: true,
      link4: true,
      link5: true,
      displayName: true,
      avatarUrl: true,
      isBot: true,
    },
  });

  if (!peer) {
    peer = await prisma.user.findFirst({
      where: {
        OR: [
          { link2: { equals: normalized, mode: "insensitive" } },
          { link3: { equals: normalized, mode: "insensitive" } },
          { link4: { equals: normalized, mode: "insensitive" } },
          { link5: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        link: true,
        link2: true,
        link3: true,
        link4: true,
        link5: true,
        displayName: true,
        avatarUrl: true,
        isBot: true,
      },
    });
  }

  if (!peer) return null;
  if (peer.id === currentUserId) {
    throw new HttpError(400, "Cannot open chat with yourself");
  }

  return peer;
}

function isSavedDialogRoute(rawLink: string, preferredChatType: ChatType | null) {
  return preferredChatType === "saved" || rawLink === SAVED_DIALOG_LINK;
}

function isEclipseDialogRoute(rawLink: string, preferredChatType: ChatType | null) {
  return preferredChatType === "eclipse" || rawLink === ECLIPSE_DIALOG_LINK;
}

async function resolveMemberGroup(currentUserId: string, link: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      link: string;
      name: string;
      avatarUrl: string | null;
      ownerId: string;
      reactionMode: string;
      allowedReactions: string[];
      createdAt: Date;
      myJoinedAt: Date;
      myRole: string;
      myRoleLabel: string | null;
      myCanChangeAvatar: boolean;
      myCanChangeName: boolean;
      myCanChangeReactions: boolean;
      myCanPinMessages: boolean;
      myCanDeleteForeignMessages: boolean;
      myCanAddMembers: boolean;
      myCanPostMessages: boolean;
      myCanGenerateInviteLink: boolean;
      myCanManageAdmins: boolean;
    }>
  >`
    SELECT
      g."id",
      g."link",
      g."name",
      g."avatarUrl",
      g."ownerId",
      g."reactionMode",
      g."allowedReactions",
      g."createdAt" AS "createdAt",
      gm."createdAt" AS "myJoinedAt",
      gm."role" AS "myRole",
      gm."roleLabel" AS "myRoleLabel",
      gm."canChangeAvatar" AS "myCanChangeAvatar",
      gm."canChangeName" AS "myCanChangeName",
      gm."canChangeReactions" AS "myCanChangeReactions",
      gm."canPinMessages" AS "myCanPinMessages",
      gm."canDeleteForeignMessages" AS "myCanDeleteForeignMessages",
      gm."canAddMembers" AS "myCanAddMembers",
      gm."canPostMessages" AS "myCanPostMessages",
      gm."canGenerateInviteLink" AS "myCanGenerateInviteLink",
      gm."canManageAdmins" AS "myCanManageAdmins"
    FROM "Group" g
    JOIN "GroupMember" gm ON gm."groupId" = g."id"
    WHERE g."link" = ${link} AND gm."userId" = ${currentUserId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function groupExistsByLink(link: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Group"
    WHERE "link" = ${link}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function resolveChannel(link: string, currentUserId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      link: string;
      name: string;
      avatarUrl: string | null;
      ownerId: string;
      reactionMode: string;
      allowedReactions: string[];
      isSubscribed: boolean;
      subscribersCount: bigint | number;
      createdAt: Date;
      myJoinedAt: Date | null;
    }>
  >`
    SELECT
      c."id",
      c."link",
      c."name",
      c."avatarUrl",
      c."ownerId",
      c."reactionMode",
      c."allowedReactions",
      c."createdAt" AS "createdAt",
      EXISTS(
        SELECT 1
        FROM "ChannelSubscriber" cs
        WHERE cs."channelId" = c."id" AND cs."userId" = ${currentUserId}
      ) AS "isSubscribed",
      (
        SELECT cs."createdAt"
        FROM "ChannelSubscriber" cs
        WHERE cs."channelId" = c."id" AND cs."userId" = ${currentUserId}
        LIMIT 1
      ) AS "myJoinedAt",
      (
        SELECT COUNT(*)
        FROM "ChannelSubscriber" cs_all
        WHERE cs_all."channelId" = c."id"
      ) AS "subscribersCount"
    FROM "Channel" c
    WHERE c."link" = ${link}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function resolveChatTargets(input: {
  currentUserId: string;
  link: string;
  preferredChatType: ChatType | null;
}) {
  let peer: Awaited<ReturnType<typeof resolveDirectPeer>> | null = null;
  let memberGroup: Awaited<ReturnType<typeof resolveMemberGroup>> | null = null;
  let channel: Awaited<ReturnType<typeof resolveChannel>> | null = null;

  if (input.preferredChatType === "direct" || input.preferredChatType === "saved") {
    peer = await resolveDirectPeer(input.currentUserId, input.link);
    if (!peer) {
      [memberGroup, channel] = await Promise.all([
        resolveMemberGroup(input.currentUserId, input.link),
        resolveChannel(input.link, input.currentUserId),
      ]);
    }
  } else if (input.preferredChatType === "group") {
    memberGroup = await resolveMemberGroup(input.currentUserId, input.link);
    if (!memberGroup) {
      [peer, channel] = await Promise.all([
        resolveDirectPeer(input.currentUserId, input.link),
        resolveChannel(input.link, input.currentUserId),
      ]);
    }
  } else if (input.preferredChatType === "channel") {
    channel = await resolveChannel(input.link, input.currentUserId);
    if (!channel) {
      [peer, memberGroup] = await Promise.all([
        resolveDirectPeer(input.currentUserId, input.link),
        resolveMemberGroup(input.currentUserId, input.link),
      ]);
    }
  } else {
    [peer, memberGroup, channel] = await Promise.all([
      resolveDirectPeer(input.currentUserId, input.link),
      resolveMemberGroup(input.currentUserId, input.link),
      resolveChannel(input.link, input.currentUserId),
    ]);
  }

  return applyChatTypePreference({
    peer,
    memberGroup,
    channel,
    preferredChatType: input.preferredChatType,
  });
}

async function resolveActiveUserKeyMeta(userId: string) {
  try {
    const byStatus = await prisma.userE2EKey.findFirst({
      where: { userId, status: "active" },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      select: { id: true, version: true },
    });
    if (byStatus) return byStatus;
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code !== "P2022" && code !== "P2010") throw error;
  }
  return prisma.userE2EKey.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true },
  });
}

async function getHiddenMessageIdSet(
  userId: string,
  chatType: ChatType,
  messageIds: string[],
): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();
  const rows = await prisma.hiddenChatMessage.findMany({
    where: {
      userId,
      chatType,
      messageId: { in: messageIds },
    },
    select: { messageId: true },
  });
  return new Set(rows.map((row) => row.messageId));
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);
    const { link: rawLink } = await params;

    if (rawLink.startsWith("secret-")) {
      const secretChatId = rawLink.substring("secret-".length);
      const secretChat = await prisma.secretChat.findUnique({
        where: { id: secretChatId },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      });
      if (!secretChat) {
        throw new HttpError(404, "Секретный чат не найден");
      }
      const ownPart = requireSecretChatAccess(secretChat, user.id, sessionId, true);

      const peerPart = secretChat.participants.find((p) => p.userId !== user.id) || secretChat.participants[0];
      const peerUser = peerPart.user;
      const [savedContact, peerPrivacy] = await Promise.all([
        getContact(user.id, peerUser.id),
        getPrivacySettings(peerUser.id),
      ]);
      const peerPublicKey = secretChat.cryptoVersion === 2 ? peerPart.devicePublicKey : await getUserPublicKey(peerUser.id);
      const peerDisplayName = savedContact?.alias || getPrivacyDisplayName(user.id, peerUser.displayName, peerUser.displayName, peerPrivacy);

      const chatMessages = secretChat.isApproved ? await prisma.secretChatMessage.findMany({
        where: { secretChatId },
        orderBy: { createdAt: "asc" },
      }) : [];

      const creatorPart = secretChat.participants.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] || secretChat.participants[0];
      const creatorId = creatorPart?.userId;
      const isCreator = creatorId === user.id;

      const res = jsonOk({
        chatType: "direct",
        conversationId: `secret:${secretChat.id}`,
        secretCrypto: { version: secretChat.cryptoVersion, ownKeyId: ownPart.deviceKeyId, ownPublicKey: ownPart.devicePublicKey },
        expiresAt: secretChat.expiresAt ? secretChat.expiresAt.toISOString() : null,
        codeword: secretChat.codeword ?? null,
        isApproved: secretChat.isApproved,
        isCreator,
        creatorId,
        peer: {
          id: peerUser.id,
          link: peerUser.link,
          displayName: peerDisplayName,
          contactAlias: savedContact?.alias ?? null,
          avatarUrl: peerUser.avatarUrl ?? null,
          publicKey: peerPublicKey,
        },
        hasMoreBefore: false,
        messages: chatMessages.map((m) => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(m.textEnc);
          } catch {
            parsed = { text: m.textEnc };
          }
          return {
            id: m.id,
            senderId: m.senderId,
            cipherText: parsed.cipherText || null,
            iv: parsed.iv || null,
            encryptedKey: secretDeviceEnvelope(secretChat.cryptoVersion, ownPart.deviceKeyId, (m.senderId === user.id ? parsed.encryptedKeyForSender : parsed.encryptedKeyForRecipient) || null),
            text: parsed.text || null,
            createdAt: m.createdAt.toISOString(),
          };
        }),
      });
      res.headers.set("Cache-Control", "private, no-store");
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const preferredChatType = parsePreferredChatType(req.nextUrl.searchParams.get("chatType"));
    const exactMessageId = req.nextUrl.searchParams.get("messageId")?.trim() || null;
    const selfUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { link: true, link2: true, link3: true, link4: true, link5: true },
    });
    const normalizedRawLink = normalizeLink(rawLink);
    const selfLinks = selfUser
      ? [selfUser.link, selfUser.link2, selfUser.link3, selfUser.link4, selfUser.link5]
          .filter((l): l is string => Boolean(l && l.trim()))
          .map((l) => normalizeLink(l))
      : [];
    const isSelfLink = selfLinks.includes(normalizedRawLink);
    const savedDialogRequested = isSavedDialogRoute(rawLink, preferredChatType) || isSelfLink;
    const eclipseDialogRequested = isEclipseDialogRoute(rawLink, preferredChatType);
    const link = savedDialogRequested
      ? SAVED_DIALOG_LINK
      : eclipseDialogRequested
        ? ECLIPSE_DIALOG_LINK
        : normalizeLink(rawLink);
    const rawLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
    const messageLimit = Number.isFinite(rawLimit)
      ? Math.max(MIN_MESSAGES_LIMIT, Math.min(MAX_MESSAGES_LIMIT, rawLimit))
      : DEFAULT_MESSAGES_LIMIT;
    const rawBefore = req.nextUrl.searchParams.get("before");
    const beforeDate = rawBefore ? new Date(rawBefore) : null;
    const hasValidBeforeDate = Boolean(beforeDate && !Number.isNaN(beforeDate.getTime()));
    const directBeforeSql = hasValidBeforeDate ? Prisma.sql`AND "createdAt" < ${beforeDate as Date}` : Prisma.empty;

    const resolved = savedDialogRequested || eclipseDialogRequested
      ? { peer: null, memberGroup: null, channel: null }
      : await resolveChatTargets({
          currentUserId: user.id,
          link,
          preferredChatType,
        });
    const { peer, memberGroup, channel } = resolved;

    if (eclipseDialogRequested) {
      const conversationId = await getOrCreateEclipseDialog(user.id);
      const eclipseWhere = {
        conversationId,
        isSystemMessage: true,
        ...(exactMessageId ? { id: exactMessageId } : {}),
        ...(hasValidBeforeDate && !exactMessageId ? { createdAt: { lt: beforeDate as Date } } : {}),
      };
      const rawMessages = await prisma.message.findMany({
        where: eclipseWhere,
        orderBy: { createdAt: "desc" },
        take: exactMessageId ? 1 : messageLimit + 1,
        select: {
          id: true,
          senderId: true,
          systemPayload: true,
          createdAt: true,
        },
      });
      const hiddenMessageIds = await getHiddenMessageIdSet(user.id, "eclipse", rawMessages.map((message) => message.id));
      const visibleRawMessages = rawMessages.filter((message) => {
        if (hiddenMessageIds.has(message.id)) return false;
        const payload = message.systemPayload as EclipseSystemPayload;
        if (payload?.eventType === "new_login" && payload?.metadata?.sessionId === sessionId) {
          return false;
        }
        return true;
      });
      const hasMoreBeforeRaw = !exactMessageId && rawMessages.length > messageLimit;
      const messages = exactMessageId
        ? visibleRawMessages.slice(0, 1)
        : visibleRawMessages.slice(0, messageLimit).reverse();

      const res = jsonOk({
        chatType: "eclipse",
        conversationId,
        eclipse: {
          id: conversationId,
          link: ECLIPSE_DIALOG_LINK,
          title: ECLIPSE_DIALOG_TITLE,
          isSystem: true,
          isVerified: true,
          statusText: "",
          avatarUrl: null,
        },
        readReceiptAt: null,
        hasMoreBefore: hasMoreBeforeRaw,
        messages: messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          senderType: "system" as const,
          systemPayload: revealEclipsePayload(message.systemPayload),
          createdAt: message.createdAt.toISOString(),
          reactions: [],
        })),
      });
      res.headers.set("Cache-Control", "private, no-store");
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (savedDialogRequested) {
      const conversationId = await getOrCreateSavedDialog(user.id);
      const rawMessages = exactMessageId
        ? await prisma.$queryRaw<
            Array<{
              id: string;
              senderId: string;
              cipherText: string;
              iv: string;
              encryptedKeyForSender: string | null;
              replyToMessageId: string | null;
              createdAt: Date;
            }>
          >`
            SELECT
              "id",
              "senderId",
              "cipherText",
              "iv",
              "encryptedKeyForSender",
              "replyToMessageId",
              "createdAt"
            FROM "Message"
            WHERE "conversationId" = ${conversationId}
              AND "id" = ${exactMessageId}
            LIMIT 1
          `
        : await prisma.$queryRaw<
        Array<{
          id: string;
          senderId: string;
          cipherText: string;
          iv: string;
          encryptedKeyForSender: string | null;
          replyToMessageId: string | null;
          createdAt: Date;
        }>
      >`
        SELECT
          "id",
          "senderId",
          "cipherText",
          "iv",
          "encryptedKeyForSender",
          "replyToMessageId",
          "createdAt"
        FROM "Message"
        WHERE "conversationId" = ${conversationId}
        ${directBeforeSql}
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT ${messageLimit + 1}
      `;
      const hiddenMessageIds = await getHiddenMessageIdSet(user.id, "saved", rawMessages.map((message) => message.id));
      const visibleRawMessages = rawMessages.filter((message) => !hiddenMessageIds.has(message.id));
      const hasMoreBeforeRaw = !exactMessageId && rawMessages.length > messageLimit;
      const messages = exactMessageId ? visibleRawMessages.slice(0, 1) : visibleRawMessages.slice(0, messageLimit).reverse();

      const limitedMessages: (typeof messages) = exactMessageId ? messages : [];
      if (!exactMessageId) {
        let payloadChars = 0;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const item = messages[i];
          const targetEncryptedKey = item.encryptedKeyForSender ?? "";
          const itemWeight = item.cipherText.length + targetEncryptedKey.length + item.iv.length;
          if (limitedMessages.length > 0 && payloadChars + itemWeight > DIRECT_PAYLOAD_BUDGET_CHARS) {
            break;
          }
          payloadChars += itemWeight;
          limitedMessages.push(item);
        }
        limitedMessages.reverse();
      }
      const reactionsMap = await buildMessageReactions(
        limitedMessages.map((message) => message.id),
        user.id,
      );

      const res = jsonOk({
        chatType: "saved",
        conversationId,
        saved: {
          id: conversationId,
          link: SAVED_DIALOG_LINK,
          title: SAVED_DIALOG_TITLE,
          avatarUrl: null,
        },
        readReceiptAt: null,
        hasMoreBefore: hasMoreBeforeRaw || messages.length > limitedMessages.length,
        messages: limitedMessages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          cipherText: message.cipherText,
          iv: message.iv,
          encryptedKey: message.encryptedKeyForSender ?? "",
          replyToMessageId: message.replyToMessageId,
          createdAt: message.createdAt.toISOString(),
          reactions: reactionsMap.get(message.id) ?? [],
        })),
      });
      res.headers.set("Cache-Control", "private, no-store");
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (peer) {
      const [savedContact, peerPublicKey, conversationId, peerPrivacy] = await Promise.all([
        getContact(user.id, peer.id),
        getUserPublicKey(peer.id),
        findDirectConversation(user.id, peer.id),
        getPrivacySettings(peer.id),
      ]);
      const isPeerUsernameHidden = shouldHideUsername(user.id, peer.id, peerPrivacy);
      const peerSecondaryLinks = isPeerUsernameHidden
        ? []
        : Array.from(
            new Set(
              [peer.link2, peer.link3, peer.link4, peer.link5]
                .filter((l): l is string => Boolean(l && l.trim()))
                .map((l) => l.trim())
                .filter((l) => l.toLowerCase() !== peer.link.trim().toLowerCase()),
            ),
          );
      const peerView = {
        isBot: peer.isBot,
        id: peer.id,
        link: peer.link,
        secondaryLinks: peerSecondaryLinks,
        avatarUrl: peer.avatarUrl,
        displayName: savedContact?.alias || getPrivacyDisplayName(user.id, peer.id, peer.displayName, peerPrivacy),
        contactAlias: savedContact?.alias ?? null,
        usernameHidden: isPeerUsernameHidden,
      };

      let participant: { wallpaperUrl: string | null; wallpaperPosY: number | null } | null = null;
      let peerReadRows: Array<{ lastReadAt: Date | null }> = [];
      let rawMessages: Array<{
        id: string;
        senderId: string;
        cipherText: string | null;
        iv: string | null;
        encryptedKeyForSender: string | null;
        encryptedKeyForRecipient: string | null;
        replyToMessageId: string | null;
        createdAt: Date;
        isSystemMessage: boolean;
        systemPayload: Prisma.JsonValue | null;
        botContentEnc: string | null;
      }> = [];

      if (conversationId) {
        const results = await Promise.all([
          prisma.conversationParticipant.findUnique({
            where: {
              conversationId_userId: {
                conversationId,
                userId: user.id,
              },
            },
            select: {
              wallpaperUrl: true,
              wallpaperPosY: true,
            },
          }),
          prisma.$queryRaw<Array<{ lastReadAt: Date | null }>>`
            SELECT cp."lastReadAt"
            FROM "ConversationParticipant" cp
            WHERE cp."conversationId" = ${conversationId}
              AND cp."userId" = ${peer.id}
            LIMIT 1
          `,
          exactMessageId
            ? prisma.$queryRaw<
                Array<{
                  id: string;
                  senderId: string;
                  cipherText: string | null;
                  iv: string | null;
                  encryptedKeyForSender: string | null;
                  encryptedKeyForRecipient: string | null;
                  replyToMessageId: string | null;
                  createdAt: Date;
                  isSystemMessage: boolean;
                  systemPayload: Prisma.JsonValue | null;
                  botContentEnc: string | null;
                }>
              >`
                SELECT
                  "id",
                  "senderId",
                  "cipherText",
                  "iv",
                  "encryptedKeyForSender",
                  "encryptedKeyForRecipient",
                  "replyToMessageId",
                  "createdAt",
                  "isSystemMessage",
                  "systemPayload",
                  "botContentEnc"
                FROM "Message"
                WHERE "conversationId" = ${conversationId}
                  AND "id" = ${exactMessageId}
                LIMIT 1
              `
            : prisma.$queryRaw<
                Array<{
                  id: string;
                  senderId: string;
                  cipherText: string | null;
                  iv: string | null;
                  encryptedKeyForSender: string | null;
                  encryptedKeyForRecipient: string | null;
                  replyToMessageId: string | null;
                  createdAt: Date;
                  isSystemMessage: boolean;
                  systemPayload: Prisma.JsonValue | null;
                  botContentEnc: string | null;
                }>
              >`
                SELECT
                  "id",
                  "senderId",
                  "cipherText",
                  "iv",
                  "encryptedKeyForSender",
                  "encryptedKeyForRecipient",
                  "replyToMessageId",
                  "createdAt",
                  "isSystemMessage",
                  "systemPayload",
                  "botContentEnc"
                FROM "Message"
                WHERE "conversationId" = ${conversationId}
                ${directBeforeSql}
                ORDER BY "createdAt" DESC, "id" DESC
                LIMIT ${messageLimit + 1}
              `,
        ]);
        participant = results[0];
        peerReadRows = results[1];
        rawMessages = results[2];
      }
      const hiddenMessageIds = await getHiddenMessageIdSet(user.id, "direct", rawMessages.map((message) => message.id));
      const visibleRawMessages = rawMessages.filter((message) => !hiddenMessageIds.has(message.id));
      const hasMoreBeforeRaw = !exactMessageId && rawMessages.length > messageLimit;
      const messages = exactMessageId ? visibleRawMessages.slice(0, 1) : visibleRawMessages.slice(0, messageLimit).reverse();

      const limitedMessages: (typeof messages) = exactMessageId ? messages : [];
      if (!exactMessageId) {
        let payloadChars = 0;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const item = messages[i];
          const targetEncryptedKey = (
            item.senderId === user.id
              ? item.encryptedKeyForSender
              : item.encryptedKeyForRecipient
          ) ?? "";
          const itemWeight =
            (item.cipherText?.length ?? 0) +
            targetEncryptedKey.length +
            (item.iv?.length ?? 0);

          if (limitedMessages.length > 0 && payloadChars + itemWeight > DIRECT_PAYLOAD_BUDGET_CHARS) {
            break;
          }
          payloadChars += itemWeight;
          limitedMessages.push(item);
        }
        limitedMessages.reverse();
      }
      const reactionsMap = await buildMessageReactions(
        limitedMessages.map((message) => message.id),
        user.id,
      );

      const res = jsonOk({
        chatType: "direct",
        conversationId,
        peer: { ...peerView, publicKey: peerPublicKey },
        wallpaperUrl: participant?.wallpaperUrl ?? null,
        wallpaperPosY: participant?.wallpaperPosY ?? null,
        readReceiptAt: peerReadRows[0]?.lastReadAt?.toISOString() ?? null,
        hasMoreBefore: hasMoreBeforeRaw || messages.length > limitedMessages.length,
        messages: limitedMessages.map((message: (typeof limitedMessages)[number]) => ({
          id: message.id,
          senderId: message.senderId,
          text: peer.isBot ? readBotContent(message.botContentEnc)?.text : undefined,
          botReplyMarkup: peer.isBot ? readBotContent(message.botContentEnc)?.reply_markup : undefined,
          cipherText: message.cipherText,
          iv: message.iv,
          encryptedKey:
            (message.senderId === user.id
              ? message.encryptedKeyForSender
              : message.encryptedKeyForRecipient) ?? "",
          replyToMessageId: message.replyToMessageId,
          createdAt: message.createdAt.toISOString(),
          reactions: reactionsMap.get(message.id) ?? [],
          isSystemMessage: message.isSystemMessage,
          systemPayload: message.systemPayload,
        })),
      });
      res.headers.set("Cache-Control", "private, no-store");
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (memberGroup) {
      const groupBeforeSql = hasValidBeforeDate ? Prisma.sql`AND "createdAt" < ${beforeDate as Date}` : Prisma.empty;
      const [members, rawMessages] = await Promise.all([
        exactMessageId
          ? Promise.resolve(
              [] as Array<{
                id: string;
                link: string;
                displayName: string;
                avatarUrl: string | null;
              }>,
            )
          : prisma.$queryRaw<
              Array<{
                id: string;
                link: string;
                displayName: string;
                avatarUrl: string | null;
              }>
            >`
              SELECT u."id", u."link", u."displayName", u."avatarUrl"
              FROM "GroupMember" gm
              JOIN "User" u ON u."id" = gm."userId"
              WHERE gm."groupId" = ${memberGroup.id}
              ORDER BY gm."createdAt" ASC
            `,
        exactMessageId
          ? prisma.$queryRaw<
              Array<{
                id: string;
                senderId: string;
                text: string | null;
                cipherText: string | null;
                iv: string | null;
                keyVersion: number | null;
                replyToMessageId: string | null;
                createdAt: Date;
              }>
            >`
              SELECT
                "id",
                "senderId",
                "text",
                "cipherText",
                "iv",
                "keyVersion",
                "replyToMessageId",
                "createdAt"
              FROM "GroupMessage"
              WHERE "groupId" = ${memberGroup.id}
                AND "id" = ${exactMessageId}
              LIMIT 1
            `
          : prisma.$queryRaw<
          Array<{
            id: string;
            senderId: string;
            text: string | null;
            cipherText: string | null;
            iv: string | null;
            keyVersion: number | null;
            replyToMessageId: string | null;
            createdAt: Date;
          }>
        >`
          SELECT
            "id",
            "senderId",
            "text",
            "cipherText",
            "iv",
            "keyVersion",
            "replyToMessageId",
            "createdAt"
          FROM "GroupMessage"
          WHERE "groupId" = ${memberGroup.id}
          ${groupBeforeSql}
          ORDER BY "createdAt" DESC
          LIMIT ${messageLimit + 1}
        `,
      ]);
      const hiddenMessageIds = await getHiddenMessageIdSet(user.id, "group", rawMessages.map((message) => message.id));
      const visibleRawMessages = rawMessages.filter((message) => !hiddenMessageIds.has(message.id));
      const hasMoreBefore = !exactMessageId && rawMessages.length > messageLimit;
      const messages = exactMessageId ? visibleRawMessages.slice(0, 1) : visibleRawMessages.slice(0, messageLimit).reverse();

      const contactIds = Array.from(new Set([...members.map((member) => member.id), ...messages.map((message) => message.senderId)]));
      const contactRows =
        contactIds.length > 0
          ? await prisma.contact.findMany({
              where: {
                ownerId: user.id,
                peerId: { in: contactIds },
              },
              select: {
                peerId: true,
                alias: true,
              },
            })
          : [];
      const contactsMap = new Map(
        contactRows.map((row) => [
          row.peerId,
          {
            alias: row.alias,
          },
        ]),
      );
      const memberPrivacyById = await getPrivacySettingsBatch(members.map((member) => member.id));
      const reactionsMap = await buildGroupMessageReactions(
        messages.map((message) => message.id),
        user.id,
      );
      const memberReadMarkers = await getGroupReadMarkersForUsers(
        members.map((member) => member.id),
        memberGroup.id,
      );
      const readByByMessageId = new Map<
        string,
        Array<{
          id: string;
          link: string;
          displayName: string;
          avatarUrl: string | null;
          readAt: string;
        }>
      >();
      for (const message of messages) {
        const viewers = members
          .filter((member) => member.id !== message.senderId)
          .map((member) => {
            const readAt = memberReadMarkers.get(member.id) ?? null;
            return { member, readAt };
          })
          .filter((entry): entry is { member: (typeof members)[number]; readAt: Date } => {
            return Boolean(entry.readAt && entry.readAt.getTime() + 1000 >= message.createdAt.getTime());
          })
          .sort((a, b) => b.readAt.getTime() - a.readAt.getTime())
          .slice(0, 20)
          .map(({ member, readAt }) => {
            const contact = contactsMap.get(member.id);
            const privacy = memberPrivacyById.get(member.id);
            return {
              id: member.id,
              link: member.link,
              displayName: contact?.alias || (privacy ? getPrivacyDisplayName(user.id, member.id, member.displayName, privacy) : member.displayName),
              avatarUrl: member.avatarUrl ?? null,
              readAt: readAt.toISOString(),
            };
          });
        readByByMessageId.set(message.id, viewers);
      }

      const res = jsonOk({
        chatType: "group",
        conversationId: `group:${memberGroup.id}`,
        group: {
          id: memberGroup.id,
          link: memberGroup.link,
          name: memberGroup.name,
          avatarUrl: memberGroup.avatarUrl ?? generateDefaultAvatarDataUrl(memberGroup.name, memberGroup.link),
          ownerId: memberGroup.ownerId,
          reactionMode: memberGroup.reactionMode,
          allowedReactions: memberGroup.allowedReactions,
          myRole: memberGroup.myRole,
          myRoleLabel: memberGroup.myRoleLabel,
          myCanChangeAvatar: memberGroup.myCanChangeAvatar,
          myCanChangeName: memberGroup.myCanChangeName,
          myCanChangeReactions: memberGroup.myCanChangeReactions,
          myCanPinMessages: memberGroup.myCanPinMessages,
          myCanDeleteForeignMessages: memberGroup.myCanDeleteForeignMessages,
          myCanAddMembers: memberGroup.myCanAddMembers,
          createdAt: memberGroup.createdAt.toISOString(),
          myJoinedAt: memberGroup.myJoinedAt.toISOString(),
        },
        hasMoreBefore,
        members: members.map((member: (typeof members)[number]) => {
          const contact = contactsMap.get(member.id);
          const privacy = memberPrivacyById.get(member.id);
          return {
            ...member,
            displayName: contact?.alias || (privacy ? getPrivacyDisplayName(user.id, member.id, member.displayName, privacy) : member.displayName),
            isContact: Boolean(contact),
            contactAlias: contact?.alias ?? null,
            contactTag: null,
            contactTagVariant: "outline",
          };
        }),
        messages: messages.map((message: (typeof messages)[number]) => {
          const contact = contactsMap.get(message.senderId);
          const privacy = memberPrivacyById.get(message.senderId);
          const sender = members.find((member) => member.id === message.senderId);
          return {
            id: message.id,
            senderId: message.senderId,
            text: publicEncryptedMessageText(message.text, message.cipherText),
            cipherText: message.cipherText,
            iv: message.iv,
            keyVersion: message.keyVersion,
            replyToMessageId: message.replyToMessageId,
            senderDisplayName:
              contact?.alias ||
              (sender ? (privacy ? getPrivacyDisplayName(user.id, sender.id, sender.displayName, privacy) : sender.displayName) : undefined),
            createdAt: message.createdAt.toISOString(),
            reactions: reactionsMap.get(message.id) ?? [],
            readBy: readByByMessageId.get(message.id) ?? [],
          };
        }),
      });
      res.headers.set("Cache-Control", "private, no-store");
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (channel) {
      // Channel content is private for subscribers (or owner) only.
      if (!channel.isSubscribed && channel.ownerId !== user.id) {
        const res = jsonOk({
          chatType: "channel",
          conversationId: `channel:${channel.id}`,
          channel: {
            id: channel.id,
            link: channel.link,
            name: channel.name,
            avatarUrl: channel.avatarUrl ?? generateDefaultAvatarDataUrl(channel.name, channel.link),
            ownerId: channel.ownerId,
            reactionMode: channel.reactionMode,
            allowedReactions: channel.allowedReactions,
            isSubscribed: channel.isSubscribed,
            subscribersCount: String(Number(channel.subscribersCount)),
            createdAt: channel.createdAt.toISOString(),
            myJoinedAt: channel.myJoinedAt ? channel.myJoinedAt.toISOString() : null,
          },
          messages: [],
        });
        res.headers.set("Cache-Control", "private, no-store");
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }

      const channelBeforeSql = hasValidBeforeDate ? Prisma.sql`AND "createdAt" < ${beforeDate as Date}` : Prisma.empty;
      const rawPosts = exactMessageId
        ? await prisma.$queryRaw<
            Array<{
              id: string;
              authorId: string;
              text: string | null;
              cipherText: string | null;
              iv: string | null;
              keyVersion: number | null;
              replyToMessageId: string | null;
              createdAt: Date;
              viewsCount: number;
            }>
          >`
            SELECT
              "id",
              "authorId",
              "text",
              "cipherText",
              "iv",
              "keyVersion",
              "replyToMessageId",
              "createdAt",
              "viewsCount"
            FROM "ChannelPost"
            WHERE "channelId" = ${channel.id}
              AND "id" = ${exactMessageId}
            LIMIT 1
          `
        : await prisma.$queryRaw<
        Array<{
          id: string;
          authorId: string;
          text: string | null;
          cipherText: string | null;
          iv: string | null;
          keyVersion: number | null;
          replyToMessageId: string | null;
          createdAt: Date;
          viewsCount: number;
        }>
      >`
        SELECT
          "id",
          "authorId",
          "text",
          "cipherText",
          "iv",
          "keyVersion",
          "replyToMessageId",
          "createdAt",
          "viewsCount"
        FROM "ChannelPost"
        WHERE "channelId" = ${channel.id}
        ${channelBeforeSql}
        ORDER BY "createdAt" DESC
        LIMIT ${messageLimit + 1}
      `;
      const hiddenMessageIds = await getHiddenMessageIdSet(user.id, "channel", rawPosts.map((post) => post.id));
      const visibleRawPosts = rawPosts.filter((post) => !hiddenMessageIds.has(post.id));
      const hasMoreBefore = !exactMessageId && rawPosts.length > messageLimit;
      const posts = exactMessageId ? visibleRawPosts.slice(0, 1) : visibleRawPosts.slice(0, messageLimit).reverse();

      let postsWithViews = posts;
      if (channel.isSubscribed && channel.ownerId !== user.id && posts.length > 0) {
        const ownerPostIds = posts.filter((post) => post.authorId === channel.ownerId).map((post) => post.id);
        if (ownerPostIds.length > 0) {
          for (const postId of ownerPostIds) {
            const viewId = randomUUID();
            await prisma.$executeRaw`
              INSERT INTO "ChannelPostView" ("id", "postId", "userId", "createdAt")
              VALUES (${viewId}, ${postId}, ${user.id}, NOW())
              ON CONFLICT ("postId", "userId") DO NOTHING
            `;
          }

          await prisma.$executeRaw`
            UPDATE "ChannelPost" cp
            SET "viewsCount" = agg."cnt" + (
              CASE WHEN EXISTS (
                SELECT 1 FROM "ChannelPostView" cpv2
                WHERE cpv2."postId" = cp."id" AND cpv2."userId" = cp."authorId"
              ) THEN 0 ELSE 1 END
            )
            FROM (
              SELECT cpv."postId", COUNT(*)::int AS "cnt"
              FROM "ChannelPostView" cpv
              WHERE cpv."postId" IN (${Prisma.join(ownerPostIds)})
              GROUP BY cpv."postId"
            ) agg
            WHERE cp."id" = agg."postId"
          `;

          const viewRows = await prisma.$queryRaw<Array<{ postId: string; count: number }>>`
            SELECT cp."id" AS "postId", cp."viewsCount" AS "count"
            FROM "ChannelPost" cp
            WHERE cp."id" IN (${Prisma.join(ownerPostIds)})
          `;
          const viewsByPostId = new Map(viewRows.map((row) => [row.postId, row.count]));
          postsWithViews = posts.map((post) => ({
            ...post,
            viewsCount: viewsByPostId.get(post.id) ?? post.viewsCount,
          }));
        }
      }
      const reactionsMap = await buildChannelPostReactions(
        postsWithViews.map((post) => post.id),
        user.id,
      );

      const isOwner = channel.ownerId === user.id;
      const mySub = await prisma.channelSubscriber.findFirst({
        where: { channelId: channel.id, userId: user.id },
        select: {
          role: true,
          roleLabel: true,
          canChangeAvatar: true,
          canChangeName: true,
          canChangeReactions: true,
          canPinMessages: true,
          canPostMessages: true,
          canEditForeignMessages: true,
          canDeleteForeignMessages: true,
          canAddMembers: true,
          canGenerateInviteLink: true,
          canManageAdmins: true,
        },
      });

      const res = jsonOk({
        chatType: "channel",
        conversationId: `channel:${channel.id}`,
        channel: {
          id: channel.id,
          link: channel.link,
          name: channel.name,
          avatarUrl: channel.avatarUrl ?? generateDefaultAvatarDataUrl(channel.name, channel.link),
          ownerId: channel.ownerId,
          reactionMode: channel.reactionMode,
          allowedReactions: channel.allowedReactions,
          isOwner,
          isSubscribed: channel.isSubscribed || isOwner,
          myRole: isOwner ? "owner" : (mySub?.role ?? "member"),
          myRoleLabel: isOwner ? "создатель" : (mySub?.roleLabel ?? null),
          myCanChangeAvatar: isOwner ? true : (mySub?.canChangeAvatar ?? false),
          myCanChangeName: isOwner ? true : (mySub?.canChangeName ?? false),
          myCanChangeReactions: isOwner ? true : (mySub?.canChangeReactions ?? false),
          myCanPinMessages: isOwner ? true : (mySub?.canPinMessages ?? false),
          myCanPostMessages: isOwner ? true : (mySub?.canPostMessages ?? false),
          myCanEditForeignMessages: isOwner ? true : (mySub?.canEditForeignMessages ?? false),
          myCanDeleteForeignMessages: isOwner ? true : (mySub?.canDeleteForeignMessages ?? false),
          myCanAddMembers: isOwner ? true : (mySub?.canAddMembers ?? false),
          myCanGenerateInviteLink: isOwner ? true : (mySub?.canGenerateInviteLink ?? false),
          myCanManageAdmins: isOwner ? true : (mySub?.canManageAdmins ?? false),
          subscribersCount: String(Number(channel.subscribersCount)),
          createdAt: channel.createdAt.toISOString(),
          myJoinedAt: channel.myJoinedAt ? channel.myJoinedAt.toISOString() : null,
        },
        hasMoreBefore,
        messages: postsWithViews.map((post) => ({
          id: post.id,
          senderId: post.authorId,
          text: publicEncryptedMessageText(post.text, post.cipherText),
          cipherText: post.cipherText,
          iv: post.iv,
          keyVersion: post.keyVersion,
          replyToMessageId: post.replyToMessageId,
          createdAt: post.createdAt.toISOString(),
          viewsCount: String(post.viewsCount),
          reactions: reactionsMap.get(post.id) ?? [],
        })),
      });
      res.headers.set("Cache-Control", "private, no-store");
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const publicGroup = await prisma.group.findUnique({
      where: { link },
      select: {
        id: true,
        link: true,
        name: true,
        avatarUrl: true,
        ownerId: true,
        reactionMode: true,
        allowedReactions: true,
        isPublic: true,
        createdAt: true,
      },
    });
    if (publicGroup) {
      const membersCount = await prisma.groupMember.count({ where: { groupId: publicGroup.id } });
      const res = jsonOk({
        chatType: "group",
        conversationId: `group:${publicGroup.id}`,
        group: {
          id: publicGroup.id,
          link: publicGroup.link,
          name: publicGroup.name,
          avatarUrl: publicGroup.avatarUrl ?? generateDefaultAvatarDataUrl(publicGroup.name, publicGroup.link),
          ownerId: publicGroup.ownerId,
          reactionMode: publicGroup.reactionMode,
          allowedReactions: publicGroup.allowedReactions,
          isPublic: publicGroup.isPublic,
          membersCount,
          isMember: false,
          myRole: null,
          myRoleLabel: null,
          myCanChangeAvatar: false,
          myCanChangeName: false,
          myCanChangeReactions: false,
          myCanPinMessages: false,
          myCanDeleteForeignMessages: false,
          myCanAddMembers: false,
          createdAt: publicGroup.createdAt.toISOString(),
          myJoinedAt: null,
        },
        hasMoreBefore: false,
        members: [],
        messages: [],
      });
      res.headers.set("Cache-Control", "private, no-store");
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    throw new HttpError(404, "Chat not found");
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    await enforceRateLimit({
      key: `rate:chat:send:${user.id}`,
      limit: 45,
      windowSeconds: 30,
      message: "Too many messages. Please slow down.",
    });
    const { link: rawLink } = await params;

    if (rawLink.startsWith("secret-")) {
      const secretChatId = rawLink.substring("secret-".length);
      const secretChat = await prisma.secretChat.findUnique({
        where: { id: secretChatId },
        include: {
          participants: true,
        },
      });
      if (!secretChat) {
        throw new HttpError(404, "Секретный чат не найден");
      }
      const ownPart = requireSecretChatAccess(secretChat, user.id, sessionId);
      if (secretChat.cryptoVersion === 2 && secretChat.participants.some(p => !p.deviceKeyId || !p.devicePublicKey)) {
        throw new HttpError(409, "Ключи устройств ещё не согласованы");
      }

      const body = directBodySchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const clientMessageId = body.clientMessageId || randomUUID();

      const textEnc = JSON.stringify({
        cipherText: body.cipherText || null,
        iv: body.iv || null,
        encryptedKeyForSender: body.encryptedKeyForSender || null,
        encryptedKeyForRecipient: body.encryptedKeyForRecipient || null,
      });

      const written = await writeSecretMessage({ chatId: secretChat.id, userId: user.id, sessionId, messageId: clientMessageId, textEnc });
      const created = written.message;
      const peerPart = written.peerPart;
      const peerId = peerPart.userId;
      if (written.isNew) await grantInteractionPresence(user.id, [peerId]);

      // The user channel is shared by all devices. Send only an invalidation;
      // ciphertext must be fetched through the session-bound secret-chat API.
      after(async () => { await triggerRealtimeEvent({
        channel: userPrivateChannel(peerId),
        name: "message:new",
        data: {
          chatType: "direct",
          id: created.id,
          senderId: user.id,
          fromLink: `secret-${secretChat.id}`,
          createdAt: created.createdAt.toISOString(),
        },
      }).catch(console.error); });

      const res = jsonOk({
        message: {
          id: created.id,
          senderId: user.id,
          cipherText: body.cipherText || null,
          iv: body.iv || null,
          encryptedKey: secretDeviceEnvelope(written.cryptoVersion, written.ownPart.deviceKeyId, body.encryptedKeyForSender || null),
          createdAt: created.createdAt.toISOString(),
        },
      });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    const preferredChatType = parsePreferredChatType(req.nextUrl.searchParams.get("chatType"));
    const savedDialogRequested = isSavedDialogRoute(rawLink, preferredChatType);
    const eclipseDialogRequested = isEclipseDialogRoute(rawLink, preferredChatType);
    const link = savedDialogRequested
      ? SAVED_DIALOG_LINK
      : eclipseDialogRequested
        ? ECLIPSE_DIALOG_LINK
        : normalizeLink(rawLink);

    if (eclipseDialogRequested) {
      throw new HttpError(403, "Cannot send messages to Eclipse");
    }

    const resolved = savedDialogRequested || eclipseDialogRequested
      ? { peer: null, memberGroup: null, channel: null }
      : await resolveChatTargets({
          currentUserId: user.id,
          link,
          preferredChatType,
        });
    const { peer, memberGroup, channel } = resolved;

    if (savedDialogRequested) {
      const payload = directBodySchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const [conversationId, senderKeyMeta] = await Promise.all([
        getOrCreateSavedDialog(user.id),
        resolveActiveUserKeyMeta(user.id),
      ]);
      const dedupKey = buildMessageSendDedupKey({
        userId: user.id,
        chatScope: `saved:${conversationId}`,
        clientMessageId: payload.clientMessageId,
      });
      const responsePayload = await withSendIdempotency(dedupKey, async () => {
        const messageId = randomUUID();
        const rows = await prisma.$queryRaw<
          Array<{
            id: string;
            senderId: string;
            cipherText: string;
            iv: string;
            encryptedKeyForSender: string;
            replyToMessageId: string | null;
            createdAt: Date;
          }>
        >`
          INSERT INTO "Message" (
            "id",
            "conversationId",
            "senderId",
            "senderKeyId",
            "senderKeyVersion",
            "recipientKeyId",
            "recipientKeyVersion",
            "encryptionScheme",
            "cipherText",
            "iv",
            "encryptedKeyForSender",
            "encryptedKeyForRecipient",
            "replyToMessageId",
            "createdAt"
          )
          VALUES (
            ${messageId},
            ${conversationId},
            ${user.id},
            ${senderKeyMeta?.id ?? null},
            ${senderKeyMeta?.version ?? null},
            ${senderKeyMeta?.id ?? null},
            ${senderKeyMeta?.version ?? null},
            ${"rsa-oaep-2048-sha256+a256gcm"},
            ${payload.cipherText},
            ${payload.iv},
            ${payload.encryptedKeyForSender},
            ${payload.encryptedKeyForRecipient},
            ${payload.replyToMessageId ?? null},
            NOW()
          )
          RETURNING
            "id",
            "senderId",
            "cipherText",
            "iv",
            "encryptedKeyForSender",
            "replyToMessageId",
            "createdAt"
        `;
        const created = rows[0];
        if (!created) {
          throw new HttpError(500, "Failed to send message");
        }
        await Promise.all([
          prisma.$executeRaw`UPDATE "Conversation" SET "updatedAt" = NOW() WHERE "id" = ${conversationId}`,
          invalidateChatListPayloadCache([user.id]),
        ]);
        return {
          chatType: "saved" as const,
          message: {
            id: created.id,
            senderId: created.senderId,
            cipherText: created.cipherText,
            iv: created.iv,
            encryptedKey: created.encryptedKeyForSender,
            replyToMessageId: created.replyToMessageId,
            createdAt: created.createdAt.toISOString(),
            reactions: [],
          },
        };
      });

      const res = jsonOk(responsePayload);
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (peer) {
      const payload = directBodySchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const [peerPublicKey, existingConversationId, privacyByUserId, senderKeyMeta, recipientKeyMeta] = await Promise.all([
        getUserPublicKey(peer.id),
        findDirectConversation(user.id, peer.id),
        getPrivacySettingsBatch([user.id, peer.id]),
        resolveActiveUserKeyMeta(user.id),
        resolveActiveUserKeyMeta(peer.id),
      ]);
      if (!peerPublicKey) throw new HttpError(409, "Recipient has not initialized E2E encryption");
      const recipientPrivacy = privacyByUserId.get(peer.id)!;
      const senderPrivacy = privacyByUserId.get(user.id)!;
      const existingConversationHasMessages = recipientPrivacy.firstMessagePolicy !== "all" && existingConversationId
        ? Boolean(
            await prisma.message.findFirst({
              where: { conversationId: existingConversationId },
              select: { id: true },
            }),
          )
        : false;
      if (!existingConversationHasMessages && !canUserStartConversation(user.id, peer.id, recipientPrivacy)) {
        throw new HttpError(403, "Пользователь ограничил новые сообщения");
      }
      const conversationId = existingConversationId ?? (await getOrCreateDirectConversation(user.id, peer.id));
      const dedupKey = buildMessageSendDedupKey({
        userId: user.id,
        chatScope: `direct:${conversationId}`,
        clientMessageId: payload.clientMessageId,
      });
      const responsePayload = await withSendIdempotency(dedupKey, async () => {
        const messageId = randomUUID();
        let rows: Array<{
          id: string;
          senderId: string;
          cipherText: string;
          iv: string;
          encryptedKeyForSender: string;
          replyToMessageId: string | null;
          createdAt: Date;
        }>;
        try {
          rows = await prisma.$queryRaw<
            Array<{
              id: string;
              senderId: string;
              cipherText: string;
              iv: string;
              encryptedKeyForSender: string;
              replyToMessageId: string | null;
              createdAt: Date;
            }>
          >`
            INSERT INTO "Message" (
              "id",
              "conversationId",
              "senderId",
              "senderKeyId",
              "senderKeyVersion",
              "recipientKeyId",
              "recipientKeyVersion",
              "encryptionScheme",
              "cipherText",
              "iv",
              "encryptedKeyForSender",
              "encryptedKeyForRecipient",
              "replyToMessageId",
              "createdAt"
            )
            VALUES (
              ${messageId},
              ${conversationId},
              ${user.id},
              ${senderKeyMeta?.id ?? null},
              ${senderKeyMeta?.version ?? null},
              ${recipientKeyMeta?.id ?? null},
              ${recipientKeyMeta?.version ?? null},
              ${"rsa-oaep-2048-sha256+a256gcm"},
              ${payload.cipherText},
              ${payload.iv},
              ${payload.encryptedKeyForSender},
              ${payload.encryptedKeyForRecipient},
              ${payload.replyToMessageId ?? null},
              NOW()
            )
            RETURNING
              "id",
              "senderId",
              "cipherText",
              "iv",
              "encryptedKeyForSender",
              "replyToMessageId",
              "createdAt"
          `;
        } catch (error) {
          const code = (error as { code?: unknown })?.code;
          if (code !== "P2010" && code !== "P2022") throw error;
          rows = await prisma.$queryRaw<
            Array<{
              id: string;
              senderId: string;
              cipherText: string;
              iv: string;
              encryptedKeyForSender: string;
              replyToMessageId: string | null;
              createdAt: Date;
            }>
          >`
            INSERT INTO "Message" (
              "id",
              "conversationId",
              "senderId",
              "cipherText",
              "iv",
              "encryptedKeyForSender",
              "encryptedKeyForRecipient",
              "replyToMessageId",
              "createdAt"
            )
            VALUES (
              ${messageId},
              ${conversationId},
              ${user.id},
              ${payload.cipherText},
              ${payload.iv},
              ${payload.encryptedKeyForSender},
              ${payload.encryptedKeyForRecipient},
              ${payload.replyToMessageId ?? null},
              NOW()
            )
            RETURNING
              "id",
              "senderId",
              "cipherText",
              "iv",
              "encryptedKeyForSender",
              "replyToMessageId",
              "createdAt"
          `;
        }
        const created = rows[0];
        if (!created) {
          throw new HttpError(500, "Failed to send message");
        }

        await Promise.all([
          prisma.$executeRaw`UPDATE "Conversation" SET "updatedAt" = NOW() WHERE "id" = ${conversationId}`,
          invalidateChatListPayloadCache([user.id, peer.id]),
          grantInteractionPresence(user.id, [peer.id]),
        ]);
        void Promise.allSettled([
          scheduleDirectChatAutoDelete(user.id, conversationId, senderPrivacy.newChatAutoDeleteDays),
          scheduleDirectChatAutoDelete(peer.id, conversationId, recipientPrivacy.newChatAutoDeleteDays),
        ]);

        if (!senderPrivacy.showReadReceipts) {
          after(async () => {
            const acknowledgedMessages = await prisma.message.findMany({
              where: {
                conversationId,
                senderId: peer.id,
                createdAt: { lte: created.createdAt },
              },
              select: { id: true },
            });
            if (acknowledgedMessages.length === 0) return;
            if (senderPrivacy.autoDeleteReadMessages) {
              await prisma.hiddenChatMessage.createMany({
                data: acknowledgedMessages.map((message) => ({
                  userId: user.id,
                  chatType: "direct",
                  messageId: message.id,
                })),
                skipDuplicates: true,
              });
            }
            await prisma.$executeRaw`
              UPDATE "ConversationParticipant"
              SET "lastReadAt" = ${created.createdAt}
              WHERE "conversationId" = ${conversationId}
                AND "userId" = ${user.id}
                AND ("lastReadAt" IS NULL OR "lastReadAt" < ${created.createdAt})
            `;
            await triggerRealtimeEvent({
              channel: userPrivateChannel(peer.id),
              name: "message:read",
              data: {
                chatType: "direct",
                fromUserId: user.id,
                fromLink: user.link,
                messageIds: acknowledgedMessages.map((message) => message.id),
                at: created.createdAt.toISOString(),
              },
            });
          });
        }

        const compactRealtimePayload =
          created.cipherText.length > REALTIME_CIPHERTEXT_BUDGET_CHARS ||
          payload.encryptedKeyForRecipient.length > 8_000;
        const compactSenderPayload =
          created.cipherText.length > REALTIME_CIPHERTEXT_BUDGET_CHARS ||
          (created.encryptedKeyForSender?.length ?? 0) > 8_000;

        after(async () => {
          const peerParticipant = await prisma.conversationParticipant.findFirst({
            where: { conversationId, userId: peer.id },
            select: { lastReadAt: true },
          });
          const peerRecentlyActive =
            peerParticipant?.lastReadAt &&
            Date.now() - peerParticipant.lastReadAt.getTime() < 10000;

          await Promise.allSettled([
            triggerRealtimeEvent({
              channel: userPrivateChannel(peer.id),
              name: "message:new",
              data: {
                chatType: "direct",
                id: created.id,
                senderId: created.senderId,
                fromLink: user.link,
                fromDisplayName: getPrivacyDisplayName(peer.id, user.id, user.displayName, senderPrivacy),
                ...(compactRealtimePayload
                  ? {}
                  : {
                      cipherText: created.cipherText,
                      iv: created.iv,
                      encryptedKey: payload.encryptedKeyForRecipient,
                    }),
                replyToMessageId: created.replyToMessageId,
                createdAt: created.createdAt.toISOString(),
              },
            }),
            triggerRealtimeEvent({
              channel: userPrivateChannel(user.id),
              name: "message:new",
              data: {
                chatType: "direct",
                id: created.id,
                senderId: created.senderId,
                fromLink: peer.link,
                peerLink: peer.link,
                fromDisplayName: peer.displayName,
                ...(compactSenderPayload
                  ? {}
                  : {
                      cipherText: created.cipherText,
                      iv: created.iv,
                      encryptedKey: created.encryptedKeyForSender,
                    }),
                replyToMessageId: created.replyToMessageId,
                createdAt: created.createdAt.toISOString(),
              },
            }),
            ...(peerRecentlyActive
              ? []
              : [
                  publishBeamsMessageToUser(peer.id, {
                    messageId: created.id,
                    chatId: user.link,
                    senderId: created.senderId,
                    senderName: getPrivacyDisplayName(peer.id, user.id, user.displayName, senderPrivacy),
                    senderAvatar: user.avatarUrl ?? null,
                    text: "New message",
                    createdAt: created.createdAt.toISOString(),
                    deepLink: `/chat/${encodeURIComponent(user.link)}`,
                    cipherText: created.cipherText || null,
                    iv: created.iv || null,
                    encryptedKey: payload.encryptedKeyForRecipient || null,
                  }),
                ]),
          ]);
        });

        return {
          chatType: "direct" as const,
          message: {
            id: created.id,
            senderId: created.senderId,
            cipherText: created.cipherText,
            iv: created.iv,
            encryptedKey: created.encryptedKeyForSender,
            replyToMessageId: created.replyToMessageId,
            createdAt: created.createdAt.toISOString(),
            reactions: [],
          },
        };
      });

      const res = jsonOk(responsePayload);
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (memberGroup) {
      const isOwner = memberGroup.ownerId === user.id;
      const canPost = isOwner || memberGroup.myCanPostMessages;
      if (!canPost) {
        throw new HttpError(403, "You do not have permission to send messages in this group");
      }
      const payload = groupBodySchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const dedupKey = buildMessageSendDedupKey({
        userId: user.id,
        chatScope: `group:${memberGroup.id}`,
        clientMessageId: payload.clientMessageId,
      });
      const responsePayload = await withSendIdempotency(dedupKey, async () => {
        const messageId = randomUUID();
        const rows = await prisma.$queryRaw<
          Array<{
            id: string;
            senderId: string;
            text: string | null;
            cipherText: string | null;
            iv: string | null;
            keyVersion: number | null;
            replyToMessageId: string | null;
            createdAt: Date;
          }>
        >`
          INSERT INTO "GroupMessage" ("id", "groupId", "senderId", "text", "cipherText", "iv", "keyVersion", "replyToMessageId", "createdAt")
          VALUES (
            ${messageId},
            ${memberGroup.id},
            ${user.id},
            ${null},
            ${payload.cipherText ?? null},
            ${payload.iv ?? null},
            ${payload.keyVersion ?? null},
            ${payload.replyToMessageId ?? null},
            NOW()
          )
          RETURNING "id", "senderId", "text", "cipherText", "iv", "keyVersion", "replyToMessageId", "createdAt"
        `;
        const created = rows[0];
        if (!created) {
          throw new HttpError(500, "Failed to send message");
        }

        await Promise.all([
          prisma.$executeRaw`UPDATE "Group" SET "updatedAt" = NOW() WHERE "id" = ${memberGroup.id}`,
          invalidateChatListPayloadCache([user.id]),
        ]);

        const allowRealtimeText = (created.text ?? "").length <= REALTIME_TEXT_BUDGET_CHARS;
        const allowRealtimeCipher =
          (created.cipherText?.length ?? 0) <= REALTIME_CIPHERTEXT_BUDGET_CHARS &&
          (created.iv?.length ?? 0) <= 1000;
        after(async () => {
          const [recipients, senderPrivacy] = await Promise.all([
            prisma.$queryRaw<
              Array<{
                userId: string;
                alias: string | null;
              }>
            >`
              SELECT gm."userId", c."alias"
              FROM "GroupMember" gm
              LEFT JOIN "Contact" c ON c."ownerId" = gm."userId" AND c."peerId" = ${user.id}
              WHERE gm."groupId" = ${memberGroup.id} AND gm."userId" <> ${user.id}
            `,
            getPrivacySettings(user.id),
          ]);

          const [readMarkers] = await Promise.all([
            getGroupReadMarkersForUsers(recipients.map(r => r.userId), memberGroup.id),
            invalidateChatListPayloadCache(recipients.map(r => r.userId)),
            grantInteractionPresence(user.id, recipients.map(r => r.userId)),
          ]);

          // Only recipients with identical authorized payloads share a broadcast.
          // Each contact alias remains specific to the recipient who chose it.
          const channelsByName = new Map<string, string[]>([[user.displayName, [userPrivateChannel(user.id)]]]);
          for (const recipient of recipients) {
            const name = recipient.alias || getPrivacyDisplayName(recipient.userId, user.id, user.displayName, senderPrivacy);
            const channels = channelsByName.get(name) ?? [];
            channels.push(userPrivateChannel(recipient.userId)); channelsByName.set(name, channels);
          }
          const realtimeDelivery = Promise.allSettled([...channelsByName].map(([senderDisplayName, channels]) =>
            triggerRealtimeChannels({ channels, name: "message:new", data: {
              chatType: "group",
              id: created.id,
              senderId: created.senderId,
              fromLink: user.link,
              fromDisplayName: senderDisplayName,
              groupLink: memberGroup.link,
              ...(allowRealtimeText && created.text && !created.cipherText ? { text: created.text } : {}),
              ...(allowRealtimeCipher && created.cipherText && created.iv && created.keyVersion
                ? { cipherText: created.cipherText, iv: created.iv, keyVersion: created.keyVersion }
                : {}),
              replyToMessageId: created.replyToMessageId,
              createdAt: created.createdAt.toISOString(),
            } }),
          ));

          await Promise.allSettled(
            recipients.map(async (recipient: (typeof recipients)[number]) => {
              const senderDisplayName = recipient.alias || getPrivacyDisplayName(recipient.userId, user.id, user.displayName, senderPrivacy);

              const lastRead = readMarkers.get(recipient.userId);
              const isRecentlyActive = lastRead && Date.now() - lastRead.getTime() < 10000;
              if (!isRecentlyActive) {
                try {
                  await publishBeamsMessageToUser(recipient.userId, {
                    messageId: created.id,
                    chatId: memberGroup.link,
                    senderId: created.senderId,
                    senderName: senderDisplayName,
                    senderAvatar: user.avatarUrl ?? null,
                    text: created.text ?? "New message",
                    createdAt: created.createdAt.toISOString(),
                    deepLink: `/chat/${encodeURIComponent(memberGroup.link)}`,
                    cipherText: created.cipherText || null,
                    iv: created.iv || null,
                    keyVersion: created.keyVersion || null,
                  });
                } catch {
                  // ignore push transport failures
                }
              }
            }),
          );
          await realtimeDelivery;
        });

        return {
          chatType: "group" as const,
          message: {
            id: created.id,
            senderId: created.senderId,
            text: publicEncryptedMessageText(created.text, created.cipherText),
            cipherText: created.cipherText,
            iv: created.iv,
            keyVersion: created.keyVersion,
            replyToMessageId: created.replyToMessageId,
            senderDisplayName: user.displayName,
            createdAt: created.createdAt.toISOString(),
            reactions: [],
          },
        };
      });

      const res = jsonOk(responsePayload);
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (channel) {
      const subRows = await prisma.$queryRaw<Array<{ role: string; canPostMessages: boolean }>>`
        SELECT "role", "canPostMessages" FROM "ChannelSubscriber"
        WHERE "channelId" = ${channel.id} AND "userId" = ${user.id}
        LIMIT 1
      `;
      const sub = subRows[0] ?? null;
      const isOwner = channel.ownerId === user.id;
      const canPost = isOwner || (sub?.role === "admin" && sub?.canPostMessages);

      if (!canPost) {
        throw new HttpError(403, "Only the channel owner or admins with post permissions can publish posts");
      }

      const payload = channelBodySchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const dedupKey = buildMessageSendDedupKey({
        userId: user.id,
        chatScope: `channel:${channel.id}`,
        clientMessageId: payload.clientMessageId,
      });
      const responsePayload = await withSendIdempotency(dedupKey, async () => {
        const postId = randomUUID();
        const rows = await prisma.$queryRaw<
          Array<{
            id: string;
            authorId: string;
            text: string | null;
            cipherText: string | null;
            iv: string | null;
            keyVersion: number | null;
            replyToMessageId: string | null;
            createdAt: Date;
            viewsCount: number;
          }>
        >`
          INSERT INTO "ChannelPost" ("id", "channelId", "authorId", "text", "cipherText", "iv", "keyVersion", "replyToMessageId", "viewsCount", "createdAt")
          VALUES (
            ${postId},
            ${channel.id},
            ${user.id},
            ${null},
            ${payload.cipherText ?? null},
            ${payload.iv ?? null},
            ${payload.keyVersion ?? null},
            ${payload.replyToMessageId ?? null},
            1,
            NOW()
          )
          RETURNING "id", "authorId", "text", "cipherText", "iv", "keyVersion", "replyToMessageId", "createdAt", "viewsCount"
        `;
        const created = rows[0];
        if (!created) {
          throw new HttpError(500, "Failed to publish post");
        }

        const viewId = randomUUID();
        await prisma.$executeRaw`
          INSERT INTO "ChannelPostView" ("id", "postId", "userId", "createdAt")
          VALUES (${viewId}, ${postId}, ${user.id}, NOW())
          ON CONFLICT ("postId", "userId") DO NOTHING
        `;

        await Promise.all([
          prisma.$executeRaw`UPDATE "Channel" SET "updatedAt" = NOW() WHERE "id" = ${channel.id}`,
          invalidateChatListPayloadCache([user.id]),
        ]);

        const allowRealtimeText = (created.text ?? "").length <= REALTIME_TEXT_BUDGET_CHARS;
        const allowRealtimeCipher =
          (created.cipherText?.length ?? 0) <= REALTIME_CIPHERTEXT_BUDGET_CHARS &&
          (created.iv?.length ?? 0) <= 1000;

        after(async () => {
          const recipients = await prisma.$queryRaw<Array<{ userId: string }>>`
            SELECT "userId"
            FROM "ChannelSubscriber"
            WHERE "channelId" = ${channel.id}
              AND "userId" <> ${user.id}
          `;
          await invalidateChatListPayloadCache(recipients.map(recipient => recipient.userId));

          // Emit realtime event to author's own channel for other devices
          const realtimeDelivery = triggerRealtimeChannels({
            channels: [userPrivateChannel(user.id), ...recipients.map(recipient => userPrivateChannel(recipient.userId))],
            name: "message:new",
            data: {
              chatType: "channel",
              id: created.id,
              senderId: created.authorId,
              fromLink: user.link,
              groupLink: channel.link,
              ...(allowRealtimeText && created.text && !created.cipherText ? { text: created.text } : {}),
              ...(allowRealtimeCipher && created.cipherText && created.iv && created.keyVersion
                ? { cipherText: created.cipherText, iv: created.iv, keyVersion: created.keyVersion }
                : {}),
              replyToMessageId: created.replyToMessageId,
              createdAt: created.createdAt.toISOString(),
              viewsCount: String(created.viewsCount),
            },
          }).catch(() => undefined);
          const readMarkers = await getChannelReadMarkersForUsers(recipients.map(recipient => recipient.userId), channel.id);

          await Promise.allSettled(
            recipients.map(async (recipient) => {
              const lastRead = readMarkers.get(recipient.userId);
              const isRecentlyActive = lastRead && Date.now() - lastRead.getTime() < 10000;
              if (!isRecentlyActive) {
                try {
                  await publishBeamsMessageToUser(recipient.userId, {
                    messageId: created.id,
                    chatId: channel.link,
                    senderId: created.authorId,
                    senderName: channel.name,
                    senderAvatar: channel.avatarUrl ?? user.avatarUrl ?? null,
                    text: created.text ?? "New message",
                    createdAt: created.createdAt.toISOString(),
                    deepLink: `/chat/${encodeURIComponent(channel.link)}`,
                    cipherText: created.cipherText || null,
                    iv: created.iv || null,
                    keyVersion: created.keyVersion || null,
                  });
                } catch {
                  // ignore push transport failures
                }
              }
            }),
          );
          await realtimeDelivery;
        });

        return {
          chatType: "channel" as const,
          message: {
            id: created.id,
            senderId: created.authorId,
            text: publicEncryptedMessageText(created.text, created.cipherText),
            cipherText: created.cipherText,
            iv: created.iv,
            keyVersion: created.keyVersion,
            replyToMessageId: created.replyToMessageId,
            createdAt: created.createdAt.toISOString(),
            viewsCount: String(created.viewsCount),
            reactions: [],
          },
        };
      });

      const res = jsonOk(responsePayload);
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (await groupExistsByLink(link)) {
      throw new HttpError(403, "You are not a member of this group");
    }

    throw new HttpError(404, "Chat not found");
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    await enforceRateLimit({
      key: `rate:chat:delete:${user.id}`,
      limit: 30,
      windowSeconds: 30,
      message: "Too many delete requests. Please slow down.",
    });
    const { link: rawLink } = await params;
    if (rawLink.startsWith("secret-")) {
      const secretChatId = rawLink.substring("secret-".length);
      const secretChat = await prisma.secretChat.findUnique({
        where: { id: secretChatId },
        include: { participants: true },
      });
      if (secretChat) {
        requireSecretChatAccess(secretChat, user.id, sessionId, true);
        await prisma.secretChat.update({
          where: { id: secretChatId },
          data: { expiresAt: new Date() },
        });
        await Promise.all(
          secretChat.participants.map(async (p) => {
            try {
              await triggerRealtimeEvent({
                channel: userPrivateChannel(p.userId),
                name: "secret:deleted",
                data: {
                  secretChatId,
                },
              });
            } catch {}
          })
        );
      }
      const res = jsonOk({ success: true });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }
    const preferredChatType = parsePreferredChatType(req.nextUrl.searchParams.get("chatType"));
    const deleteScope = req.nextUrl.searchParams.get("scope")?.trim();
    const savedDialogRequested = isSavedDialogRoute(rawLink, preferredChatType);
    const eclipseDialogRequested = isEclipseDialogRoute(rawLink, preferredChatType);
    const link = savedDialogRequested
      ? SAVED_DIALOG_LINK
      : eclipseDialogRequested
        ? ECLIPSE_DIALOG_LINK
        : normalizeLink(rawLink);

    const resolved = savedDialogRequested || eclipseDialogRequested
      ? { peer: null, memberGroup: null, channel: null }
      : await resolveChatTargets({
          currentUserId: user.id,
          link,
          preferredChatType,
        });
    const { peer, memberGroup, channel } = resolved;

    if (deleteScope === "chat") {
      if (eclipseDialogRequested) {
        const conversationId = await getOrCreateEclipseDialog(user.id);
        const messageIds = await prisma.message.findMany({
          where: {
            conversationId,
            isSystemMessage: true,
          },
          select: { id: true },
        });
        if (messageIds.length > 0) {
          await prisma.hiddenChatMessage.createMany({
            data: messageIds.map((message) => ({
              userId: user.id,
              chatType: "eclipse",
              messageId: message.id,
            })),
            skipDuplicates: true,
          });
        }
        await invalidateChatListPayloadCache(user.id);
        const res = jsonOk({ deleted: true, scope: "chat" });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
      if (!peer) {
        throw new HttpError(400, "Chat deletion is supported only for direct chats");
      }
      const conversationId = await findDirectConversation(user.id, peer.id);
      if (!conversationId) {
        const res = jsonOk({ deleted: true, scope: "chat" });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }

      const messageIds = await prisma.message.findMany({
        where: { conversationId },
        select: { id: true },
      });

      await prisma.$transaction(async (tx) => {
        if (messageIds.length > 0) {
          await tx.hiddenChatMessage.deleteMany({
            where: {
              chatType: "direct",
              messageId: { in: messageIds.map((message) => message.id) },
            },
          });
        }
        await tx.conversation.deleteMany({
          where: {
            id: conversationId,
            type: "direct",
            participants: {
              some: { userId: user.id },
            },
          },
        });
      });

      void invalidateChatListPayloadCache([user.id, peer.id]).catch(() => {
        // cache invalidation is best-effort
      });

      void triggerRealtimeEvent({
        channel: userPrivateChannel(peer.id),
        name: "chat:deleted",
        data: {
          chatType: "direct",
          fromUserId: user.id,
          fromLink: user.link,
        },
      }).catch(() => {
        // ignore realtime transport failures
      });

      const res = jsonOk({ deleted: true, scope: "chat" });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const payload = deleteBodySchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
    const deleteMode = payload.mode ?? "everyone";

    if (eclipseDialogRequested) {
      const conversationId = await getOrCreateEclipseDialog(user.id);
      const message = await prisma.message.findFirst({
        where: {
          id: payload.messageId,
          conversationId,
          isSystemMessage: true,
        },
        select: { id: true },
      });
      if (!message) {
        throw new HttpError(404, "Message not found");
      }
      await prisma.hiddenChatMessage.upsert({
        where: {
          userId_chatType_messageId: {
            userId: user.id,
            chatType: "eclipse",
            messageId: message.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          chatType: "eclipse",
          messageId: message.id,
        },
      });
      await invalidateChatListPayloadCache(user.id);
      const res = jsonOk({ deleted: true, mode: deleteMode, messageId: message.id });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (savedDialogRequested) {
      const conversationId = await getOrCreateSavedDialog(user.id);
      if (deleteMode === "mine") {
        const message = await prisma.message.findFirst({
          where: {
            id: payload.messageId,
            conversationId,
          },
          select: { id: true },
        });
        if (!message) {
          throw new HttpError(404, "Message not found");
        }
        await prisma.hiddenChatMessage.upsert({
          where: {
            userId_chatType_messageId: {
              userId: user.id,
              chatType: "saved",
              messageId: message.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            chatType: "saved",
            messageId: message.id,
          },
        });
        const res = jsonOk({ deleted: true, mode: "mine", messageId: message.id });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
      const message = await prisma.message.findFirst({
        where: {
          id: payload.messageId,
          conversationId,
          senderId: user.id,
        },
        select: { id: true },
      });
      if (!message) {
        const res = jsonOk({ deleted: true, alreadyDeleted: true, messageId: payload.messageId });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
      await prisma.message.delete({ where: { id: message.id } });
      const res = jsonOk({ deleted: true, messageId: message.id });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (peer) {
      const conversationId = await getOrCreateDirectConversation(user.id, peer.id);
      if (deleteMode === "mine") {
        const message = await prisma.message.findFirst({
          where: {
            id: payload.messageId,
            conversationId,
          },
          select: { id: true },
        });
        if (!message) {
          const res = jsonOk({ deleted: true, alreadyDeleted: true, messageId: payload.messageId });
          ensureCsrfCookie(req, res);
          return applyCors(req, res);
        }
        await prisma.hiddenChatMessage.upsert({
          where: {
            userId_chatType_messageId: {
              userId: user.id,
              chatType: "direct",
              messageId: message.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            chatType: "direct",
            messageId: message.id,
          },
        });
        const res = jsonOk({ deleted: true, mode: "mine", messageId: message.id });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
      const message = await prisma.message.findFirst({
        where: {
          id: payload.messageId,
          conversationId,
        },
        select: {
          id: true,
        },
      });

      if (!message) {
        const res = jsonOk({ deleted: true, alreadyDeleted: true, messageId: payload.messageId });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }

      await prisma.message.delete({
        where: {
          id: message.id,
        },
      });

      void triggerRealtimeEvent({
        channel: userPrivateChannel(peer.id),
        name: "message:deleted",
        data: {
          chatType: "direct",
          id: message.id,
          fromUserId: user.id,
          fromLink: user.link,
        },
      }).catch(() => {
        // ignore realtime transport failures
      });

      const res = jsonOk({ deleted: true, messageId: message.id });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (memberGroup) {
      if (deleteMode === "mine") {
        const rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "GroupMessage"
          WHERE "id" = ${payload.messageId}
            AND "groupId" = ${memberGroup.id}
          LIMIT 1
        `;
        const message = rows[0] ?? null;
        if (!message) {
          const res = jsonOk({ deleted: true, alreadyDeleted: true, messageId: payload.messageId });
          ensureCsrfCookie(req, res);
          return applyCors(req, res);
        }
        await prisma.hiddenChatMessage.upsert({
          where: {
            userId_chatType_messageId: {
              userId: user.id,
              chatType: "group",
              messageId: message.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            chatType: "group",
            messageId: message.id,
          },
        });
        const res = jsonOk({ deleted: true, mode: "mine", messageId: message.id });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
      const canModerate = memberGroup.myRole === "owner" || memberGroup.myCanDeleteForeignMessages;
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "GroupMessage"
        WHERE "id" = ${payload.messageId}
          AND "groupId" = ${memberGroup.id}
          ${canModerate ? Prisma.empty : Prisma.sql`AND "senderId" = ${user.id}`}
        LIMIT 1
      `;
      const message = rows[0] ?? null;
      if (!message) {
        const res = jsonOk({ deleted: true, alreadyDeleted: true, messageId: payload.messageId });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }

      await prisma.$executeRaw`
        DELETE FROM "GroupMessage"
        WHERE "id" = ${message.id}
      `;

      const recipients = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM "GroupMember"
        WHERE "groupId" = ${memberGroup.id}
          AND "userId" <> ${user.id}
      `;

      void Promise.allSettled(
        recipients.map(async (recipient: (typeof recipients)[number]) => {
          try {
            await triggerRealtimeEvent({
              channel: userPrivateChannel(recipient.userId),
              name: "message:deleted",
              data: {
                chatType: "group",
                id: message.id,
                fromUserId: user.id,
                fromLink: user.link,
                groupLink: memberGroup.link,
              },
            });
          } catch {
            // ignore realtime transport failures
          }
        }),
      );

      const res = jsonOk({ deleted: true, messageId: message.id });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (channel) {
      if (deleteMode === "mine") {
        const rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "ChannelPost"
          WHERE "id" = ${payload.messageId}
            AND "channelId" = ${channel.id}
          LIMIT 1
        `;
        const post = rows[0] ?? null;
        if (!post) {
          const res = jsonOk({ deleted: true, alreadyDeleted: true, messageId: payload.messageId });
          ensureCsrfCookie(req, res);
          return applyCors(req, res);
        }
        await prisma.hiddenChatMessage.upsert({
          where: {
            userId_chatType_messageId: {
              userId: user.id,
              chatType: "channel",
              messageId: post.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            chatType: "channel",
            messageId: post.id,
          },
        });
        const res = jsonOk({ deleted: true, mode: "mine", messageId: post.id });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
      const subRows = await prisma.$queryRaw<Array<{ role: string; canDeleteForeignMessages: boolean }>>`
        SELECT "role", "canDeleteForeignMessages" FROM "ChannelSubscriber"
        WHERE "channelId" = ${channel.id} AND "userId" = ${user.id}
        LIMIT 1
      `;
      const sub = subRows[0] ?? null;
      const isOwner = channel.ownerId === user.id;

      const rows = await prisma.$queryRaw<Array<{ id: string; authorId: string }>>`
        SELECT "id", "authorId"
        FROM "ChannelPost"
        WHERE "id" = ${payload.messageId}
          AND "channelId" = ${channel.id}
        LIMIT 1
      `;
      const post = rows[0] ?? null;
      if (!post) {
        const res = jsonOk({ deleted: true, alreadyDeleted: true, messageId: payload.messageId });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }

      const isAuthor = post.authorId === user.id;
      const canDelete = isOwner || isAuthor || (sub?.role === "admin" && sub?.canDeleteForeignMessages);

      if (!canDelete) {
        throw new HttpError(403, "You do not have permission to delete this post");
      }

      await prisma.$executeRaw`
        DELETE FROM "ChannelPost"
        WHERE "id" = ${post.id}
      `;

      const recipients = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM "ChannelSubscriber"
        WHERE "channelId" = ${channel.id}
          AND "userId" <> ${user.id}
      `;

      void Promise.allSettled(
        recipients.map(async (recipient) => {
          try {
            await triggerRealtimeEvent({
              channel: userPrivateChannel(recipient.userId),
              name: "message:deleted",
              data: {
                chatType: "channel",
                id: post.id,
                fromUserId: user.id,
                fromLink: user.link,
                groupLink: channel.link,
              },
            });
          } catch {
            // ignore realtime transport failures
          }
        }),
      );

      const res = jsonOk({ deleted: true, messageId: post.id });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (await groupExistsByLink(link)) {
      throw new HttpError(403, "You are not a member of this group");
    }

    throw new HttpError(404, "Chat not found");
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    await enforceRateLimit({
      key: `rate:chat:edit:${user.id}`,
      limit: 40,
      windowSeconds: 30,
      message: "Too many edit requests. Please slow down.",
    });
    const { link: rawLink } = await params;
    const preferredChatType = parsePreferredChatType(req.nextUrl.searchParams.get("chatType"));
    const savedDialogRequested = isSavedDialogRoute(rawLink, preferredChatType);
    const eclipseDialogRequested = isEclipseDialogRoute(rawLink, preferredChatType);
    const link = savedDialogRequested
      ? SAVED_DIALOG_LINK
      : eclipseDialogRequested
        ? ECLIPSE_DIALOG_LINK
        : normalizeLink(rawLink);

    if (eclipseDialogRequested) {
      throw new HttpError(403, "Eclipse messages cannot be edited");
    }

    const resolved = savedDialogRequested || eclipseDialogRequested
      ? { peer: null, memberGroup: null, channel: null }
      : await resolveChatTargets({
          currentUserId: user.id,
          link,
          preferredChatType,
        });
    const { peer, memberGroup, channel } = resolved;
    const cutoff = new Date(Date.now() - EDIT_WINDOW_MS);

    if (savedDialogRequested) {
      const payload = editDirectSchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const conversationId = await getOrCreateSavedDialog(user.id);
      const message = await prisma.message.findFirst({
        where: {
          id: payload.messageId,
          conversationId,
          senderId: user.id,
          createdAt: { gte: cutoff },
        },
        select: { id: true },
      });

      if (!message) {
        throw new HttpError(404, "Message not found or cannot be edited");
      }

      await prisma.message.update({
        where: { id: message.id },
        data: {
          cipherText: payload.cipherText,
          iv: payload.iv,
          encryptedKeyForSender: payload.encryptedKeyForSender,
          encryptedKeyForRecipient: payload.encryptedKeyForRecipient,
        },
      });

      const res = jsonOk({ updated: true, messageId: message.id });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (peer) {
      const payload = editDirectSchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const conversationId = await getOrCreateDirectConversation(user.id, peer.id);
      const message = await prisma.message.findFirst({
        where: {
          id: payload.messageId,
          conversationId,
          senderId: user.id,
          createdAt: { gte: cutoff },
        },
        select: { id: true, createdAt: true, replyToMessageId: true },
      });

      if (!message) {
        throw new HttpError(404, "Message not found or cannot be edited");
      }

      await prisma.message.update({
        where: { id: message.id },
        data: {
          cipherText: payload.cipherText,
          iv: payload.iv,
          encryptedKeyForSender: payload.encryptedKeyForSender,
          encryptedKeyForRecipient: payload.encryptedKeyForRecipient,
        },
        select: { id: true },
      });

      void triggerRealtimeEvent({
        channel: userPrivateChannel(peer.id),
        name: "message:edited",
        data: {
          chatType: "direct",
          id: message.id,
          senderId: user.id,
          fromLink: user.link,
          cipherText: payload.cipherText,
          iv: payload.iv,
          encryptedKey: payload.encryptedKeyForRecipient,
          createdAt: message.createdAt.toISOString(),
          replyToMessageId: message.replyToMessageId,
        },
      }).catch(() => {
        // ignore realtime transport failures
      });

      const res = jsonOk({ updated: true, messageId: message.id });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (memberGroup) {
      const payload = editGroupSchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const rows = await withSharedMessageEdit("group", memberGroup.id, user.id, user.id, async tx => tx.$queryRaw<
        Array<{
          id: string;
          senderId: string;
          text: string | null;
          cipherText: string | null;
          iv: string | null;
          keyVersion: number | null;
          replyToMessageId: string | null;
          createdAt: Date;
        }>
      >`
        UPDATE "GroupMessage"
        SET
          "text" = ${null},
          "cipherText" = ${payload.cipherText ?? null},
          "iv" = ${payload.iv ?? null},
          "keyVersion" = ${payload.keyVersion ?? null}
        WHERE "id" = ${payload.messageId}
          AND "groupId" = ${memberGroup.id}
          AND "senderId" = ${user.id}
          AND "createdAt" >= ${cutoff}
        RETURNING "id", "senderId", "text", "cipherText", "iv", "keyVersion", "replyToMessageId", "createdAt"
      `);
      const message = rows[0] ?? null;
      if (!message) {
        throw new HttpError(404, "Message not found or cannot be edited");
      }

      const recipients = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM "GroupMember"
        WHERE "groupId" = ${memberGroup.id}
          AND "userId" <> ${user.id}
      `;
      const allowRealtimeCipher =
        (message.cipherText?.length ?? 0) <= REALTIME_CIPHERTEXT_BUDGET_CHARS &&
        (message.iv?.length ?? 0) <= 1000;

      void Promise.allSettled(
        recipients.map(async (recipient) => {
          try {
            await triggerRealtimeEvent({
              channel: userPrivateChannel(recipient.userId),
              name: "message:edited",
              data: {
                chatType: "group",
                id: message.id,
                senderId: user.id,
                fromLink: user.link,
                groupLink: memberGroup.link,
                ...(message.text && !message.cipherText ? { text: message.text } : {}),
                ...(allowRealtimeCipher && message.cipherText && message.iv && message.keyVersion
                  ? { cipherText: message.cipherText, iv: message.iv, keyVersion: message.keyVersion }
                  : {}),
                createdAt: message.createdAt.toISOString(),
                replyToMessageId: message.replyToMessageId,
              },
            });
          } catch {
            // ignore realtime transport failures
          }
        }),
      );

      const res = jsonOk({
        updated: true,
        messageId: message.id,
        text: publicEncryptedMessageText(message.text, message.cipherText),
        cipherText: message.cipherText,
        iv: message.iv,
        keyVersion: message.keyVersion,
      });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (channel) {
      const payload = editGroupSchema.parse(await readJsonBody(req, 2 * 1024 * 1024));
      const postRows = await prisma.$queryRaw<Array<{ authorId: string }>>`
        SELECT "authorId" FROM "ChannelPost" WHERE "id" = ${payload.messageId} AND "channelId" = ${channel.id} LIMIT 1
      `;
      const targetPost = postRows[0] ?? null;
      if (!targetPost) {
        throw new HttpError(404, "Post not found");
      }

      const isOwner = channel.ownerId === user.id;
      const isAuthor = targetPost.authorId === user.id;

      const subRows = await prisma.$queryRaw<Array<{ role: string; canPostMessages: boolean; canEditForeignMessages: boolean }>>`
        SELECT "role", "canPostMessages", "canEditForeignMessages" FROM "ChannelSubscriber"
        WHERE "channelId" = ${channel.id} AND "userId" = ${user.id}
        LIMIT 1
      `;
      const sub = subRows[0] ?? null;

      const canEdit = isOwner || (isAuthor && sub?.role === "admin" && sub?.canPostMessages) || (sub?.role === "admin" && sub?.canEditForeignMessages);

      if (!canEdit) {
        throw new HttpError(403, "You do not have permission to edit this post");
      }

      const rows = await withSharedMessageEdit("channel", channel.id, user.id, targetPost.authorId, async tx => tx.$queryRaw<
        Array<{
          id: string;
          authorId: string;
          text: string | null;
          cipherText: string | null;
          iv: string | null;
          keyVersion: number | null;
          replyToMessageId: string | null;
          createdAt: Date;
        }>
      >`
        UPDATE "ChannelPost"
        SET
          "text" = ${null},
          "cipherText" = ${payload.cipherText ?? null},
          "iv" = ${payload.iv ?? null},
          "keyVersion" = ${payload.keyVersion ?? null}
        WHERE "id" = ${payload.messageId}
          AND "channelId" = ${channel.id}
          AND "createdAt" >= ${cutoff}
        RETURNING "id", "authorId", "text", "cipherText", "iv", "keyVersion", "replyToMessageId", "createdAt"
      `);
      const post = rows[0] ?? null;
      if (!post) {
        throw new HttpError(404, "Post not found or cannot be edited");
      }

      const recipients = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM "ChannelSubscriber"
        WHERE "channelId" = ${channel.id}
          AND "userId" <> ${user.id}
      `;
      const allowRealtimeCipher =
        (post.cipherText?.length ?? 0) <= REALTIME_CIPHERTEXT_BUDGET_CHARS &&
        (post.iv?.length ?? 0) <= 1000;

      void Promise.allSettled(
        recipients.map(async (recipient) => {
          try {
            await triggerRealtimeEvent({
              channel: userPrivateChannel(recipient.userId),
              name: "message:edited",
              data: {
                chatType: "channel",
                id: post.id,
                senderId: user.id,
                fromLink: user.link,
                groupLink: channel.link,
                ...(post.text && !post.cipherText ? { text: post.text } : {}),
                ...(allowRealtimeCipher && post.cipherText && post.iv && post.keyVersion
                  ? { cipherText: post.cipherText, iv: post.iv, keyVersion: post.keyVersion }
                  : {}),
                createdAt: post.createdAt.toISOString(),
                replyToMessageId: post.replyToMessageId,
              },
            });
          } catch {
            // ignore realtime transport failures
          }
        }),
      );

      const res = jsonOk({
        updated: true,
        messageId: post.id,
        text: publicEncryptedMessageText(post.text, post.cipherText),
        cipherText: post.cipherText,
        iv: post.iv,
        keyVersion: post.keyVersion,
      });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (await groupExistsByLink(link)) {
      throw new HttpError(403, "You are not a member of this group");
    }

    throw new HttpError(404, "Chat not found");
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
