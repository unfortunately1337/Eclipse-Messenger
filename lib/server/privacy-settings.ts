import { HttpError } from "./http";
import { createHash } from "crypto";
import { prisma } from "@/lib/server/prisma";
import { redis } from "@/lib/server/redis";

export type PrivacyAudience = "all" | "contacts" | "none";
export type FirstMessagePolicy = "all" | "contacts" | "none";
export type AutoDeleteDays = 1 | 7 | 30 | null;

export type PrivacySettings = {
  onlineVisibility: PrivacyAudience;
  lastSeenVisibility: PrivacyAudience;
  showTyping: boolean;
  showMediaActivity: boolean;
  showReadReceipts: boolean;
  allowUsernameSearch: boolean;
  showInGlobalSearch: boolean;
  allowProfileLink: boolean;
  allowGroupAdd: boolean;
  firstMessagePolicy: FirstMessagePolicy;
  callPolicy: PrivacyAudience;
  callAllowUserIds: string[];
  callDenyUserIds: string[];
  newChatAutoDeleteDays: AutoDeleteDays;
  autoDeleteReadMessages: boolean;
  hideUsername: boolean;
  presenceExceptionUserIds: string[];
  contactUserIds: string[];
};

export type PrivacySettingsInput = Omit<PrivacySettings, "contactUserIds">;

const SETTINGS_PREFIX = "privacy:settings:v2:";
const HIDE_ACTIVITY_STATUS_PREFIX = "privacy:hide-activity:";
const PRESENCE_EXCEPTIONS_PREFIX = "privacy:presence-exceptions:";
const AUTO_DELETE_CHAT_PREFIX = "privacy:auto-delete-chat:";

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettingsInput = {
  onlineVisibility: "all",
  lastSeenVisibility: "all",
  showTyping: true,
  showMediaActivity: true,
  showReadReceipts: true,
  allowUsernameSearch: true,
  showInGlobalSearch: true,
  allowProfileLink: true,
  allowGroupAdd: true,
  firstMessagePolicy: "all",
  callPolicy: "all",
  callAllowUserIds: [],
  callDenyUserIds: [],
  newChatAutoDeleteDays: null,
  autoDeleteReadMessages: false,
  hideUsername: false,
  presenceExceptionUserIds: [],
};

function settingsKey(userId: string) {
  return `${SETTINGS_PREFIX}${userId}`;
}

function hideActivityStatusKey(userId: string) {
  return `${HIDE_ACTIVITY_STATUS_PREFIX}${userId}`;
}

function presenceExceptionsKey(userId: string) {
  return `${PRESENCE_EXCEPTIONS_PREFIX}${userId}`;
}

function autoDeleteChatKey(userId: string, conversationId: string) {
  return `${AUTO_DELETE_CHAT_PREFIX}${userId}:${conversationId}`;
}

export async function scheduleDirectChatAutoDelete(
  userId: string,
  conversationId: string,
  days: AutoDeleteDays,
) {
  if (!days) return;

  const dueAt = Date.now() + days * 24 * 60 * 60 * 1000;
  await redis.set(autoDeleteChatKey(userId, conversationId), String(dueAt)).catch(() => undefined);
}

export async function shouldHideAutoDeletedDirectChat(
  userId: string,
  conversationId: string,
  updatedAt: Date,
) {
  const raw = await redis.get(autoDeleteChatKey(userId, conversationId)).catch(() => null);
  const dueAt = Number(raw);

  return Number.isFinite(dueAt) && dueAt > 0 && Date.now() >= dueAt && updatedAt.getTime() <= dueAt;
}

export async function getAutoDeletedDirectChatIds(userId: string, conversations: Array<{ id: string; updatedAt: Date }>) {
  if (!conversations.length) return new Set<string>();
  const dueDates = await redis.mget(...conversations.map(c => autoDeleteChatKey(userId, c.id))).catch(() => []);
  const now = Date.now();
  return new Set(conversations.filter((c, i) => {
    const dueAt = Number(dueDates[i]);
    return Number.isFinite(dueAt) && dueAt > 0 && now >= dueAt && c.updatedAt.getTime() <= dueAt;
  }).map(c => c.id));
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)))
    : [];
}

function parseStoredSettings(raw: string | null): Partial<PrivacySettingsInput> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<PrivacySettingsInput>;
    if (parsed && typeof parsed === "object") {
      delete (parsed as Record<string, unknown>).preventMediaSaving;
      delete (parsed as Record<string, unknown>).autoDownloadImages;
      delete (parsed as Record<string, unknown>).autoDownloadVideos;
      delete (parsed as Record<string, unknown>).hideChannelSubscriptions;
      delete (parsed as Record<string, unknown>).hideGroups;
      delete (parsed as Record<string, unknown>).hideCommonGroups;
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function profileCacheKey(userId: string) {
  return `profile:preview:v2:${userId}`;
}

export async function getPrivacySettings(userId: string): Promise<PrivacySettings> {
  const [user, rawSettings, rawHideActivityStatus, rawPresenceExceptions, contacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { presenceVisibility: true },
    }),
    redis.get(settingsKey(userId)),
    redis.get(hideActivityStatusKey(userId)),
    redis.get(presenceExceptionsKey(userId)),
    prisma.contact.findMany({
      where: { ownerId: userId },
      select: { peerId: true },
    }),
  ]);
  const stored = parseStoredSettings(rawSettings);
  let legacyExceptions: string[] = [];
  try {
    legacyExceptions = parseStringArray(rawPresenceExceptions ? JSON.parse(rawPresenceExceptions) : []);
  } catch {
    legacyExceptions = [];
  }
  const legacyOnlineVisibility: PrivacyAudience = user?.presenceVisibility === "none" ? "none" : "all";
  const legacyHideActivity = rawHideActivityStatus === "1";

  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...stored,
    onlineVisibility: stored.onlineVisibility ?? legacyOnlineVisibility,
    lastSeenVisibility: stored.lastSeenVisibility ?? (legacyHideActivity ? "none" : legacyOnlineVisibility),
    showTyping: stored.showTyping ?? !legacyHideActivity,
    showMediaActivity: stored.showMediaActivity ?? !legacyHideActivity,
    presenceExceptionUserIds: parseStringArray(stored.presenceExceptionUserIds ?? legacyExceptions),
    contactUserIds: contacts.map((contact) => contact.peerId),
    callAllowUserIds: parseStringArray(stored.callAllowUserIds),
    callDenyUserIds: parseStringArray(stored.callDenyUserIds),
  };
}

export async function getPrivacySettingsBatch(userIds: string[]): Promise<Map<string, PrivacySettings>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const [users, contacts, rawValues] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, presenceVisibility: true },
    }),
    prisma.contact.findMany({
      where: { ownerId: { in: uniqueIds } },
      select: { ownerId: true, peerId: true },
    }),
    redis.mget(
      ...uniqueIds.map(settingsKey),
      ...uniqueIds.map(hideActivityStatusKey),
      ...uniqueIds.map(presenceExceptionsKey),
    ).catch(() => { throw new HttpError(503, "Настройки приватности временно недоступны"); }),
  ]);
  const rawSettingsList = rawValues.slice(0, uniqueIds.length);
  const rawHideActivityList = rawValues.slice(uniqueIds.length, uniqueIds.length * 2);
  const rawExceptionsList = rawValues.slice(uniqueIds.length * 2);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const contactsByOwner = new Map<string, string[]>();
  for (const c of contacts) {
    const list = contactsByOwner.get(c.ownerId) ?? [];
    list.push(c.peerId);
    contactsByOwner.set(c.ownerId, list);
  }

  const result = new Map<string, PrivacySettings>();
  uniqueIds.forEach((userId, idx) => {
    const user = userMap.get(userId);
    const rawSettings = rawSettingsList[idx] ?? null;
    const rawHideActivityStatus = rawHideActivityList[idx] ?? null;
    const rawPresenceExceptions = rawExceptionsList[idx] ?? null;
    const stored = parseStoredSettings(rawSettings);
    let legacyExceptions: string[] = [];
    try {
      legacyExceptions = parseStringArray(rawPresenceExceptions ? JSON.parse(rawPresenceExceptions) : []);
    } catch {
      legacyExceptions = [];
    }
    const legacyOnlineVisibility: PrivacyAudience = user?.presenceVisibility === "none" ? "none" : "all";
    const legacyHideActivity = rawHideActivityStatus === "1";

    result.set(userId, {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...stored,
      onlineVisibility: stored.onlineVisibility ?? legacyOnlineVisibility,
      lastSeenVisibility: stored.lastSeenVisibility ?? (legacyHideActivity ? "none" : legacyOnlineVisibility),
      showTyping: stored.showTyping ?? !legacyHideActivity,
      showMediaActivity: stored.showMediaActivity ?? !legacyHideActivity,
      presenceExceptionUserIds: parseStringArray(stored.presenceExceptionUserIds ?? legacyExceptions),
      contactUserIds: contactsByOwner.get(userId) ?? [],
      callAllowUserIds: parseStringArray(stored.callAllowUserIds),
      callDenyUserIds: parseStringArray(stored.callDenyUserIds),
    });
  });

  return result;
}

export async function savePrivacySettings(userId: string, settings: PrivacySettingsInput) {
  const normalized: PrivacySettingsInput = {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...settings,
    presenceExceptionUserIds: parseStringArray(settings.presenceExceptionUserIds),
    callAllowUserIds: parseStringArray(settings.callAllowUserIds),
    callDenyUserIds: parseStringArray(settings.callDenyUserIds),
  };
  const [updated] = await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { presenceVisibility: normalized.onlineVisibility === "none" ? "none" : "all" },
      select: { id: true },
    }),
    redis.set(settingsKey(userId), JSON.stringify(normalized)),
    redis.set(hideActivityStatusKey(userId), normalized.showTyping || normalized.showMediaActivity ? "0" : "1"),
    redis.set(presenceExceptionsKey(userId), JSON.stringify(normalized.presenceExceptionUserIds)),
  ]);
  return { id: updated.id, ...normalized };
}

function canViewerSeeAudience(
  viewerUserId: string | null | undefined,
  subjectUserId: string,
  audience: PrivacyAudience,
  settings: Pick<PrivacySettings, "presenceExceptionUserIds" | "contactUserIds">,
) {
  if (viewerUserId === subjectUserId) return true;
  const isException = Boolean(viewerUserId && settings.presenceExceptionUserIds.includes(viewerUserId));
  if (audience === "none") return isException;
  if (!viewerUserId) return audience === "all";
  const allowed = audience === "all" || settings.contactUserIds.includes(viewerUserId);
  return isException ? !allowed : allowed;
}

export function canViewerSeePresence(
  viewerUserId: string | null | undefined,
  subjectUserId: string,
  settings: PrivacySettings,
) {
  return canViewerSeeAudience(viewerUserId, subjectUserId, settings.onlineVisibility, settings);
}

export function canViewerSeeLastSeen(
  viewerUserId: string | null | undefined,
  subjectUserId: string,
  settings: PrivacySettings,
) {
  return canViewerSeeAudience(viewerUserId, subjectUserId, settings.lastSeenVisibility, settings);
}

export function canViewerSeeTypingStatus(viewerUserId: string | null | undefined, subjectUserId: string, settings: PrivacySettings) {
  return viewerUserId === subjectUserId || settings.showTyping;
}

export function canViewerSeeMediaActivityStatus(viewerUserId: string | null | undefined, subjectUserId: string, settings: PrivacySettings) {
  return viewerUserId === subjectUserId || settings.showMediaActivity;
}

export function canUserFindByUsername(settings: PrivacySettings) {
  return settings.allowUsernameSearch && settings.showInGlobalSearch;
}

export function shouldHideUsername(viewerUserId: string | null | undefined, subjectUserId: string, settings: PrivacySettings) {
  return viewerUserId !== subjectUserId && settings.hideUsername;
}

export function getPrivacyDisplayName(
  viewerUserId: string | null | undefined,
  subjectUserId: string,
  realDisplayName: string,
  settings: PrivacySettings,
) {
  return realDisplayName;
}

export function canUserStartConversation(senderUserId: string, recipientUserId: string, settings: PrivacySettings) {
  if (senderUserId === recipientUserId) return true;
  if (settings.firstMessagePolicy === "all") return true;
  if (settings.firstMessagePolicy === "none") return false;
  return settings.contactUserIds.includes(senderUserId);
}

// Compatibility for older callers while activity routes are migrated separately.
export function canViewerSeeActivityStatus(viewerUserId: string | null | undefined, subjectUserId: string, settings: PrivacySettings) {
  return canViewerSeeTypingStatus(viewerUserId, subjectUserId, settings);
}

export function canUserCall(senderId: string, recipientId: string, settings: PrivacySettings) {
  if (senderId === recipientId) return false;
  if (settings.callDenyUserIds.includes(senderId)) return false;
  if (settings.callPolicy === "none") return settings.callAllowUserIds.includes(senderId);
  return settings.callPolicy === "all" || (settings.callPolicy === "contacts" && settings.contactUserIds.includes(senderId));
}
