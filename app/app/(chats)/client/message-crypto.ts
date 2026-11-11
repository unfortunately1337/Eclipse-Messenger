"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type CryptoDiagnosticLogger, decryptDirectPayloadDeterministic, decryptSharedPayloadDeterministic } from "@/lib/client/e2e-decrypt-pipeline";
import { type DecryptedMessage, type ConversationResponse, type ChatSummary, type SelfProfile, type EncryptedMessage, type GroupMessagePayload, type ChannelMessagePayload } from "../types";
import { decryptSecretDeviceMessage, isSecretDeviceEnvelope } from "@/lib/client/secret-device-keys";
import { apiRequest } from "@/lib/client/http";
import { rememberOutgoingMessage } from "@/lib/client/failed-message-store";
import { type E2EIdentity, decryptMessageWithPrivateKey, decryptMessageWithPrivateKeyBase64, decryptSharedKeyWithPrivateKeyBase64, decryptSharedKeyWithKeyring, decryptWithSharedKey, encryptSharedKeyForUser, generateSharedKeyBase64, loadActiveSharedChatKey, loadStoredE2EKeyPairs, storeSharedChatKey } from "@/lib/client/e2e";
import { ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT } from "../chat-message-transport";
import { appendAndSortMessages, compareMessagesByTime } from "../chat-message-state";
import { shouldApplyChatPreviewByTimestamp } from "../chat-realtime-chatlist";
import { SHARED_KEY_FETCH_SUCCESS_TTL_MS, SHARED_KEY_FETCH_MISS_TTL_MS, HISTORY_PAGE_SIZE_DESKTOP, HISTORY_PAGE_SIZE_MOBILE, CHAT_PREVIEW_DECRYPT_LIMIT } from "./config";
import { decryptWithTextCache, buildSharedDecryptCacheKey, canDecryptPayload, buildDirectDecryptCacheKey, cacheConversationSnapshot, canDecryptSharedPayload } from "./chat-cache";
import { resolveSharedChatIdFromSummary, isSharedChat } from "./chat-previews";

export interface DecryptMessageWithRecoveryActionContext {
  currentUserIdRef: React.RefObject<string | null>;
  resolveOwnE2EInFlightRef: React.RefObject<Promise<E2EIdentity> | null>;
  lastForcedRestoreAtRef: React.RefObject<number>;
  FORCE_RESTORE_COOLDOWN_MS: 15000;
  resolveAndSyncOwnE2EIdentity: (options?: { forceServerRestore?: boolean | undefined; allowPrompt?: boolean | undefined; } | undefined) => Promise<E2EIdentity>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function decryptMessageWithRecoveryAction({ currentUserIdRef, resolveOwnE2EInFlightRef, lastForcedRestoreAtRef, FORCE_RESTORE_COOLDOWN_MS, resolveAndSyncOwnE2EIdentity, t }: DecryptMessageWithRecoveryActionContext, params: { privateKey: CryptoKey; cipherText: string; iv: string; encryptedKey: string }): Promise<string> {
  if (isSecretDeviceEnvelope(params.encryptedKey)) {
    return decryptSecretDeviceMessage(currentUserIdRef.current ?? "", params);
  }
  // 1. Try active primary key
  try {
    return await decryptMessageWithPrivateKey(params);
  } catch (e) {
    // ignore primary failure, proceed to keyring
  }

  // 2. Try historical local keyring keys
  const keyPairs = loadStoredE2EKeyPairs();
  for (const pair of keyPairs) {
    try {
      return await decryptMessageWithPrivateKeyBase64({
        privateKeyBase64: pair.privateKeyBase64,
        cipherText: params.cipherText,
        iv: params.iv,
        encryptedKey: params.encryptedKey,
      });
    } catch {
      // try next local key
    }
  }

  // 3. Both primary and all local keys failed. Attempt server recovery.
  try {
    let ownPrivateKey = params.privateKey;
    let restored = false;

    if (resolveOwnE2EInFlightRef.current) {
      const own = await resolveOwnE2EInFlightRef.current;
      ownPrivateKey = own.privateKey;
      restored = true;
    } else {
      const now = Date.now();
      const canForceRestore = now - lastForcedRestoreAtRef.current >= FORCE_RESTORE_COOLDOWN_MS;
      if (canForceRestore) {
        lastForcedRestoreAtRef.current = now;
        const own = await resolveAndSyncOwnE2EIdentity({ forceServerRestore: true, allowPrompt: false });
        ownPrivateKey = own.privateKey;
        restored = true;
      }
    }

    if (restored) {
      // Try decrypting with the new primary key from server
      try {
        return await decryptMessageWithPrivateKey({
          ...params,
          privateKey: ownPrivateKey,
        });
      } catch {
        // new primary failed, let's try the updated keyring
        const updatedPairs = loadStoredE2EKeyPairs();
        for (const pair of updatedPairs) {
          try {
            return await decryptMessageWithPrivateKeyBase64({
              privateKeyBase64: pair.privateKeyBase64,
              cipherText: params.cipherText,
              iv: params.iv,
              encryptedKey: params.encryptedKey,
            });
          } catch {
            // try next key
          }
        }
      }
    }
  } catch {
    // recovery process failed
  }

  // 4. Everything failed, throw error to show the fallback text
  throw new Error(t("Сообщение не может быть расшифровано"));
}

export interface EnsureSharedKeyFromServerActionContext {
  sharedKeyServerCacheRef: React.RefObject<Map<string, { expiresAt: number; value: { version: number; keyBase64: string; createdAt: number; } | null; }>>;
  sharedKeyFetchesRef: React.RefObject<Map<string, Promise<{ version: number; keyBase64: string; createdAt: number; } | null>>>;
  resolvePrivateKeyBase64: () => Promise<string>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
}

export async function ensureSharedKeyFromServerAction({ sharedKeyServerCacheRef, sharedKeyFetchesRef, resolvePrivateKeyBase64, t, buildSharedChatKeyId }: EnsureSharedKeyFromServerActionContext, chatType: "group" | "channel", link: string, chatId: string, version?: number | null): Promise<{ version: number; keyBase64: string; createdAt: number; } | null> {
  const fetchKey = `${chatType}:${chatId}:${typeof version === "number" ? version : "latest"}`;
  const cached = sharedKeyServerCacheRef.current.get(fetchKey);
  if (typeof version === "number" && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const existingFetch = sharedKeyFetchesRef.current.get(fetchKey);
  if (existingFetch) {
    return existingFetch;
  }

  const run = (async () => {
    const privateKeyBase64 = await resolvePrivateKeyBase64();
    if (!privateKeyBase64) {
      throw new Error(t("Нет приватного ключа для E2E"));
    }
    const endpoint =
      chatType === "group"
        ? `/api/groups/${encodeURIComponent(link)}/e2e-key`
        : `/api/channels/${encodeURIComponent(link)}/e2e-key`;
    const url = typeof version === "number" ? `${endpoint}?version=${version}` : endpoint;
    const data = await apiRequest<{ keyVersion: number | null; encryptedKey: string | null }>(url, { method: "GET" });
    if (!data.keyVersion || !data.encryptedKey) {
      return null;
    }
    if (typeof version === "number" && data.keyVersion !== version) {
      return null;
    }
    const encryptedKey = data.encryptedKey;
    const keyBase64 = await decryptSharedKeyWithKeyring(encryptedKey).catch(async () => {
      return await decryptSharedKeyWithPrivateKeyBase64({
        encryptedKeyBase64: encryptedKey,
        privateKeyBase64,
      });
    });
    const chatKeyId = buildSharedChatKeyId(chatType, chatId);
    const createdAt = Date.now();
    const currentActive = loadActiveSharedChatKey(chatKeyId);
    const shouldMarkActive =
      !currentActive ||
      data.keyVersion > currentActive.version ||
      typeof version !== "number";
    const resolved = { version: data.keyVersion, keyBase64, createdAt };
    storeSharedChatKey(chatKeyId, resolved, shouldMarkActive);
    return resolved;
  })();

  sharedKeyFetchesRef.current.set(fetchKey, run);
  try {
    const result = await run;
    sharedKeyServerCacheRef.current.set(fetchKey, {
      value: result,
      expiresAt: Date.now() + (result ? SHARED_KEY_FETCH_SUCCESS_TTL_MS : SHARED_KEY_FETCH_MISS_TTL_MS),
    });
    return result;
  } finally {
    sharedKeyFetchesRef.current.delete(fetchKey);
  }
}

export interface DecryptHistoryPageActionContext {
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
  loadSharedKeyByVersion: (chatKeyId: string, version: number) => { version: number; keyBase64: string; createdAt: number } | null;
  ensureSharedKeyFromServer: (chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{ version: number; keyBase64: string; createdAt: number; } | null>;
  cryptoDiagnosticRef: React.RefObject<CryptoDiagnosticLogger>;
  privateKey: CryptoKey | null;
  decryptMessageWithRecovery: (params: { privateKey: CryptoKey; cipherText: string; iv: string; encryptedKey: string; }) => Promise<string>;
}

export async function decryptHistoryPageAction({ buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, cryptoDiagnosticRef, privateKey, decryptMessageWithRecovery }: DecryptHistoryPageActionContext, data: ConversationResponse, link: string): Promise<DecryptedMessage[]> {
  let olderMessages: DecryptedMessage[] = [];
  if (data.chatType === "group") {
    const groupMessages = data.messages as GroupMessagePayload[];
    const chatId = data.group?.id ?? "";
    const chatKeyId = chatId ? buildSharedChatKeyId("group", chatId) : null;
    olderMessages = await Promise.all(
      groupMessages.map(async (message) => {
        if ((message as any).isSystemMessage || (message as any).systemPayload) {
          return {
            id: message.id,
            senderId: message.senderId,
            text: (message as any).systemPayload?.title ?? message.text ?? "",
            replyToMessageId: message.replyToMessageId ?? null,
            createdAt: message.createdAt,
            senderDisplayName: message.senderDisplayName,
            reactions: message.reactions ?? [],
            readBy: message.readBy ?? [],
            systemPayload: (message as any).systemPayload,
          };
        }
        if (message.cipherText && message.iv && message.keyVersion && chatKeyId) {
          const payload = {
            cipherText: message.cipherText,
            iv: message.iv,
            keyVersion: message.keyVersion,
          };
          const text = await decryptWithTextCache(
            buildSharedDecryptCacheKey({ chatType: "group", chatLink: link, ...payload }),
            () =>
              decryptSharedPayloadDeterministic({
                payload,
                chatType: "group",
                chatLink: link,
                messageId: message.id,
                resolveKeyByVersion: (version) => loadSharedKeyByVersion(chatKeyId, version)?.keyBase64 ?? null,
                fetchKeyByVersion: async (version) => {
                  const fetched = await ensureSharedKeyFromServer("group", link, chatId, version);
                  return fetched?.version === version ? fetched.keyBase64 : null;
                },
                decryptWithKey: (keyBase64) =>
                  decryptWithSharedKey({
                    cipherText: payload.cipherText,
                    iv: payload.iv,
                    keyBase64,
                  }),
                fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
                logger: cryptoDiagnosticRef.current,
              }),
          );
          return {
            id: message.id,
            senderId: message.senderId,
            text,
            replyToMessageId: message.replyToMessageId ?? null,
            createdAt: message.createdAt,
            senderDisplayName: message.senderDisplayName,
            reactions: message.reactions ?? [],
            readBy: message.readBy ?? [],
            systemPayload: (message as any).systemPayload,
          };
        }
        return {
          id: message.id,
          senderId: message.senderId,
          text: message.text ?? "Сообщение",
          replyToMessageId: message.replyToMessageId ?? null,
          createdAt: message.createdAt,
          senderDisplayName: message.senderDisplayName,
          reactions: message.reactions ?? [],
          readBy: message.readBy ?? [],
          systemPayload: (message as any).systemPayload,
        };
      }),
    );
  } else if (data.chatType === "channel") {
    const channelMessages = data.messages as ChannelMessagePayload[];
    const chatId = data.channel?.id ?? "";
    const chatKeyId = chatId ? buildSharedChatKeyId("channel", chatId) : null;
    olderMessages = await Promise.all(
      channelMessages.map(async (message) => {
        if ((message as any).isSystemMessage || (message as any).systemPayload) {
          return {
            id: message.id,
            senderId: message.senderId,
            text: (message as any).systemPayload?.title ?? message.text ?? "",
            replyToMessageId: message.replyToMessageId ?? null,
            createdAt: message.createdAt,
            viewsCount: message.viewsCount ?? "0",
            reactions: message.reactions ?? [],
            systemPayload: (message as any).systemPayload,
          };
        }
        if (message.cipherText && message.iv && message.keyVersion && chatKeyId) {
          const payload = {
            cipherText: message.cipherText,
            iv: message.iv,
            keyVersion: message.keyVersion,
          };
          const text = await decryptWithTextCache(
            buildSharedDecryptCacheKey({ chatType: "channel", chatLink: link, ...payload }),
            () =>
              decryptSharedPayloadDeterministic({
                payload,
                chatType: "channel",
                chatLink: link,
                messageId: message.id,
                resolveKeyByVersion: (version) => loadSharedKeyByVersion(chatKeyId, version)?.keyBase64 ?? null,
                fetchKeyByVersion: async (version) => {
                  const fetched = await ensureSharedKeyFromServer("channel", link, chatId, version);
                  return fetched?.version === version ? fetched.keyBase64 : null;
                },
                decryptWithKey: (keyBase64) =>
                  decryptWithSharedKey({
                    cipherText: payload.cipherText,
                    iv: payload.iv,
                    keyBase64,
                  }),
                fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
                logger: cryptoDiagnosticRef.current,
              }),
          );
          return {
            id: message.id,
            senderId: message.senderId,
            text,
            replyToMessageId: message.replyToMessageId ?? null,
            createdAt: message.createdAt,
            viewsCount: message.viewsCount ?? "0",
            reactions: message.reactions ?? [],
            systemPayload: (message as any).systemPayload,
          };
        }
        return {
          id: message.id,
          senderId: message.senderId,
          text: message.text ?? "Сообщение",
          replyToMessageId: message.replyToMessageId ?? null,
          createdAt: message.createdAt,
          viewsCount: message.viewsCount ?? "0",
          reactions: message.reactions ?? [],
          systemPayload: (message as any).systemPayload,
        };
      }),
    );
  } else {
    const directMessages = data.messages as EncryptedMessage[];
    olderMessages = await Promise.all(
      directMessages.map(async (message) => {
        if ((message as any).isSystemMessage || (message as any).systemPayload) {
          return {
            id: message.id,
            senderId: message.senderId,
            text: (message as any).systemPayload?.title ?? (message as any).text ?? "",
            replyToMessageId: message.replyToMessageId ?? null,
            createdAt: message.createdAt,
            systemPayload: (message as any).systemPayload,
            reactions: message.reactions ?? [],
          };
        }
        if (data.peer?.isBot && message.text && !message.cipherText) {
          return {
            id: message.id, senderId: message.senderId, text: message.text, createdAt: message.createdAt,
            replyToMessageId: message.replyToMessageId, reactions: message.reactions ?? [], botReplyMarkup: message.botReplyMarkup
          };
        }
        if (!privateKey || !canDecryptPayload(message)) {
          return {
            id: message.id,
            senderId: message.senderId,
            text: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
            replyToMessageId: message.replyToMessageId ?? null,
            createdAt: message.createdAt,
            reactions: message.reactions ?? [],
          };
        }
        const payload = {
          cipherText: message.cipherText,
          iv: message.iv,
          encryptedKey: message.encryptedKey,
        };
        const text = await decryptWithTextCache(
          buildDirectDecryptCacheKey(payload),
          () =>
            decryptDirectPayloadDeterministic({
              payload,
              tryPrimary: () =>
                decryptMessageWithRecovery({
                  privateKey,
                  cipherText: payload.cipherText,
                  iv: payload.iv,
                  encryptedKey: payload.encryptedKey,
                }),
              fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
              chatLink: link,
              messageId: message.id,
              logger: cryptoDiagnosticRef.current,
            }),
        );
        return {
          id: message.id,
          senderId: message.senderId,
          text,
          replyToMessageId: message.replyToMessageId ?? null,
          createdAt: message.createdAt,
          systemPayload: (message as any).systemPayload,
          reactions: message.reactions ?? [],
        };
      }),
    );
  }

  return olderMessages;
}

export interface LoadOlderMessagesActionContext {
  loadingOlderMessages: boolean;
  hasMoreMessagesBefore: boolean;
  selectedLink: string | null;
  activeConversation: ConversationResponse | null;
  messages: DecryptedMessage[];
  setLoadingOlderMessages: React.Dispatch<React.SetStateAction<boolean>>;
  isDesktop: boolean;
  decryptHistoryPage: (data: ConversationResponse, link: string) => Promise<DecryptedMessage[]>;
  selectedLinkRef: React.RefObject<string | null>;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  setHasMoreMessagesBefore: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  isMessageMarkedDeleted: (messageId: string) => boolean;
  animatedMessageIdsRef: React.RefObject<Set<string>>;
  preservingHistoryScrollRef: React.RefObject<boolean>;
  messagesAtBottomRef: React.RefObject<boolean>;
  setShowScrollToBottomButton: React.Dispatch<React.SetStateAction<boolean>>;
  prependScrollSnapshotRef: React.RefObject<{ previousHeight: number; previousTop: number; } | null>;
  selfId: string | null;
}

export async function loadOlderMessagesAction({ loadingOlderMessages, hasMoreMessagesBefore, selectedLink, activeConversation, messages, setLoadingOlderMessages, isDesktop, decryptHistoryPage, selectedLinkRef, activeConversationRef, messagesViewportRef, setHasMoreMessagesBefore, setMessages, sanitizeMessages, isMessageMarkedDeleted, animatedMessageIdsRef, preservingHistoryScrollRef, messagesAtBottomRef, setShowScrollToBottomButton, prependScrollSnapshotRef, selfId }: LoadOlderMessagesActionContext): Promise<void> {
  if (loadingOlderMessages || !hasMoreMessagesBefore || !selectedLink || !activeConversation || messages.length === 0) {
    return;
  }

  const oldestMessage = messages[0];
  const chatType = activeConversation.chatType;
  if (!oldestMessage?.createdAt || !chatType) return;

  setLoadingOlderMessages(true);
  try {
    const pageLimit = isDesktop ? HISTORY_PAGE_SIZE_DESKTOP : HISTORY_PAGE_SIZE_MOBILE;
    const query = new URLSearchParams({
      limit: String(pageLimit),
      before: oldestMessage.createdAt,
      chatType,
    });
    const data = await apiRequest<ConversationResponse>(
      `/api/chats/${encodeURIComponent(selectedLink)}?${query.toString()}`,
      { method: "GET", cache: "no-store" },
    );

    const olderMessages = await decryptHistoryPage(data, selectedLink);
    if (selectedLinkRef.current !== selectedLink || activeConversationRef.current?.conversationId !== activeConversation.conversationId) return;

    const viewport = messagesViewportRef.current;
    const previousHeight = viewport?.scrollHeight ?? 0;
    const previousTop = viewport?.scrollTop ?? 0;
    let appliedOlderMessages: DecryptedMessage[] = [];
    let nextMessagesSnapshot: DecryptedMessage[] = messages;

    setHasMoreMessagesBefore(Boolean(data.hasMoreBefore));
    setMessages((prev) => {
      const sanitizedPrev = sanitizeMessages(prev);
      const uniqueOlderMessages = olderMessages.filter(
        (message) => !isMessageMarkedDeleted(message.id) && !sanitizedPrev.some((current) => current.id === message.id),
      );
      appliedOlderMessages = uniqueOlderMessages;
      nextMessagesSnapshot =
        uniqueOlderMessages.length > 0
          ? sanitizeMessages([...uniqueOlderMessages, ...sanitizedPrev].sort(compareMessagesByTime))
          : sanitizedPrev;
      return nextMessagesSnapshot;
    });
    if (appliedOlderMessages.length > 0) {
      appliedOlderMessages.forEach((message) => {
        animatedMessageIdsRef.current.add(message.id);
      });
      preservingHistoryScrollRef.current = true;
      messagesAtBottomRef.current = false;
      setShowScrollToBottomButton(true);
      prependScrollSnapshotRef.current = { previousHeight, previousTop };
    }

    const currentConversation = activeConversationRef.current;
    if (currentConversation && currentConversation.chatType === data.chatType) {
      const nextConversation: ConversationResponse = {
        ...currentConversation,
        conversationId: currentConversation.conversationId ?? null,
        chatType: currentConversation.chatType,
        messages: currentConversation.messages ?? [],
        hasMoreBefore: Boolean(data.hasMoreBefore),
      };
      cacheConversationSnapshot(selfId, selectedLink, {
        savedAt: Date.now(),
        conversation: nextConversation,
        messages: nextMessagesSnapshot,
      });
    }
  } catch {
    // best-effort pagination
  } finally {
    setLoadingOlderMessages(false);
  }
}

export interface RotateSharedKeyActionContext {
  selfId: string | null;
  ensureOwnE2EReady: (options?: { allowPrompt?: boolean | undefined; } | undefined) => Promise<{ privateKey: CryptoKey; publicKeyBase64: string; privateKeyBase64: string | null; }>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
}

export async function rotateSharedKeyAction({ selfId, ensureOwnE2EReady, t, buildSharedChatKeyId }: RotateSharedKeyActionContext, chatType: "group" | "channel", link: string, chatId: string): Promise<{ version: number; keyBase64: string; createdAt: number; }> {
  const endpoint =
    chatType === "group"
      ? `/api/groups/${encodeURIComponent(link)}/e2e-key?includeMembers=1`
      : `/api/channels/${encodeURIComponent(link)}/e2e-key?includeMembers=1`;
  let data = await apiRequest<{
    keyVersion: number | null; latestVersion?: number | null;
    members?: Array<{ userId: string; publicKey: string | null }>;
  }>(endpoint, { method: "GET" });
  let members = data.members ?? [];
  let membersWithKey = members.filter((member) => member.publicKey);
  if (selfId && !membersWithKey.some((member) => member.userId === selfId)) {
    try {
      const own = await ensureOwnE2EReady();
      await apiRequest("/api/settings/e2e-key", {
        method: "POST",
        body: JSON.stringify({ publicKey: own.publicKeyBase64 }),
      });
      data = await apiRequest<{
        keyVersion: number | null; latestVersion?: number | null;
        members?: Array<{ userId: string; publicKey: string | null }>;
      }>(endpoint, { method: "GET" });
      members = data.members ?? [];
      membersWithKey = members.filter((member) => member.publicKey);
    } catch {
      // fallback to regular validation below
    }
  }
  if (membersWithKey.length === 0) {
    throw new Error(t("Нет публичных ключей у участников"));
  }
  if (selfId && !membersWithKey.some((member) => member.userId === selfId)) {
    try {
      const own = await ensureOwnE2EReady();
      membersWithKey = [
        ...membersWithKey,
        { userId: selfId, publicKey: own.publicKeyBase64 },
      ];
    } catch {
      throw new Error(t("У пользователя старая версия Eclipse, ему необходимо перезайти в мессенджер"));
    }
  }
  const nextVersion = (data.latestVersion ?? data.keyVersion ?? 0) + 1;
  const sharedKeyBase64 = await generateSharedKeyBase64();
  const encryptedKeys = await Promise.all(
    membersWithKey.map(async (member) => ({
      userId: member.userId,
      encryptedKey: await encryptSharedKeyForUser({
        sharedKeyBase64,
        recipientPublicKeyBase64: member.publicKey as string,
      }),
    })),
  );
  const postEndpoint =
    chatType === "group"
      ? `/api/groups/${encodeURIComponent(link)}/e2e-key`
      : `/api/channels/${encodeURIComponent(link)}/e2e-key`;
  await apiRequest(postEndpoint, {
    method: "POST",
    body: JSON.stringify({ version: nextVersion, keys: encryptedKeys }),
  });
  const chatKeyId = buildSharedChatKeyId(chatType, chatId);
  const createdAt = Date.now();
  storeSharedChatKey(chatKeyId, { version: nextVersion, keyBase64: sharedKeyBase64, createdAt }, true);
  return { version: nextVersion, keyBase64: sharedKeyBase64, createdAt };
}

export interface ReconcileSharedChatKeysContext {
  e2eIdentityReady: boolean;
  selfId: string | null;
  currentUserIdRef: React.RefObject<string | null>;
  chats: ChatSummary[];
  activeConversation: ConversationResponse | null;
  sharedKeyReconcileAtRef: React.RefObject<Record<string, number>>;
  ensureSharedKeyForMembers: (chatType: "group" | "channel", link: string, chatId: string, targetUserIds?: string[] | undefined) => Promise<{ version: number; added: number; failedVersions: number[]; } | null>;
}

export function reconcileSharedChatKeys({ e2eIdentityReady, selfId, currentUserIdRef, chats, activeConversation, sharedKeyReconcileAtRef, ensureSharedKeyForMembers }: ReconcileSharedChatKeysContext): (() => void) | undefined {
  if (!e2eIdentityReady || !selfId) return;
  let cancelled = false;
  let running = false;
  const reconcile = async () => {
    if (running || document.visibilityState !== "visible" || currentUserIdRef.current !== selfId) return;
    running = true;
    try {
      const candidates = new Map<string, { kind: "group" | "channel"; id: string; link: string }>();
      for (const chat of chats) {
        if (chat.chatType === "group" && chat.isGroupOwner || chat.chatType === "channel" && chat.ownerId === selfId) {
          const id = resolveSharedChatIdFromSummary(chat);
          if (id) candidates.set(chat.chatType + ":" + id, { kind: chat.chatType as "group" | "channel", id, link: chat.link });
        }
      }
      if (activeConversation?.chatType === "group" && activeConversation.group && (activeConversation.group.myRole === "owner" || activeConversation.group.myRole === "admin")) {
        candidates.set("group:" + activeConversation.group.id, { kind: "group", id: activeConversation.group.id, link: activeConversation.group.link });
      }
      if (activeConversation?.chatType === "channel" && activeConversation.channel?.ownerId === selfId) {
        candidates.set("channel:" + activeConversation.channel.id, { kind: "channel", id: activeConversation.channel.id, link: activeConversation.channel.link });
      }
      const pending = [...candidates.entries()].filter(([key]) => Date.now() - (sharedKeyReconcileAtRef.current[key] ?? 0) >= 30_000).slice(0, 8);
      for (const [key, target] of pending) {
        if (cancelled || currentUserIdRef.current !== selfId) break;
        sharedKeyReconcileAtRef.current[key] = Date.now();
        try {
          const result = await ensureSharedKeyForMembers(target.kind, target.link, target.id);
          if (result?.failedVersions?.length) delete sharedKeyReconcileAtRef.current[key];
        } catch { delete sharedKeyReconcileAtRef.current[key]; }
      }
    } finally { running = false; }
  };
  void reconcile();
  const timer = window.setInterval(() => { void reconcile(); }, 15_000);
  window.addEventListener("focus", reconcile);
  return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", reconcile); };
}

export interface DecryptSharedChatPreviewsContext {
  chats: ChatSummary[];
  decryptedPreviewFingerprintRef: React.RefObject<Record<string, string>>;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
  loadSharedKeyByVersion: (chatKeyId: string, version: number) => { version: number; keyBase64: string; createdAt: number } | null;
  ensureSharedKeyFromServer: (chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{ version: number; keyBase64: string; createdAt: number; } | null>;
  cryptoDiagnosticRef: React.RefObject<CryptoDiagnosticLogger>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
}

export function decryptSharedChatPreviews({ chats, decryptedPreviewFingerprintRef, buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, cryptoDiagnosticRef, setChats }: DecryptSharedChatPreviewsContext): (() => void) | undefined {
  if (chats.length === 0) {
    return;
  }

  let cancelled = false;
  const pending = chats
    .filter(
      (chat) =>
        isSharedChat(chat) &&
        canDecryptSharedPayload({
          cipherText: chat.lastMessageCipherText,
          iv: chat.lastMessageIv,
          keyVersion: chat.lastMessageKeyVersion ?? null,
        }) &&
        (chat.lastMessage === "Сообщение" || !chat.lastMessage.trim()) &&
        decryptedPreviewFingerprintRef.current[chat.link] !== chat.lastMessageAt,
    )
    .slice(0, CHAT_PREVIEW_DECRYPT_LIMIT);
  if (pending.length === 0) {
    return;
  }

  void (async () => {
    const decryptedPreviews = await Promise.all(
      pending.map(async (chat) => {
        const chatType = chat.chatType === "group" ? "group" : "channel";
        const chatId = resolveSharedChatIdFromSummary(chat);
        if (!chatId) {
          return { link: chat.link, lastMessageAt: chat.lastMessageAt, text: "Сообщение", ok: false };
        }
        const chatKeyId = buildSharedChatKeyId(chatType, chatId);
        const payload = {
          cipherText: chat.lastMessageCipherText as string,
          iv: chat.lastMessageIv as string,
          keyVersion: chat.lastMessageKeyVersion as number,
        };
        const decrypted = await decryptWithTextCache(
          buildSharedDecryptCacheKey({ chatType, chatLink: chat.link, ...payload }),
          () =>
            decryptSharedPayloadDeterministic({
              payload,
              chatType,
              chatLink: chat.link,
              resolveKeyByVersion: (version) => loadSharedKeyByVersion(chatKeyId, version)?.keyBase64 ?? null,
              fetchKeyByVersion: async (version) => {
                const fetched = await ensureSharedKeyFromServer(chatType, chat.link, chatId, version);
                return fetched?.version === version ? fetched.keyBase64 : null;
              },
              decryptWithKey: (keyBase64) =>
                decryptWithSharedKey({
                  cipherText: payload.cipherText,
                  iv: payload.iv,
                  keyBase64,
                }),
              fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
              logger: cryptoDiagnosticRef.current,
            }),
        );
        const prefix =
          chat.chatType === "group" && chat.lastMessageSenderAlias
            ? `${chat.lastMessageSenderAlias}: `
            : "";
        return {
          link: chat.link,
          lastMessageAt: chat.lastMessageAt,
          text: `${prefix}${decrypted}`,
          ok: decrypted !== "Сообщение",
        };
      }),
    );

    if (cancelled) return;
    const byLink = new Map(decryptedPreviews.map((item) => [item.link, item]));
    setChats((prev) => {
      let changed = false;
      const next = prev.map((chat) => {
        const item = byLink.get(chat.link);
        if (!item) return chat;
        if (item.ok) {
          decryptedPreviewFingerprintRef.current[chat.link] = item.lastMessageAt;
        }
        if (chat.lastMessageAt !== item.lastMessageAt) return chat;
        if (chat.lastMessage === item.text) return chat;
        changed = true;
        return { ...chat, lastMessage: item.text };
      });
      return changed ? next : prev;
    });
  })();

  return () => {
    cancelled = true;
  };
}

export interface PushOptimisticMessageActionContext {
  selfId: string | null;
  selfProfile: SelfProfile | null;
  currentUserIdRef: React.RefObject<string | null>;
  activeChat: ChatSummary | null;
  messages: DecryptedMessage[];
  replyToMessageId: string | null;
  messagesAtBottomRef: React.RefObject<boolean>;
  userSentMessageRef: React.RefObject<boolean>;
  setShowScrollToBottomButton: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
}

export function pushOptimisticMessageAction({ selfId, selfProfile, currentUserIdRef, activeChat, messages, replyToMessageId, messagesAtBottomRef, userSentMessageRef, setShowScrollToBottomButton, setActiveUnreadCount, setMessages, sanitizeMessages, setChats }: PushOptimisticMessageActionContext, payloadText: string, options?: { replyToMessageId?: string | null; id?: string }): string | null {
  const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
  if (!effectiveSelfId || !activeChat || !payloadText || !payloadText.trim()) return null;
  const optimisticId = options?.id ?? `optimistic:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const lastMsg = messages[messages.length - 1];
  const lastTs = lastMsg?.createdAt ? Date.parse(lastMsg.createdAt) : 0;
  const nowTs = Date.now();
  const effectiveTs = Math.max(nowTs, (Number.isNaN(lastTs) ? 0 : lastTs) + 1);
  const createdAt = new Date(effectiveTs).toISOString();
  const targetReplyId = options && "replyToMessageId" in options ? options.replyToMessageId : replyToMessageId ?? null;
  rememberOutgoingMessage({ id: optimisticId, localId: optimisticId, senderId: effectiveSelfId, text: payloadText, replyToMessageId: targetReplyId, createdAt, pending: true });

  messagesAtBottomRef.current = true;
  userSentMessageRef.current = true;
  setShowScrollToBottomButton(false);
  setActiveUnreadCount(0);
  setMessages((prev) =>
    appendAndSortMessages(sanitizeMessages(prev), {
      id: optimisticId,
      localId: optimisticId,
      senderId: effectiveSelfId,
      text: payloadText,
      replyToMessageId: targetReplyId,
      createdAt,
      pending: true,
    }),
  );

  setChats((prev) =>
    prev.map((chat) =>
      chat.link === activeChat.link && shouldApplyChatPreviewByTimestamp(chat.lastMessageAt, createdAt)
        ? {
          ...chat,
          lastMessage: payloadText,
          lastMessageAt: createdAt,
          lastMessageMine: true,
        }
        : chat,
    ),
  );

  return optimisticId;
}
