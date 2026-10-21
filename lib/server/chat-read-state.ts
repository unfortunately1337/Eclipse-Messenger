import { redis } from "@/lib/server/redis";

type SharedChatType = "group" | "channel";

const READ_MARKER_TTL_SECONDS = 180 * 24 * 60 * 60;

function buildReadMarkerKey(chatType: SharedChatType, userId: string, chatId: string) {
  return `chat:read:${chatType}:${userId}:${chatId}`;
}

function normalizeReadMarker(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp);
}

async function getSharedChatReadMarkers(
  chatType: SharedChatType,
  userId: string,
  chatIds: string[],
): Promise<Map<string, Date | null>> {
  const normalizedIds = Array.from(new Set(chatIds.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) return new Map();

  const raw = await redis.mget(...normalizedIds.map(chatId => buildReadMarkerKey(chatType, userId, chatId))).catch(() => []);
  return new Map(normalizedIds.map((chatId, i) => [chatId, normalizeReadMarker(raw[i] ?? null)]));
}

async function getSharedChatReadMarkersForUsers(
  chatType: SharedChatType,
  userIds: string[],
  chatId: string,
): Promise<Map<string, Date | null>> {
  const normalizedUserIds = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  const normalizedChatId = chatId.trim();
  if (normalizedUserIds.length === 0 || !normalizedChatId) return new Map();

  const keys = normalizedUserIds.map((userId) => buildReadMarkerKey(chatType, userId, normalizedChatId));
  try {
    const values = await redis.mget(...keys);
    return new Map(normalizedUserIds.map((userId, index) => [userId, normalizeReadMarker(values[index] ?? null)]));
  } catch {
    const values = await Promise.all(
      normalizedUserIds.map(async (userId) => {
        try {
          const raw = await redis.get(buildReadMarkerKey(chatType, userId, normalizedChatId));
          return [userId, normalizeReadMarker(raw)] as const;
        } catch {
          return [userId, null] as const;
        }
      }),
    );
    return new Map(values);
  }
}

async function setSharedChatReadMarker(
  chatType: SharedChatType,
  userId: string,
  chatId: string,
  readAt: Date,
) {
  const key = buildReadMarkerKey(chatType, userId, chatId);
  const nextIso = readAt.toISOString();
  try {
    const current = normalizeReadMarker(await redis.get(key));
    if (current && current.getTime() >= readAt.getTime()) {
      await redis.expire(key, READ_MARKER_TTL_SECONDS);
      return current;
    }
    await redis.set(key, nextIso, "EX", READ_MARKER_TTL_SECONDS);
    return readAt;
  } catch {
    return readAt;
  }
}

export function getGroupReadMarkers(userId: string, groupIds: string[]) {
  return getSharedChatReadMarkers("group", userId, groupIds);
}

export function getGroupReadMarkersForUsers(userIds: string[], groupId: string) {
  return getSharedChatReadMarkersForUsers("group", userIds, groupId);
}

export function getChannelReadMarkers(userId: string, channelIds: string[]) {
  return getSharedChatReadMarkers("channel", userId, channelIds);
}

export function getChannelReadMarkersForUsers(userIds: string[], channelId: string) {
  return getSharedChatReadMarkersForUsers("channel", userIds, channelId);
}

export function setGroupReadMarker(userId: string, groupId: string, readAt: Date) {
  return setSharedChatReadMarker("group", userId, groupId, readAt);
}

export function setChannelReadMarker(userId: string, channelId: string, readAt: Date) {
  return setSharedChatReadMarker("channel", userId, channelId, readAt);
}
