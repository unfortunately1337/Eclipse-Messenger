"use client";

import { readDeletedMessages } from "@/lib/client/deleted-messages";
import { clearEncryptedMedia } from "@/lib/client/media-crypto";
import { clearMediaBlobCache } from "@/lib/client/media-cache";
import { type ConversationChatType, type ChatSummary, type DecryptedMessage, type SelfProfile, type StoryFeedItem, type StoryFeedGroup, type ProfilePreview, type ProfileBatchItem, type ContactResponse, type ChatsListCacheSnapshot, type ConversationCacheSnapshot, type StoryFeedCacheSnapshot } from "../types";
import { isValidDirectEncryptedPayload, isValidSharedEncryptedPayload } from "@/lib/client/e2e-decrypt-pipeline";
import { ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT } from "../chat-message-transport";
import { appendAndSortMessages } from "../chat-message-state";
import { deduplicateChatSummaries } from "../chat-realtime-chatlist";
import { SESSION_CHAT_LIST_KEY_PREFIX, PERSISTENT_CHAT_LIST_KEY_PREFIX, SESSION_STORY_FEED_KEY_PREFIX, PERSISTENT_STORY_FEED_KEY_PREFIX, PERSISTENT_SELF_PROFILE_KEY_PREFIX, PERSISTENT_PROFILE_KEY_PREFIX, SESSION_CONV_KEY_PREFIX, PERSISTENT_CONV_KEY_PREFIX, SESSION_READ_MARKERS_KEY_PREFIX, SESSION_READ_RECEIPTS_KEY_PREFIX, CHAT_UI_SETTINGS_KEY_PREFIX, MAX_PINNED_CHATS, DECRYPTED_PAYLOAD_TEXT_CACHE_MAX, CONVERSATION_CACHE_MAX_TEXT_CHARS, CHAT_LIST_CACHE_STALE_MAX_MS, STORY_FEED_CACHE_STALE_MAX_MS, SELF_PROFILE_CACHE_TTL_MS, PERSISTENT_LAST_SELF_PROFILE_KEY, CONVERSATION_CACHE_STALE_MAX_MS, SESSION_CONV_MAX_CHARS } from "./config";
import { hashSeed } from "./message-format";
import { parsedMessageCache } from "./message-content";
import { normalizedPreviewCache } from "./chat-previews";
import { filterDeletedStories } from "./story-deletions";

export const chatMemory: {
  chatCacheGeneration: number;
  chatsListInMemoryCache: ChatsListCacheSnapshot | null;
  selfProfileInMemoryCache: { savedAt: number; me: SelfProfile } | null;
} = { chatCacheGeneration: 0, chatsListInMemoryCache: null, selfProfileInMemoryCache: null };

export const legacyMediaGrantAttempts = new Map<string, number>();

export function scheduleIdleTask(task: () => void, timeout = 900) {
  if (typeof window === "undefined") {
    task();
    return undefined;
  }
  if ("requestIdleCallback" in window) {
    return (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback(task, { timeout });
  }
  return globalThis.setTimeout(task, 0);
}

export const storyFeedInMemoryCache = new Map<string, StoryFeedCacheSnapshot>();

export const conversationInMemoryCache = new Map<string, ConversationCacheSnapshot>();

export const profileInMemoryCache = new Map<
  string,
  { savedAt: number; profile: ProfilePreview; contact: ContactResponse }
>();

export const profileByIdInMemoryCache = new Map<string, { savedAt: number; profile: ProfileBatchItem }>();

export const decryptedPayloadTextCache = new Map<string, string>();

export const decryptedPayloadTextInFlight = new Map<string, Promise<string>>();

export const decryptedPayloadFailureCache = new Map<string, { at: number; text: string }>();

export function withOwnStory(groups: StoryFeedGroup[], author: StoryFeedGroup["author"], story: StoryFeedItem) {
  const group = groups.find(entry => entry.author.id === author.id);
  if (!group) return [...groups, { author, hasUnviewed: false, stories: [story] }];
  return groups.map(entry => entry !== group ? entry : {
    ...entry,
    stories: [...entry.stories.filter(existing => existing.id !== story.id), story]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
  });
}

export function buildStoryFeedSignature(groups: StoryFeedGroup[]) {
  return groups
    .map((group) =>
      [
        group.author.id,
        group.hasUnviewed ? "1" : "0",
        ...group.stories.map((story) =>
          [
            story.id,
            story.viewed ? "1" : "0",
            story.likedByMe ? "1" : "0",
            story.likesCount,
            story.viewsCount,
            story.createdAt,
            story.expiresAt,
          ].join(","),
        ),
      ].join("|"),
    )
    .join("||");
}

export function getSessionChatListKey(userId: string) {
  return `${SESSION_CHAT_LIST_KEY_PREFIX}${userId}`;
}

export function getPersistentChatListKey(userId: string) {
  return `${PERSISTENT_CHAT_LIST_KEY_PREFIX}${userId}`;
}

export function getSessionStoryFeedKey(userId: string) {
  return `${SESSION_STORY_FEED_KEY_PREFIX}${userId}`;
}

export function getPersistentStoryFeedKey(userId: string) {
  return `${PERSISTENT_STORY_FEED_KEY_PREFIX}${userId}`;
}

export function getPersistentSelfProfileKey(userId: string) {
  return `${PERSISTENT_SELF_PROFILE_KEY_PREFIX}${userId}`;
}

export function getPersistentProfileKey(userId: string, link: string) {
  return `${PERSISTENT_PROFILE_KEY_PREFIX}${userId}:${link}`;
}

export function buildConversationCacheKey(link: string, chatType: ConversationChatType) {
  return `${chatType}:${link}`;
}

export function buildOwnedMemoryCacheKey(userId: string | null | undefined, key: string) {
  const owner = userId?.trim();
  return owner ? `${owner}:${key}` : null;
}

export function buildConversationMemoryCacheKey(
  userId: string | null | undefined,
  link: string,
  chatType: ConversationChatType,
) {
  return buildOwnedMemoryCacheKey(userId, buildConversationCacheKey(link, chatType));
}

export function buildProfileMemoryCacheKey(userId: string | null | undefined, link: string) {
  return buildOwnedMemoryCacheKey(userId, link.trim().toLowerCase());
}

export function readConversationMemoryCache(
  userId: string | null | undefined,
  link: string,
  chatType: ConversationChatType,
) {
  if (link.startsWith("secret-")) return null;
  const cacheKey = buildConversationMemoryCacheKey(userId, link, chatType);
  const snapshot = cacheKey ? conversationInMemoryCache.get(cacheKey) ?? null : null;
  if (snapshot?.conversation?.conversationId?.startsWith("secret:")) { if (cacheKey) conversationInMemoryCache.delete(cacheKey); return null; }
  return snapshot;
}

export function writeConversationMemoryCache(
  userId: string | null | undefined,
  link: string,
  chatType: ConversationChatType,
  snapshot: ConversationCacheSnapshot,
) {
  if (link.startsWith("secret-") || snapshot.conversation?.conversationId?.startsWith("secret:")) return;
  const cacheKey = buildConversationMemoryCacheKey(userId, link, chatType);
  if (!cacheKey) return;
  conversationInMemoryCache.set(cacheKey, snapshot);
}

export function deleteConversationMemoryCache(
  userId: string | null | undefined,
  link: string,
  chatType: ConversationChatType,
) {
  const cacheKey = buildConversationMemoryCacheKey(userId, link, chatType);
  if (cacheKey) conversationInMemoryCache.delete(cacheKey);
  conversationInMemoryCache.delete(buildConversationCacheKey(link, chatType));
}

export function readProfileDetailsMemoryCache(userId: string | null | undefined, link: string) {
  const cacheKey = buildProfileMemoryCacheKey(userId, link);
  return cacheKey ? profileInMemoryCache.get(cacheKey) ?? null : null;
}

export function writeProfileDetailsMemoryCache(
  userId: string | null | undefined,
  link: string,
  snapshot: { savedAt: number; profile: ProfilePreview; contact: ContactResponse },
) {
  const cacheKey = buildProfileMemoryCacheKey(userId, link);
  if (!cacheKey) return;
  profileInMemoryCache.set(cacheKey, snapshot);
}

export function deleteProfileDetailsMemoryCache(userId: string | null | undefined, link: string) {
  const cacheKey = buildProfileMemoryCacheKey(userId, link);
  if (cacheKey) profileInMemoryCache.delete(cacheKey);
  profileInMemoryCache.delete(link.trim().toLowerCase());
}

export function getSessionConversationKey(userId: string, link: string, chatType: ConversationChatType) {
  return `${SESSION_CONV_KEY_PREFIX}${userId}:${buildConversationCacheKey(link, chatType)}`;
}

export function getPersistentConversationKey(
  userId: string,
  link: string,
  chatType: ConversationChatType,
) {
  return `${PERSISTENT_CONV_KEY_PREFIX}${userId}:${buildConversationCacheKey(link, chatType)}`;
}

export function getReadMarkersKey(userId: string) {
  return `${SESSION_READ_MARKERS_KEY_PREFIX}${userId}`;
}

export function getReadReceiptsKey(userId: string) {
  return `${SESSION_READ_RECEIPTS_KEY_PREFIX}${userId}`;
}

export function getPinnedChatsKey(userId: string) {
  return `eclipse:pinned-chats:${userId}`;
}

export function getChatUiSettingsKey(userId: string) {
  return `${CHAT_UI_SETTINGS_KEY_PREFIX}${userId}`;
}

export function loadPinnedChatLinks(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(getPinnedChatsKey(userId));
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();
    const limited: string[] = [];
    for (const value of parsed) {
      if (typeof value !== "string" || value.trim().length === 0) continue;
      if (limited.includes(value)) continue;
      limited.push(value);
      if (limited.length >= MAX_PINNED_CHATS) break;
    }
    return new Set(limited);
  } catch {
    return new Set<string>();
  }
}

export function savePinnedChatLinks(userId: string, links: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getPinnedChatsKey(userId), JSON.stringify([...links]));
  } catch {
    // best-effort only
  }
}

export function buildPayloadPartFingerprint(value: string | number | null | undefined) {
  const normalized = String(value ?? "");
  return `${normalized.length}:${hashSeed(normalized).toString(36)}`;
}

export function buildDirectDecryptCacheKey(input: { cipherText: string; iv: string; encryptedKey: string }) {
  return [
    "direct",
    buildPayloadPartFingerprint(input.cipherText),
    buildPayloadPartFingerprint(input.iv),
    buildPayloadPartFingerprint(input.encryptedKey),
  ].join(":");
}

export function buildSharedDecryptCacheKey(input: {
  chatType: "group" | "channel";
  chatLink: string;
  cipherText: string;
  iv: string;
  keyVersion: number;
}) {
  return [
    "shared",
    input.chatType,
    buildPayloadPartFingerprint(input.chatLink),
    input.keyVersion,
    buildPayloadPartFingerprint(input.cipherText),
    buildPayloadPartFingerprint(input.iv),
  ].join(":");
}

export async function decryptWithTextCache(cacheKey: string, run: () => Promise<string>) {
  const generation = chatMemory.chatCacheGeneration;
  const cached = decryptedPayloadTextCache.get(cacheKey);
  if (typeof cached === "string") {
    decryptedPayloadTextCache.delete(cacheKey);
    decryptedPayloadTextCache.set(cacheKey, cached);
    return cached;
  }

  const failure = decryptedPayloadFailureCache.get(cacheKey);
  if (failure && Date.now() - failure.at < 15000) {
    return failure.text;
  }

  const pending = decryptedPayloadTextInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const pendingRun = run();
  decryptedPayloadTextInFlight.set(cacheKey, pendingRun);
  let text: string;
  try {
    text = await pendingRun;
  } finally {
    decryptedPayloadTextInFlight.delete(cacheKey);
  }
  if (generation !== chatMemory.chatCacheGeneration) return ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT;
  if (text !== ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT && text !== "Сообщение" && text !== "饭") {
    decryptedPayloadTextCache.set(cacheKey, text);
    decryptedPayloadFailureCache.delete(cacheKey);
  } else {
    decryptedPayloadFailureCache.set(cacheKey, { at: Date.now(), text });
  }
  if (decryptedPayloadTextCache.size > DECRYPTED_PAYLOAD_TEXT_CACHE_MAX) {
    const overflow = decryptedPayloadTextCache.size - DECRYPTED_PAYLOAD_TEXT_CACHE_MAX;
    const keys = decryptedPayloadTextCache.keys();
    for (let index = 0; index < overflow; index += 1) {
      const next = keys.next();
      if (next.done) break;
      decryptedPayloadTextCache.delete(next.value);
    }
  }
  return text;
}

export function canDecryptPayload(input: { cipherText?: string | null; iv?: string | null; encryptedKey?: string | null }) {
  return isValidDirectEncryptedPayload(input);
}

export function canDecryptSharedPayload(input: { cipherText?: string | null; iv?: string | null; keyVersion?: number | null }) {
  return isValidSharedEncryptedPayload(input);
}

export function estimateMessagesTextChars(messages: DecryptedMessage[]) {
  let total = 0;
  for (const message of messages) {
    total += message.text.length;
    if (total > CONVERSATION_CACHE_MAX_TEXT_CHARS) {
      return total;
    }
  }
  return total;
}

export function clearChatMemoryCaches() {
  chatMemory.chatCacheGeneration += 1;
  legacyMediaGrantAttempts.clear();
  clearEncryptedMedia();
  clearMediaBlobCache();
  parsedMessageCache.clear();
  normalizedPreviewCache.clear();
  decryptedPayloadTextCache.clear();
  decryptedPayloadFailureCache.clear();
  decryptedPayloadTextInFlight.clear();
  storyFeedInMemoryCache.clear();
  conversationInMemoryCache.clear();
  profileInMemoryCache.clear();
  profileByIdInMemoryCache.clear();
  chatMemory.chatsListInMemoryCache = null;
  chatMemory.selfProfileInMemoryCache = null;
}

export function sanitizeLoadedCachedChats(chats: ChatSummary[], userId: string): ChatSummary[] {
  if (!Array.isArray(chats)) return [];
  return chats.filter((chat) => {
    if (chat?.link?.startsWith("secret-") || chat?.conversationId?.startsWith("secret:")) return false;
    if (!chat || !chat.link) return false;
    // Temporary chat placeholders must never be in cache or chat list
    if (chat.isTemporary) {
      return false;
    }
    // Direct chat with oneself is impossible and indicates cross-user cache contamination
    if ((chat.chatType ?? "direct") === "direct" && chat.peerId === userId) {
      return false;
    }
    // Direct chat with 0 messages is an empty ghost chat and must not appear in cache
    if (
      (chat.chatType ?? "direct") === "direct" &&
      !chat.lastMessage &&
      !chat.lastMessageCipherText &&
      !(chat as any).lastMessageText
    ) {
      return false;
    }
    return true;
  });
}

export function loadChatListSessionCache(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionChatListKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatsListCacheSnapshot;
    if (!parsed?.savedAt) return null;
    if (parsed.selfId && parsed.selfId !== userId) return null;
    if (navigator.onLine && Date.now() - parsed.savedAt > CHAT_LIST_CACHE_STALE_MAX_MS) return null;
    if (parsed.chats) {
      parsed.chats = sanitizeLoadedCachedChats(parsed.chats, userId);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadStoryFeedSessionCache(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionStoryFeedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoryFeedCacheSnapshot;
    if (!parsed?.savedAt || !Array.isArray(parsed?.stories)) return null;
    if (navigator.onLine && Date.now() - parsed.savedAt > STORY_FEED_CACHE_STALE_MAX_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadChatListPersistentCache(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getPersistentChatListKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatsListCacheSnapshot;
    if (!parsed?.savedAt) return null;
    if (parsed.selfId && parsed.selfId !== userId) return null;
    if (navigator.onLine && Date.now() - parsed.savedAt > CHAT_LIST_CACHE_STALE_MAX_MS) return null;
    if (parsed.chats) {
      parsed.chats = sanitizeLoadedCachedChats(parsed.chats, userId);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadStoryFeedPersistentCache(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getPersistentStoryFeedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoryFeedCacheSnapshot;
    if (!parsed?.savedAt || !Array.isArray(parsed?.stories)) return null;
    if (navigator.onLine && Date.now() - parsed.savedAt > STORY_FEED_CACHE_STALE_MAX_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadSelfProfilePersistentCache(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getPersistentSelfProfileKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; me: SelfProfile };
    if (!parsed?.savedAt || !parsed?.me?.id) return null;
    if (Date.now() - parsed.savedAt > SELF_PROFILE_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSelfProfilePersistentCache(snapshot: { savedAt: number; me: SelfProfile }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getPersistentSelfProfileKey(snapshot.me.id), JSON.stringify(snapshot));
    window.localStorage.setItem(PERSISTENT_LAST_SELF_PROFILE_KEY, snapshot.me.id);
  } catch {
    // ignore
  }
}

export function getActiveCookieUserId(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(/(?:^|;\s*)eclipse\.active_user_id=([^;]+)/);
    return match ? decodeURIComponent(match[1]).trim() : null;
  } catch {
    return null;
  }
}

export function loadLatestSelfProfilePersistentCache() {
  if (typeof window === "undefined") return null;
  try {
    const cookieUserId = getActiveCookieUserId();
    const storedLastUserId =
      window.localStorage.getItem(PERSISTENT_LAST_SELF_PROFILE_KEY)?.trim() ||
      window.localStorage.getItem("eclipse:active-user-id")?.trim() ||
      null;

    // Security & state boundary: if cookie explicitly declares active session user,
    // ensure we never load a different user's persistent profile/chats.
    const effectiveUserId = cookieUserId || storedLastUserId;
    if (!effectiveUserId) return null;
    if (cookieUserId && storedLastUserId && cookieUserId !== storedLastUserId) {
      // Out of sync: cookie has priority over stale localStorage key.
      return loadSelfProfilePersistentCache(cookieUserId);
    }
    return loadSelfProfilePersistentCache(effectiveUserId);
  } catch {
    return null;
  }
}

export function normalizeCachedChatsForSelf(chats: ChatSummary[], selfId: string | null) {
  if (!chats || chats.length === 0) return chats;
  const deduped = deduplicateChatSummaries(chats);
  if (!selfId) return deduped;
  let changed = deduped.length !== chats.length;
  const next = deduped.map((chat) => {
    if (chat.chatType === "saved") {
      if (chat.lastMessageMine) return chat;
      changed = true;
      return { ...chat, lastMessageMine: true };
    }
    if (!chat.lastMessageSenderId) return chat;
    const lastMessageMine = chat.lastMessageSenderId === selfId;
    if (chat.lastMessageMine === lastMessageMine) return chat;
    changed = true;
    return { ...chat, lastMessageMine };
  });
  return changed ? next : deduped;
}

export function sanitizeConversationCacheMessages(messages: DecryptedMessage[]) {
  return messages.filter(
    (message) =>
      Boolean(message?.id && message.senderId),
  );
}

export function normalizeConversationCacheSnapshot(
  snapshot: ConversationCacheSnapshot | null,
  selfId: string | null,
): ConversationCacheSnapshot | null {
  if (!snapshot) return null;
  if (snapshot.conversation?.conversationId?.startsWith("secret:")) return null;
  if (selfId && snapshot.selfId && snapshot.selfId !== selfId) return null;
  if (!Array.isArray(snapshot.messages)) return null;
  const messages = sanitizeConversationCacheMessages(snapshot.messages);
  if (messages.length === 0) return null;
  return {
    ...snapshot,
    messages,
    selfId: selfId ?? snapshot.selfId,
  };
}

export function isConversationCacheValid(snapshot: ConversationCacheSnapshot | null, selfId: string | null) {
  return normalizeConversationCacheSnapshot(snapshot, selfId) !== null;
}

export function appendMessageToConversationCaches(
  userId: string | null,
  link: string,
  chatType: ConversationChatType,
  message: DecryptedMessage,
) {
  if (!userId || !message?.id || !message.senderId) return;

  const existing =
    readConversationMemoryCache(userId, link, chatType) ??
    loadConversationSessionCache(userId, link, chatType) ??
    loadConversationPersistentCache(userId, link, chatType);
  const normalizedExisting = normalizeConversationCacheSnapshot(existing, userId);
  if (!normalizedExisting) return;

  const nextMessages = appendAndSortMessages(normalizedExisting.messages, message);
  cacheConversationSnapshot(
    userId,
    link,
    {
      savedAt: Date.now(),
      conversation: normalizedExisting.conversation,
      messages: nextMessages,
      selfId: userId,
    },
    chatType,
  );
}

export function clearConversationCaches(userId: string | null, link: string, chatType: ConversationChatType) {
  deleteConversationMemoryCache(userId, link, chatType);
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.removeItem(getSessionConversationKey(userId, link, chatType));
    window.localStorage.removeItem(getPersistentConversationKey(userId, link, chatType));
  } catch {
    // ignore
  }
}

export function removeChatFromListCaches(userId: string | null, link: string, chatType: ConversationChatType) {
  if (!userId) return;
  const pruneSnapshot = (snapshot: ChatsListCacheSnapshot | null) => {
    if (!snapshot) return snapshot;
    const nextChats = snapshot.chats.filter((chat) => !((chat.chatType ?? "direct") === chatType && chat.link === link));
    if (nextChats.length === snapshot.chats.length) return snapshot;
    const nextUnreadByLink = { ...snapshot.unreadByLink };
    delete nextUnreadByLink[link];
    return {
      ...snapshot,
      chats: nextChats,
      unreadByLink: nextUnreadByLink,
      selectedLink: snapshot.selectedLink === link ? null : snapshot.selectedLink,
    } satisfies ChatsListCacheSnapshot;
  };

  if (chatMemory.chatsListInMemoryCache?.selfId === userId) {
    chatMemory.chatsListInMemoryCache = pruneSnapshot(chatMemory.chatsListInMemoryCache);
  }
  if (typeof window === "undefined") return;
  try {
    const session = loadChatListSessionCache(userId);
    const nextSession = pruneSnapshot(session);
    if (nextSession) {
      saveChatListSessionCache(userId, nextSession);
    } else {
      window.sessionStorage.removeItem(getSessionChatListKey(userId));
    }

    const persistent = loadChatListPersistentCache(userId);
    const nextPersistent = pruneSnapshot(persistent);
    if (nextPersistent) {
      saveChatListPersistentCache(userId, nextPersistent);
    } else {
      window.localStorage.removeItem(getPersistentChatListKey(userId));
    }
  } catch {
    // ignore
  }
}

export function saveChatListSessionCache(userId: string, snapshot: ChatsListCacheSnapshot) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const cleanSnapshot: ChatsListCacheSnapshot = {
      ...snapshot,
      chats: sanitizeLoadedCachedChats(snapshot.chats, userId),
    };
    window.sessionStorage.setItem(getSessionChatListKey(userId), JSON.stringify(cleanSnapshot));
  } catch {
    // ignore
  }
}

export function saveStoryFeedSessionCache(userId: string, snapshot: StoryFeedCacheSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getSessionStoryFeedKey(userId), JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function loadProfilePersistentCache(userId: string, link: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getPersistentProfileKey(userId, link));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; profile: ProfilePreview; contact: ContactResponse };
    if (!parsed?.savedAt || !parsed?.profile?.link) return null;
    if (navigator.onLine && Date.now() - parsed.savedAt > CHAT_LIST_CACHE_STALE_MAX_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfilePersistentCache(
  userId: string,
  link: string,
  snapshot: { savedAt: number; profile: ProfilePreview; contact: ContactResponse },
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getPersistentProfileKey(userId, link), JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function saveChatListPersistentCache(userId: string, snapshot: ChatsListCacheSnapshot) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const cleanSnapshot: ChatsListCacheSnapshot = {
      ...snapshot,
      chats: sanitizeLoadedCachedChats(snapshot.chats, userId),
    };
    window.localStorage.setItem(getPersistentChatListKey(userId), JSON.stringify(cleanSnapshot));
  } catch {
    // ignore
  }
}

export function saveStoryFeedPersistentCache(userId: string, snapshot: StoryFeedCacheSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getPersistentStoryFeedKey(userId), JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function getNewestChatListSnapshot(...snapshots: Array<ChatsListCacheSnapshot | null>) {
  return snapshots.reduce<ChatsListCacheSnapshot | null>((latest, snapshot) => {
    if (!snapshot) return latest;
    if (!latest || snapshot.savedAt > latest.savedAt) {
      return snapshot;
    }
    return latest;
  }, null);
}

export function getNewestStoryFeedSnapshot(...snapshots: Array<StoryFeedCacheSnapshot | null>) {
  return snapshots.reduce<StoryFeedCacheSnapshot | null>((latest, snapshot) => {
    if (!snapshot) return latest;
    if (!latest || snapshot.savedAt > latest.savedAt) {
      return snapshot;
    }
    return latest;
  }, null);
}

export function loadInitialChatListSnapshot(userId: string) {
  return getNewestChatListSnapshot(
    chatMemory.chatsListInMemoryCache?.selfId === userId ? chatMemory.chatsListInMemoryCache : null,
    loadChatListSessionCache(userId),
    loadChatListPersistentCache(userId),
  );
}

export function loadInitialStoryFeedSnapshot(userId: string) {
  const snapshot = getNewestStoryFeedSnapshot(
    storyFeedInMemoryCache.get(userId) ?? null,
    loadStoryFeedSessionCache(userId),
    loadStoryFeedPersistentCache(userId),
  );
  return snapshot ? { ...snapshot, stories: filterDeletedStories(userId, snapshot.stories) } : null;
}

export function cacheStoryFeedSnapshot(userId: string, stories: StoryFeedGroup[]) {
  const snapshot = { savedAt: Date.now(), stories: filterDeletedStories(userId, stories) };
  storyFeedInMemoryCache.set(userId, snapshot);
  saveStoryFeedSessionCache(userId, snapshot);
  saveStoryFeedPersistentCache(userId, snapshot);
}

export function loadConversationSessionCache(userId: string, link: string, chatType: ConversationChatType) {
  if (link.startsWith("secret-")) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionConversationKey(userId, link, chatType));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConversationCacheSnapshot;
    if (parsed?.conversation?.conversationId?.startsWith("secret:")) { window.sessionStorage.removeItem(getSessionConversationKey(userId, link, chatType)); return null; }
    if (!parsed?.savedAt) return null;
    if (parsed.selfId && parsed.selfId !== userId) return null;
    if (navigator.onLine && Date.now() - parsed.savedAt > CONVERSATION_CACHE_STALE_MAX_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConversationSessionCache(
  userId: string,
  link: string,
  chatType: ConversationChatType,
  snapshot: ConversationCacheSnapshot,
) {
  if (link.startsWith("secret-") || snapshot.conversation?.conversationId?.startsWith("secret:")) return;
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(snapshot);
    if (serialized.length > SESSION_CONV_MAX_CHARS) return;
    window.sessionStorage.setItem(getSessionConversationKey(userId, link, chatType), serialized);
  } catch {
    // ignore
  }
}

export function loadConversationPersistentCache(
  userId: string,
  link: string,
  chatType: ConversationChatType,
) {
  if (link.startsWith("secret-")) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getPersistentConversationKey(userId, link, chatType));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConversationCacheSnapshot;
    if (parsed?.conversation?.conversationId?.startsWith("secret:")) { window.localStorage.removeItem(getPersistentConversationKey(userId, link, chatType)); return null; }
    if (!parsed?.savedAt) return null;
    if (parsed.selfId && parsed.selfId !== userId) return null;
    if (navigator.onLine && Date.now() - parsed.savedAt > CONVERSATION_CACHE_STALE_MAX_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConversationPersistentCache(
  userId: string,
  link: string,
  chatType: ConversationChatType,
  snapshot: ConversationCacheSnapshot,
) {
  if (link.startsWith("secret-") || snapshot.conversation?.conversationId?.startsWith("secret:")) return;
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(snapshot);
    if (serialized.length > SESSION_CONV_MAX_CHARS) return;
    window.localStorage.setItem(getPersistentConversationKey(userId, link, chatType), serialized);
  } catch {
    // ignore
  }
}

export function loadReadMarkers(userId: string) {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const raw = window.localStorage.getItem(getReadMarkersKey(userId));
    if (!raw) return {} as Record<string, string>;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : ({} as Record<string, string>);
  } catch {
    return {} as Record<string, string>;
  }
}

export function saveReadMarkers(userId: string, markers: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getReadMarkersKey(userId), JSON.stringify(markers));
  } catch {
    // ignore
  }
}

export function loadReadReceipts(userId: string) {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const raw = window.localStorage.getItem(getReadReceiptsKey(userId));
    if (!raw) return {} as Record<string, string>;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : ({} as Record<string, string>);
  } catch {
    return {} as Record<string, string>;
  }
}

export function saveReadReceipts(userId: string, receipts: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getReadReceiptsKey(userId), JSON.stringify(receipts));
  } catch {
    // ignore
  }
}

export function isMessageReadByMarker(readAtIso: string | undefined, messageIso: string) {
  if (!readAtIso || !messageIso) return false;
  const readTs = Date.parse(readAtIso);
  const messageTs = Date.parse(messageIso);
  if (!Number.isFinite(readTs) || !Number.isFinite(messageTs)) return false;
  return messageTs <= readTs + 1000;
}

export function stableReadViewerScore(messageId: string, viewerId: string) {
  const value = `${messageId}:${viewerId}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function cacheConversationSnapshot(
  userId: string | null,
  link: string,
  snapshot: ConversationCacheSnapshot,
  chatTypeOverride?: ConversationChatType,
) {
  const cacheChatType = chatTypeOverride ?? snapshot.conversation.chatType ?? "direct";
  // Management replies can contain bot credentials; never persist this conversation in browser caches.
  if (snapshot.conversation?.conversationId?.startsWith("secret:") || link.startsWith("secret-")) return;
  if (cacheChatType === "eclipse") {
    clearConversationCaches(userId, link, cacheChatType);
    return;
  }
  const deletedIds = readDeletedMessages(userId);
  const sanitizedMessages = sanitizeConversationCacheMessages(snapshot.messages).filter(message => !deletedIds.has(message.id));
  if (sanitizedMessages.length === 0) {
    clearConversationCaches(userId, link, cacheChatType);
    return;
  }
  if (estimateMessagesTextChars(sanitizedMessages) > CONVERSATION_CACHE_MAX_TEXT_CHARS) {
    deleteConversationMemoryCache(userId, link, cacheChatType);
    return;
  }
  const normalizedSnapshot = {
    ...snapshot,
    messages: sanitizedMessages,
    selfId: userId ?? snapshot.selfId,
  };
  writeConversationMemoryCache(userId, link, cacheChatType, normalizedSnapshot);
  if (userId) {
    saveConversationSessionCache(userId, link, cacheChatType, normalizedSnapshot);
    saveConversationPersistentCache(userId, link, cacheChatType, normalizedSnapshot);
  }
  if (conversationInMemoryCache.size <= 24) return;
  const oldestEntry = Array.from(conversationInMemoryCache.entries()).sort(
    (a, b) => a[1].savedAt - b[1].savedAt,
  )[0];
  if (oldestEntry) {
    conversationInMemoryCache.delete(oldestEntry[0]);
  }
}
