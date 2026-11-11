"use client";

import { type ChatSummary, type ConversationChatType, type ConversationResponse, type DecryptedMessage, type ProfileBatchItem, type ProfilePreview, type EncryptedMessage, type GroupMessagePayload, type ChannelMessagePayload, type EclipseSystemMessagePayload } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type CryptoDiagnosticLogger, decryptDirectPayloadDeterministic, decryptSharedPayloadDeterministic } from "@/lib/client/e2e-decrypt-pipeline";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { matchesOrdinaryDirectChat } from "@/lib/client/direct-chat-summary";
import { bindSecretDeviceKey, loadSecretDeviceIdentity } from "@/lib/client/secret-device-keys";
import { withoutChatLocation } from "@/lib/client/chat-location";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { peekFailedMessages, readFailedMessages } from "@/lib/client/failed-message-store";
import { ECLIPSE_LIST_STATUS } from "@/lib/eclipse-system";
import { decryptWithSharedKey } from "@/lib/client/e2e";
import { ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT } from "../chat-message-transport";
import { compareMessagesByTime, mergeMessageWindow } from "../chat-message-state";
import { deduplicateChatSummaries } from "../chat-realtime-chatlist";
import { buildConversationCacheKey, decryptWithTextCache, buildDirectDecryptCacheKey, readConversationMemoryCache, loadConversationSessionCache, loadConversationPersistentCache, normalizeConversationCacheSnapshot, isConversationCacheValid, clearConversationCaches, cacheConversationSnapshot, buildSharedDecryptCacheKey, writeConversationMemoryCache, canDecryptPayload } from "./chat-cache";
import { CONVERSATION_CACHE_TTL_MS, CONVERSATION_CACHE_STALE_MAX_MS, DIRECT_MESSAGES_LIMIT_DESKTOP, DIRECT_MESSAGES_LIMIT_MOBILE } from "./config";
import { contactDisplayName } from "./profile-primitives";

export interface OpenConversationActionContext {
  chats: ChatSummary[];
  selectedSearchTargetRef: React.RefObject<{ link: string; chatType: ConversationChatType; isBot?: boolean | undefined; } | null>;
  openConversationInFlightRef: React.RefObject<Map<string, number>>;
  conversationRequestSeqRef: React.RefObject<number>;
  selectedLinkRef: React.RefObject<string | null>;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setHasMoreMessagesBefore: React.Dispatch<React.SetStateAction<boolean>>;
  setDecryptingConversation: React.Dispatch<React.SetStateAction<boolean>>;
  setInspectedDetailsEntity: React.Dispatch<React.SetStateAction<{ type: "direct" | "group" | "channel"; link: string; } | null>>;
  setLoadingConversation: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  currentUserIdRef: React.RefObject<string | null>;
  selfId: string | null;
  setSecretChatExpiresAt: React.Dispatch<React.SetStateAction<string | null>>;
  ensureOwnE2EReady: (options?: { allowPrompt?: boolean | undefined; } | undefined) => Promise<{ privateKey: CryptoKey; publicKeyBase64: string; privateKeyBase64: string | null; }>;
  decryptMessageWithRecovery: (params: { privateKey: CryptoKey; cipherText: string; iv: string; encryptedKey: string; }) => Promise<string>;
  cryptoDiagnosticRef: React.RefObject<CryptoDiagnosticLogger>;
  unreadByLink: Record<string, number>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  ensureProfilesBatch: (userIds: string[]) => Promise<void>;
  sendReadReceipt: (link: string, chatType: ConversationChatType, messageIds: string[]) => Promise<void>;
  setErrorText: (message: string | null) => void;
  isDesktop: boolean;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  router: AppRouterInstance;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setReadReceiptMarker: (link: string, isoTime: string) => void;
  mergeProfilesToCache: (profiles: ProfileBatchItem[]) => void;
  peerPublicKeyByLinkRef: React.RefObject<Record<string, string>>;
  messagesRef: React.RefObject<DecryptedMessage[]>;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
  loadSharedKeyByVersion: (chatKeyId: string, version: number) => { version: number; keyBase64: string; createdAt: number } | null;
  ensureSharedKeyFromServer: (chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{ version: number; keyBase64: string; createdAt: number; } | null>;
  privateKeyRef: React.RefObject<CryptoKey | null>;
  suppressRequestedChatSyncRef: React.RefObject<boolean>;
  setProfileData: React.Dispatch<React.SetStateAction<ProfilePreview | null>>;
  setDesktopDetailsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export async function openConversationAction({ chats, selectedSearchTargetRef, openConversationInFlightRef, conversationRequestSeqRef, selectedLinkRef, activeConversationRef, setActiveConversation, setMessages, setHasMoreMessagesBefore, setDecryptingConversation, setInspectedDetailsEntity, setLoadingConversation, t, currentUserIdRef, selfId, setSecretChatExpiresAt, ensureOwnE2EReady, decryptMessageWithRecovery, cryptoDiagnosticRef, unreadByLink, sanitizeMessages, ensureProfilesBatch, sendReadReceipt, setErrorText, isDesktop, setSelectedLink, router, setChats, setReadReceiptMarker, mergeProfilesToCache, peerPublicKeyByLinkRef, messagesRef, buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, privateKeyRef, suppressRequestedChatSyncRef, setProfileData, setDesktopDetailsPanelOpen, setProfileModalOpen }: OpenConversationActionContext, link: string, options?: { force?: boolean; revalidate?: boolean; chatType?: ConversationChatType }): Promise<void> {
  const candidateType = options?.chatType ?? chats.find(chat => chat.link === link)?.chatType;
  const candidateKey = candidateType ? buildConversationCacheKey(link, candidateType) : link;
  if (!link.startsWith("secret-") && !options?.force && selectedSearchTargetRef.current?.link !== link &&
    openConversationInFlightRef.current.get(candidateKey) === conversationRequestSeqRef.current) return;
  const requestSeq = conversationRequestSeqRef.current + 1;
  conversationRequestSeqRef.current = requestSeq;
  const failedAccount = currentUserIdRef.current ?? selfId;
  const failedTarget = `${candidateType ?? "direct"}:${link}`;
  const localFailed = () => failedAccount && !link.startsWith("secret-") ? peekFailedMessages(failedAccount, failedTarget) : [];
  const withFailed = (base: DecryptedMessage[]) => sanitizeMessages(mergeMessageWindow(base, localFailed().filter(message => !base.some(existing => existing.id === message.id || existing.localId === message.id))));

  const currentLink = selectedLinkRef.current;
  const currentConversation = activeConversationRef.current;
  const isSecretLink = link?.startsWith("secret-");
  const wasSecret = currentConversation?.conversationId?.startsWith("secret:") || currentLink?.startsWith("secret-");
  const isSameChat = currentLink === link && Boolean(isSecretLink) === Boolean(wasSecret);
  if (!isSameChat) {
    setActiveConversation(null);
    setMessages(withFailed([]));
    setHasMoreMessagesBefore(false);
    setDecryptingConversation(false);
    setInspectedDetailsEntity(null);
  }

  if (failedAccount && !isSecretLink) {
    void readFailedMessages(failedAccount, failedTarget).then(() => {
      if (requestSeq !== conversationRequestSeqRef.current || currentUserIdRef.current !== failedAccount) return;
      if (localFailed().length) setMessages(previous => withFailed(previous));
    });
  }

  if (link?.startsWith("secret-")) {
    setLoadingConversation(true);
    const secretChatId = link.substring("secret-".length);
    try {
      const res = await apiRequest<{
        chatType: string;
        conversationId: string;
        expiresAt: string | null;
        isApproved: boolean;
        isCreator: boolean;
        creatorId: string;
        secretCrypto?: ConversationResponse["secretCrypto"];
        peer: { id: string; link: string; displayName: string; avatarUrl: string | null; publicKey?: string };
        messages: any[];
      }>('/api/chats/' + encodeURIComponent(link));

      if (res) {
        if (requestSeq !== conversationRequestSeqRef.current) return;
        const peer = res.peer || { id: secretChatId, link, displayName: t("Секретный чат"), avatarUrl: null };
        const secretOwnerId = currentUserIdRef.current ?? selfId ??
          (res.secretCrypto?.version === 2 ? (await apiRequest<{ id: string }>("/api/auth/me")).id : "");
        if (requestSeq !== conversationRequestSeqRef.current) return;

        if (res.secretCrypto?.version === 2 && res.secretCrypto.ownKeyId) {
          await bindSecretDeviceKey(secretOwnerId, secretChatId, res.secretCrypto, peer.publicKey ?? null, res.expiresAt);
          if (requestSeq !== conversationRequestSeqRef.current) return;
        }

        const conversationObj: ConversationResponse = {
          id: secretChatId,
          conversationId: res.conversationId,
          chatType: "direct",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isApproved: res.isApproved,
          isCreator: res.isCreator,
          creatorId: res.creatorId,
          secretCrypto: res.secretCrypto,
          expiresAt: res.expiresAt,
          peerId: peer.id,
          peer: {
            id: peer.id,
            link: peer.link,
            displayName: peer.displayName,
            avatarUrl: peer.avatarUrl,
            publicKey: peer.publicKey || "",
          },
          messages: [],
          isGroupOwner: false,
        } as any;

        setActiveConversation(conversationObj);
        setSecretChatExpiresAt(res.expiresAt || null);

        // Decrypt loaded messages chunk-by-chunk
        setDecryptingConversation(true);
        const rawMessages = res.messages || [];
        let secretPrivateKey: CryptoKey | null = null;
        try {
          const identity = res.secretCrypto?.version === 2
            ? res.secretCrypto.ownKeyId ? await loadSecretDeviceIdentity(secretOwnerId, res.secretCrypto) : null
            : await ensureOwnE2EReady();
          if (requestSeq !== conversationRequestSeqRef.current) return;
          secretPrivateKey = identity?.privateKey ?? null;
        } catch (err) {
          console.error("Failed to load E2E private key for secret chat:", err);
        }

        const decrypted: DecryptedMessage[] = [];
        const BATCH_SIZE = 100;
        for (let i = 0; i < rawMessages.length; i += BATCH_SIZE) {
          const chunk = rawMessages.slice(i, i + BATCH_SIZE);
          const chunkResult = await Promise.all(
            chunk.map(async (message) => {
              if (message.text && !message.cipherText) {
                return {
                  id: message.id,
                  senderId: message.senderId,
                  text: message.text,
                  replyToMessageId: message.replyToMessageId ?? null,
                  createdAt: message.createdAt,
                  reactions: message.reactions ?? [],
                };
              }
              if (!secretPrivateKey || !message.cipherText || !message.iv || !message.encryptedKey) {
                return {
                  id: message.id,
                  senderId: message.senderId,
                  text: message.text || ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
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
              try {
                const text = await decryptWithTextCache(
                  buildDirectDecryptCacheKey(payload),
                  () =>
                    decryptDirectPayloadDeterministic({
                      payload,
                      tryPrimary: () =>
                        decryptMessageWithRecovery({
                          privateKey: secretPrivateKey!,
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
                  reactions: message.reactions ?? [],
                };
              } catch {
                return {
                  id: message.id,
                  senderId: message.senderId,
                  text: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
                  replyToMessageId: message.replyToMessageId ?? null,
                  createdAt: message.createdAt,
                  reactions: message.reactions ?? [],
                };
              }
            })
          );
          if (requestSeq !== conversationRequestSeqRef.current) return;
          decrypted.push(...chunkResult);
        }

        if (requestSeq !== conversationRequestSeqRef.current) return;
        setDecryptingConversation(false);
        setMessages(decrypted.sort(compareMessagesByTime));
      }
    } catch (err) {
      if (requestSeq !== conversationRequestSeqRef.current) return;
      console.error("Failed to load secret chat detail:", err);
    } finally {
      if (requestSeq === conversationRequestSeqRef.current) {
        setLoadingConversation(false);
      }
    }
    return;
  }
  const forceReload = Boolean(options?.force || selectedSearchTargetRef.current?.link === link);
  const preferredChatType = options?.chatType ?? chats.find((chat) => chat.link === link)?.chatType;
  const inFlightKey = preferredChatType ? buildConversationCacheKey(link, preferredChatType) : link;
  openConversationInFlightRef.current.set(inFlightKey, requestSeq);
  const cachedConversation = selfId && preferredChatType ? readConversationMemoryCache(selfId, link, preferredChatType) : null;
  const sessionConversation =
    !cachedConversation && selfId && preferredChatType ? loadConversationSessionCache(selfId, link, preferredChatType) : null;
  const persistentConversation =
    !cachedConversation && !sessionConversation && selfId && preferredChatType
      ? loadConversationPersistentCache(selfId, link, preferredChatType)
      : null;
  let effectiveCached = cachedConversation ?? sessionConversation ?? persistentConversation;
  effectiveCached = effectiveCached ? normalizeConversationCacheSnapshot(effectiveCached, selfId) : null;
  if (effectiveCached && preferredChatType && !isConversationCacheValid(effectiveCached, selfId)) {
    clearConversationCaches(selfId ?? null, link, preferredChatType);
    effectiveCached = null;
  }
  const cacheAge = effectiveCached ? Date.now() - (effectiveCached.savedAt ?? 0) : Number.POSITIVE_INFINITY;
  const hasCachedMessages = Boolean(effectiveCached?.messages && effectiveCached.messages.length > 0);
  const canUseCachedConversation =
    Boolean(effectiveCached) && hasCachedMessages && (cacheAge <= CONVERSATION_CACHE_TTL_MS || !navigator.onLine);
  const isStaleCache =
    Boolean(effectiveCached) &&
    cacheAge > CONVERSATION_CACHE_TTL_MS &&
    (cacheAge <= CONVERSATION_CACHE_STALE_MAX_MS || !navigator.onLine);
  const cachedVisibleMessages = effectiveCached?.messages ?? [];
  const summary = chats.find((chat) => chat.link === link);
  const summaryLastAt = summary?.lastMessageAt ? Date.parse(summary.lastMessageAt) : Number.NaN;
  const cachedLastAt = effectiveCached?.messages?.length
    ? Date.parse(effectiveCached.messages[effectiveCached.messages.length - 1]?.createdAt ?? "")
    : Number.NaN;
  const cacheBehind =
    Number.isFinite(summaryLastAt) &&
    (Number.isFinite(cachedLastAt)
      ? summaryLastAt > cachedLastAt + 1000
      : true);
  const hasUnread = Boolean(unreadByLink[link]);
  const shouldRefresh = forceReload || hasUnread || cacheBehind || !hasCachedMessages || Boolean(options?.revalidate && navigator.onLine);

  if ((canUseCachedConversation || isStaleCache) && effectiveCached) {
    setActiveConversation(effectiveCached.conversation);
    setMessages(withFailed(effectiveCached.messages));
    setHasMoreMessagesBefore(Boolean(effectiveCached.conversation.hasMoreBefore));
    setLoadingConversation(isStaleCache || shouldRefresh);
    const cachedProfileIds = new Set<string>();
    if (effectiveCached.conversation.chatType === "direct" && effectiveCached.conversation.peer?.id) {
      cachedProfileIds.add(effectiveCached.conversation.peer.id);
    }
    if (effectiveCached.conversation.chatType === "group") {
      effectiveCached.conversation.members?.forEach((member) => cachedProfileIds.add(member.id));
      effectiveCached.messages.forEach((message) => cachedProfileIds.add(message.senderId));
    }
    if (effectiveCached.conversation.chatType === "channel") {
      if (effectiveCached.conversation.channel?.ownerId) {
        cachedProfileIds.add(effectiveCached.conversation.channel.ownerId);
      }
      effectiveCached.messages.forEach((message) => cachedProfileIds.add(message.senderId));
    }
    if (cachedProfileIds.size > 0) {
      void ensureProfilesBatch(Array.from(cachedProfileIds));
    }
    if (!shouldRefresh && !isStaleCache) {
      if (effectiveCached.conversation.chatType !== "saved" && effectiveCached.conversation.chatType !== "eclipse" && selfId) {
        const cachedChatType = effectiveCached.conversation.chatType ?? preferredChatType ?? "direct";
        const incomingMessageIds = effectiveCached.messages
          .filter((message) => message.senderId !== selfId)
          .map((message) => message.id);
        if (incomingMessageIds.length > 0) {
          void sendReadReceipt(link, cachedChatType, incomingMessageIds);
        }
      }
      if ((sessionConversation || persistentConversation) && !cachedConversation) {
        cacheConversationSnapshot(selfId, link, effectiveCached, effectiveCached.conversation.chatType);
      }
      if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
      return;
    }
  } else {
    setLoadingConversation(true);
  }
  setErrorText(null);

  try {
    const messageLimit = isDesktop ? DIRECT_MESSAGES_LIMIT_DESKTOP : DIRECT_MESSAGES_LIMIT_MOBILE;
    const query = new URLSearchParams({ limit: String(messageLimit) });
    if (preferredChatType) {
      query.set("chatType", preferredChatType);
    }
    const data = await apiRequest<ConversationResponse>(`/api/chats/${encodeURIComponent(link)}?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (requestSeq !== conversationRequestSeqRef.current) return;

    if (link.startsWith("secret-") && data.secretCrypto?.version === 2 && data.secretCrypto.ownKeyId) {
      await bindSecretDeviceKey(selfId ?? "", link.substring("secret-".length), data.secretCrypto, data.peer?.publicKey ?? null, data.expiresAt);
      if (requestSeq !== conversationRequestSeqRef.current) return;
    }
    setActiveConversation(data);
    if (data.chatType === "direct" && data.peer && !link.startsWith("secret-")) {
      const canonicalPeerLink = data.peer.link?.trim().toLowerCase().replace(/^@+/, "");
      const requestedNormalized = link.trim().toLowerCase().replace(/^@+/, "");
      if (canonicalPeerLink && canonicalPeerLink !== requestedNormalized) {
        selectedLinkRef.current = canonicalPeerLink;
        setSelectedLink(canonicalPeerLink);
        router.replace(`/app?chat=${encodeURIComponent(canonicalPeerLink)}&chatType=direct`, { scroll: false });
      }
      setChats((prev) =>
        prev
          .filter((c) => {
            const isTarget = matchesOrdinaryDirectChat(c, { requestedLink: requestedNormalized, canonicalLink: canonicalPeerLink, peerId: data.peer?.id });
            if (isTarget && (!data.messages || data.messages.length === 0) && (c.isTemporary || !c.lastMessage)) {
              return false;
            }
            return true;
          })
          .map((c) =>
            matchesOrdinaryDirectChat(c, { requestedLink: requestedNormalized, canonicalLink: canonicalPeerLink, peerId: data.peer?.id })
              ? {
                ...c,
                link: canonicalPeerLink || c.link,
                peerId: data.peer!.id || c.peerId,
                displayName: data.peer!.contactAlias === undefined ? contactDisplayName(c, data.peer!.displayName) : data.peer!.contactAlias?.trim() || data.peer!.displayName || c.displayName,
                contactAlias: data.peer!.contactAlias === undefined ? c.contactAlias : data.peer!.contactAlias,
                avatarUrl: data.peer!.avatarUrl !== undefined ? data.peer!.avatarUrl : c.avatarUrl,
                wallpaperUrl: data.wallpaperUrl !== undefined ? (data.wallpaperUrl ?? null) : c.wallpaperUrl,
                wallpaperPosY: data.wallpaperPosY !== undefined ? (data.wallpaperPosY ?? null) : c.wallpaperPosY,
                isTemporary: Boolean(data.messages && data.messages.length > 0 ? false : c.isTemporary),
              }
              : c
          )
      );
    } else if (data.chatType === "direct" && data.wallpaperUrl !== undefined) {
      setChats((prev) =>
        prev.map((c) =>
          c.link === link
            ? { ...c, wallpaperUrl: data.wallpaperUrl ?? null, wallpaperPosY: data.wallpaperPosY ?? null }
            : c
        )
      );
    }
    if (link.startsWith("secret-") && (data as any)?.codeword) {
      try {
        localStorage.setItem(`secret_codeword_${link.substring("secret-".length)}`, (data as any).codeword.trim().toLowerCase());
      } catch { }
    }
    setHasMoreMessagesBefore(Boolean(data.hasMoreBefore));
    if (data.chatType === "direct" && data.readReceiptAt) {
      setReadReceiptMarker(link, data.readReceiptAt);
    }
    const profileIds = new Set<string>();
    if (data.chatType === "direct" && data.peer?.id) {
      profileIds.add(data.peer.id);
    }
    if (data.chatType === "group") {
      data.members?.forEach((member) => profileIds.add(member.id));
      (data.messages as GroupMessagePayload[]).forEach((message) => profileIds.add(message.senderId));
      if (data.members?.length) {
        mergeProfilesToCache(
          data.members.map((member) => ({
            id: member.id,
            link: member.link,
            displayName: member.displayName,
            avatarUrl: member.avatarUrl ?? null,
            createdAt: undefined,
          })),
        );
      }
    }
    if (data.chatType === "channel") {
      if (data.channel?.ownerId) profileIds.add(data.channel.ownerId);
      (data.messages as ChannelMessagePayload[]).forEach((message) => profileIds.add(message.senderId));
    }
    if (data.chatType === "direct" || data.chatType === "saved") {
      (data.messages as EncryptedMessage[]).forEach((message) => profileIds.add(message.senderId));
    }
    if (profileIds.size > 0) {
      void ensureProfilesBatch(Array.from(profileIds));
    }
    if (data.chatType === "direct" && data.peer?.link && data.peer.publicKey && !data.peer.publicKey.startsWith("encdet:v1:")) {
      peerPublicKeyByLinkRef.current[data.peer.link] = data.peer.publicKey;
    }

    const resolveMessageMergeBase = () => {
      const liveConversationId = activeConversationRef.current?.conversationId;
      const sameConversationLive =
        selectedLinkRef.current === link &&
        Boolean(liveConversationId) &&
        Boolean(data.conversationId) &&
        liveConversationId === data.conversationId;
      if (sameConversationLive && messagesRef.current.length > 0) {
        return withFailed(messagesRef.current);
      }
      return withFailed(cachedVisibleMessages);
    };

    setChats((prev) => {
      const lookupLink =
        data.chatType === "group"
          ? data.group?.link
          : data.chatType === "channel"
            ? data.channel?.link
            : data.chatType === "saved"
              ? data.saved?.link
              : data.chatType === "eclipse"
                ? data.eclipse?.link
                : data.peer?.link;
      const displayName =
        data.chatType === "group"
          ? data.group?.name
          : data.chatType === "channel"
            ? data.channel?.name
            : data.chatType === "saved"
              ? data.saved?.title
              : data.chatType === "eclipse"
                ? data.eclipse?.title
                : data.peer?.contactAlias?.trim() || data.peer?.displayName;
      const avatarUrl =
        data.chatType === "group"
          ? data.group?.avatarUrl
          : data.chatType === "channel"
            ? data.channel?.avatarUrl
            : data.chatType === "saved"
              ? data.saved?.avatarUrl
              : data.chatType === "eclipse"
                ? data.eclipse?.avatarUrl
                : data.peer?.avatarUrl;
      const peerId =
        data.chatType === "group"
          ? data.group?.id
          : data.chatType === "channel"
            ? data.channel?.id
            : data.chatType === "saved"
              ? selfId
              : data.chatType === "eclipse"
                ? data.conversationId
                : data.peer?.id;
      if (!lookupLink || !displayName || !peerId) {
        return prev;
      }

      const isMatchingDirectChat = (item: ChatSummary) => {
        const isDirect = (item.chatType ?? "direct") === "direct" && !item.link?.startsWith("secret-") && !item.conversationId?.startsWith("secret:");
        if (!isDirect) return false;
        if (peerId && item.peerId && item.peerId === peerId) return true;
        return item.link === lookupLink;
      };

      const existing = prev.find((item) =>
        data.chatType === "direct" || !data.chatType
          ? isMatchingDirectChat(item)
          : item.link === lookupLink,
      );

      if (existing) {
        if (
          (data.chatType === "direct" || !data.chatType) &&
          (!data.messages || data.messages.length === 0) &&
          (existing.isTemporary || !existing.lastMessage)
        ) {
          return deduplicateChatSummaries(prev.filter((item) => item !== existing));
        }
        if (existing.link !== lookupLink || existing.displayName !== displayName || (avatarUrl && existing.avatarUrl !== avatarUrl)) {
          return deduplicateChatSummaries(
            prev.map((item) =>
              item === existing
                ? {
                  ...item,
                  link: lookupLink,
                  displayName: data.peer?.contactAlias === undefined ? contactDisplayName(item, displayName) : data.peer.contactAlias?.trim() || displayName,
                  contactAlias: data.peer?.contactAlias === undefined ? item.contactAlias : data.peer.contactAlias,
                  avatarUrl: avatarUrl ?? item.avatarUrl,
                }
                : item,
            ),
          );
        }
        return deduplicateChatSummaries(prev);
      }

      if ((data.chatType === "direct" || !data.chatType) && (!data.messages || data.messages.length === 0)) {
        return prev;
      }

      const newChat: ChatSummary = {
        chatType:
          data.chatType === "group"
            ? "group"
            : data.chatType === "channel"
              ? "channel"
              : data.chatType === "saved"
                ? "saved"
                : data.chatType === "eclipse"
                  ? "eclipse"
                  : "direct",
        conversationId: data.conversationId ?? `temp:${peerId}`,
        peerId,
        link: lookupLink,
        displayName,
        contactAlias: data.peer?.contactAlias ?? null,
        avatarUrl: avatarUrl ?? null,
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        lastMessageMine: false,
        isTemporary: true,
        ...(data.chatType === "eclipse"
          ? {
            isSystem: true,
            isVerified: true,
            statusText: data.eclipse?.statusText ?? ECLIPSE_LIST_STATUS,
          }
          : {}),
      };

      return deduplicateChatSummaries([newChat, ...prev]);
    });

    if (data.chatType === "eclipse") {
      const eclipseMessages = (data.messages as EclipseSystemMessagePayload[]).map((message) => ({
        id: message.id,
        senderId: message.senderId,
        text: message.systemPayload?.botRole === "user" ? message.systemPayload.body : message.systemPayload?.title ?? "",
        systemPayload: message.systemPayload,
        createdAt: message.createdAt,
        reactions: message.reactions ?? [],
      }));
      const sortedEclipseMessages = eclipseMessages.sort(compareMessagesByTime);
      const nextEclipseMessages = sanitizeMessages(mergeMessageWindow(resolveMessageMergeBase(), sortedEclipseMessages));
      setMessages(nextEclipseMessages);
      cacheConversationSnapshot(selfId, link, {
        savedAt: Date.now(),
        conversation: data,
        messages: nextEclipseMessages,
      }, "eclipse");
      const incomingEclipseMessageIds = eclipseMessages.map((message) => message.id);
      if (incomingEclipseMessageIds.length > 0) {
        void sendReadReceipt(link, "eclipse", incomingEclipseMessageIds);
      }
      setLoadingConversation(false);
      setDecryptingConversation(false);
      if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
      return;
    }

    if (data.chatType === "group") {
      const groupMessages = data.messages as GroupMessagePayload[];
      const incomingGroupMessageIds =
        selfId
          ? groupMessages
            .filter((message) => message.senderId !== selfId)
            .map((message) => message.id)
          : [];
      if (incomingGroupMessageIds.length > 0) {
        void sendReadReceipt(link, "group", incomingGroupMessageIds);
      }
      const hasEncrypted = groupMessages.some((message) => message.cipherText && message.iv && message.keyVersion);
      if (!hasEncrypted) {
        const normalized = groupMessages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          text: message.text ?? "",
          replyToMessageId: message.replyToMessageId ?? null,
          createdAt: message.createdAt,
          senderDisplayName: message.senderDisplayName,
          reactions: message.reactions ?? [],
          readBy: message.readBy ?? [],
        }));
        const sortedGroupMessages = normalized.sort(compareMessagesByTime);
        const nextGroupMessages = sanitizeMessages(mergeMessageWindow(resolveMessageMergeBase(), sortedGroupMessages));
        setMessages(nextGroupMessages);
        cacheConversationSnapshot(selfId, link, {
          savedAt: Date.now(),
          conversation: data,
          messages: nextGroupMessages,
        }, "group");
        setLoadingConversation(false);
        setDecryptingConversation(false);
        if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
        return;
      }

      setDecryptingConversation(true);
      void (async () => {
        try {
          const chatId = data.group?.id ?? "";
          const chatKeyId = chatId ? buildSharedChatKeyId("group", chatId) : null;
          const decrypted: DecryptedMessage[] = [];
          const BATCH_SIZE = 100;
          for (let i = 0; i < groupMessages.length; i += BATCH_SIZE) {
            const chunk = groupMessages.slice(i, i + BATCH_SIZE);
            const result = await Promise.all(
              chunk.map(async (message) => {
                if ((message as any).isSystemMessage || (message as any).systemPayload) {
                  return {
                    id: message.id,
                    senderId: message.senderId,
                    text: (message as EncryptedMessage & { systemPayload?: { title?: string } }).systemPayload?.title ?? message.text ?? "",
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
            decrypted.push(...result);
            if (requestSeq === conversationRequestSeqRef.current) {
              const liveBase = resolveMessageMergeBase();
              const partialGroupMessages = sanitizeMessages(mergeMessageWindow(
                liveBase,
                decrypted,
              ));
              setMessages(partialGroupMessages);
            }
            await new Promise<void>((resolve) => {
              if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
                window.requestAnimationFrame(() => resolve());
                return;
              }
              setTimeout(() => resolve(), 0);
            });
          }
          if (requestSeq !== conversationRequestSeqRef.current) {
            cacheConversationSnapshot(selfId, link, {
              savedAt: Date.now(),
              conversation: data,
              messages: sanitizeMessages(decrypted),
            }, "group");
            return;
          }
          const nextGroupMessages = sanitizeMessages(decrypted);
          setMessages(nextGroupMessages);
          cacheConversationSnapshot(selfId, link, {
            savedAt: Date.now(),
            conversation: data,
            messages: nextGroupMessages,
          }, "group");
        } catch (err) {
          console.error("Group decryption error:", err);
        } finally {
          setDecryptingConversation(false);
          setLoadingConversation(false);
          if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
        }
      })();
      return;
    }

    if (data.chatType === "channel") {
      const channelMessages = data.messages as ChannelMessagePayload[];
      const incomingChannelMessageIds =
        selfId
          ? channelMessages
            .filter((message) => message.senderId !== selfId)
            .map((message) => message.id)
          : [];
      if (incomingChannelMessageIds.length > 0) {
        void sendReadReceipt(link, "channel", incomingChannelMessageIds);
      }
      const hasEncrypted = channelMessages.some((message) => message.cipherText && message.iv && message.keyVersion);
      if (!hasEncrypted) {
        const normalized = channelMessages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          text: message.text ?? "",
          replyToMessageId: message.replyToMessageId ?? null,
          createdAt: message.createdAt,
          viewsCount: message.viewsCount,
          reactions: message.reactions ?? [],
        }));
        const sortedChannelMessages = normalized.sort(compareMessagesByTime);
        const nextChannelMessages = sanitizeMessages(mergeMessageWindow(resolveMessageMergeBase(), sortedChannelMessages));
        setMessages(nextChannelMessages);
        cacheConversationSnapshot(selfId, link, {
          savedAt: Date.now(),
          conversation: data,
          messages: nextChannelMessages,
        }, "channel");
        setLoadingConversation(false);
        setDecryptingConversation(false);
        if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
        return;
      }

      setDecryptingConversation(true);
      void (async () => {
        try {
          const chatId = data.channel?.id ?? "";
          const chatKeyId = chatId ? buildSharedChatKeyId("channel", chatId) : null;
          const decrypted: DecryptedMessage[] = [];
          const BATCH_SIZE = 100;
          for (let i = 0; i < channelMessages.length; i += BATCH_SIZE) {
            const chunk = channelMessages.slice(i, i + BATCH_SIZE);
            const result = await Promise.all(
              chunk.map(async (message) => {
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
            decrypted.push(...result);
            if (requestSeq === conversationRequestSeqRef.current) {
              const liveBase = resolveMessageMergeBase();
              const partialChannelMessages = sanitizeMessages(mergeMessageWindow(
                liveBase,
                decrypted,
              ));
              setMessages(partialChannelMessages);
            }
            await new Promise<void>((resolve) => {
              if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
                window.requestAnimationFrame(() => resolve());
                return;
              }
              setTimeout(() => resolve(), 0);
            });
          }
          if (requestSeq !== conversationRequestSeqRef.current) {
            cacheConversationSnapshot(selfId, link, {
              savedAt: Date.now(),
              conversation: data,
              messages: sanitizeMessages(decrypted),
            }, "channel");
            return;
          }
          const nextChannelMessages = sanitizeMessages(decrypted);
          setMessages(nextChannelMessages);
          cacheConversationSnapshot(selfId, link, {
            savedAt: Date.now(),
            conversation: data,
            messages: nextChannelMessages,
          }, "channel");
        } catch (err) {
          console.error("Channel decryption error:", err);
        } finally {
          setDecryptingConversation(false);
          setLoadingConversation(false);
          if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
        }
      })();
      return;
    }

    if (data.chatType === "direct" && data.peer?.isBot && !link.startsWith("secret-")) {
      const incoming = (data.messages as EncryptedMessage[]).map(message => ({
        id: message.id, senderId: message.senderId, text: message.text ?? (message as any).systemPayload?.title ?? "",
        createdAt: message.createdAt, replyToMessageId: message.replyToMessageId, reactions: message.reactions ?? [],
        botReplyMarkup: message.botReplyMarkup, systemPayload: (message as any).systemPayload,
      }));
      setMessages(previous => sanitizeMessages(mergeMessageWindow(previous, incoming)));
      setDecryptingConversation(false);
      return;
    }
    const directMessages = data.messages as EncryptedMessage[];
    const incomingDirectMessageIds =
      selfId
        ? directMessages
          .filter((message) => message.senderId !== selfId)
          .map((message) => message.id)
        : [];
    if (incomingDirectMessageIds.length > 0) {
      void sendReadReceipt(link, "direct", incomingDirectMessageIds);
    }

    setDecryptingConversation(true);

    void (async () => {
      try {
        let activePrivateKey = data.secretCrypto?.version === 2
          ? (await loadSecretDeviceIdentity(selfId ?? "", data.secretCrypto)).privateKey
          : privateKeyRef.current;
        if (!activePrivateKey) {
          try {
            const identity = await ensureOwnE2EReady();
            activePrivateKey = identity.privateKey;
          } catch (err) {
            console.error("Failed to load E2E private key for direct chat:", err);
          }
        }

        if (!activePrivateKey) {
          const fallback = directMessages.map((message) => {
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
            return {
              id: message.id,
              senderId: message.senderId,
              text: message.text || "Сообщение",
              replyToMessageId: message.replyToMessageId ?? null,
              createdAt: message.createdAt,
              reactions: message.reactions ?? [],
            };
          });
          const sortedFallback = fallback.sort(compareMessagesByTime);
          const nextFallbackMessages = sanitizeMessages(mergeMessageWindow(resolveMessageMergeBase(), sortedFallback));
          setMessages(nextFallbackMessages);
          writeConversationMemoryCache(selfId, link, "direct", {
            savedAt: Date.now(),
            conversation: data,
            messages: nextFallbackMessages,
          });
          return;
        }

        const decrypted: DecryptedMessage[] = [];
        const BATCH_SIZE = 100;
        for (let i = 0; i < directMessages.length; i += BATCH_SIZE) {
          const chunk = directMessages.slice(i, i + BATCH_SIZE);
          const result = await Promise.all(
            chunk.map(async (message) => {
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
              if (message.text && !message.cipherText) {
                return {
                  id: message.id,
                  senderId: message.senderId,
                  text: message.text,
                  replyToMessageId: message.replyToMessageId ?? null,
                  createdAt: message.createdAt,
                  systemPayload: (message as any).systemPayload,
                  reactions: message.reactions ?? [],
                };
              }
              if (!canDecryptPayload(message)) {
                return {
                  id: message.id,
                  senderId: message.senderId,
                  text: message.text || ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
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
                        privateKey: activePrivateKey!,
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
          decrypted.push(...result);
          if (requestSeq === conversationRequestSeqRef.current) {
            const liveBase = resolveMessageMergeBase();
            const partialDirectMessages = sanitizeMessages(mergeMessageWindow(
              liveBase,
              decrypted,
            ));
            setMessages(partialDirectMessages);
          }
          // Yield to the browser to keep scrolling/taps responsive during decryption.
          await new Promise<void>((resolve) => {
            if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
              window.requestAnimationFrame(() => resolve());
              return;
            }
            setTimeout(() => resolve(), 0);
          });
        }

        if (requestSeq !== conversationRequestSeqRef.current) {
          cacheConversationSnapshot(selfId, link, {
            savedAt: Date.now(),
            conversation: data,
            messages: sanitizeMessages(decrypted),
          }, "direct");
          return;
        }
        const nextDirectMessages = sanitizeMessages(decrypted);
        setMessages(nextDirectMessages);
        cacheConversationSnapshot(selfId, link, {
          savedAt: Date.now(),
          conversation: data,
          messages: nextDirectMessages,
        }, "direct");
      } catch (err) {
        console.error("Direct decryption error:", err);
      } finally {
        setDecryptingConversation(false);
        setLoadingConversation(false);
        if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
      }
    })();
  } catch (error) {
    if (requestSeq !== conversationRequestSeqRef.current) return;
    const errorMsg = error instanceof Error ? error.message : t("Ошибка инициализации профиля");
    if (options?.revalidate && hasCachedMessages && (canUseCachedConversation || isStaleCache)
      && (error instanceof TypeError || /^HTTP 5\d\d\b|^Нестабильное соединение/.test(errorMsg))) {
      setDecryptingConversation(false);
      return;
    }
    const isNotFound =
      errorMsg.includes("404") ||
      errorMsg.toLowerCase().includes("not found") ||
      errorMsg.toLowerCase().includes("не найден") ||
      errorMsg.toLowerCase().includes("не существует") ||
      errorMsg.toLowerCase().includes("заблокирован");

    if (isNotFound) {
      const target = selectedSearchTargetRef.current?.link === link ? selectedSearchTargetRef.current : null;
      const chatType = preferredChatType ?? target?.chatType ?? "direct";
      const isBot = target?.isBot ?? chats.find(chat => chat.link === link)?.isBot ?? false;
      const title = chatType === "channel" ? t("Канал был заблокирован или удален.")
        : chatType === "group" ? t("Группа была заблокирована или удалена.")
          : isBot || chatType === "eclipse" ? t("Бот был заблокирован или удален.")
            : t("Пользователь был заблокирован или удален.");
      // Stop URL synchronization before clearing selection; the old query otherwise reopens it.
      suppressRequestedChatSyncRef.current = true;
      if (selectedSearchTargetRef.current?.link === link) selectedSearchTargetRef.current = null;
      const nextUrl = withoutChatLocation(window.location.pathname, window.location.search);
      window.history.replaceState(null, "", nextUrl);
      showAppToast({ type: "error", title, durationMs: 4000 });
      clearConversationCaches(selfId ?? null, link, chatType);
      setSelectedLink(null);
      selectedLinkRef.current = null;
      setProfileData(null);
      setDesktopDetailsPanelOpen(false);
      setProfileModalOpen(false);
      setChats((prev) => prev.filter((c) => c.link !== link && !c.conversationId?.startsWith(`temp:${link}`)));
      setActiveConversation(null);
      setMessages([]);
      router.replace(nextUrl, { scroll: false });
    } else {
      setErrorText(errorMsg);
      setActiveConversation(null);
      setMessages([]);
    }
    setDecryptingConversation(false);
  } finally {
    if (requestSeq === conversationRequestSeqRef.current) {
      setLoadingConversation(false);
    }
    if (openConversationInFlightRef.current.get(inFlightKey) === requestSeq) openConversationInFlightRef.current.delete(inFlightKey);
  }
  // decryptMessageWithRecovery is declared later in this component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}
