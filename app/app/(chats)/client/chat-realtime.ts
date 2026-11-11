"use client";

import { type ChatSummary, type ConversationResponse, type SelfProfile, type DecryptedMessage, type ConversationChatType, type ProfileBatchItem, type GroupModalData, type ChannelModalData, type MessageReadViewer, type EncryptedMessage, type GroupMessagePayload, type ChannelMessagePayload, type EclipseSystemMessagePayload, type RealtimeMessagePayload, type RealtimeMessageEditedPayload, type RealtimeTypingPayload, type RealtimeRecordingPayload, type RealtimeSendingPayload, type RealtimeMessageDeletedPayload, type RealtimeGroupAddedPayload, type RealtimeChannelAddedPayload, type RealtimeGroupUpdatedPayload, type RealtimeChannelUpdatedPayload, type RealtimeMessageReadPayload, type RealtimeReactionPayload, type RealtimeChatDeletedPayload } from "../types";
import { type CryptoDiagnosticLogger, decryptDirectPayloadDeterministic, decryptSharedPayloadDeterministic, isValidSharedEncryptedPayload } from "@/lib/client/e2e-decrypt-pipeline";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { PINS_UPDATED_EVENT, type PinScope } from "@/lib/message-pins";
import { readCallMessage, callMessageTitle } from "@/lib/call-history";
import { CALLS_CHANGED_EVENT } from "../hooks/useCalls";
import { apiRequest } from "@/lib/client/http";
import { showAppToast, appToast as toast } from "@/lib/client/app-toast";
import { ECLIPSE_DIALOG_LINK, ECLIPSE_DIALOG_TITLE, ECLIPSE_LIST_STATUS } from "@/lib/eclipse-system";
import { shouldAnimateReaction } from "@/lib/client/reaction-animation";
import { broadcastProfileUpdated } from "@/lib/client/local-updates";
import { ensurePusherScript } from "../helpers";
import { decryptWithSharedKey } from "@/lib/client/e2e";
import { ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT } from "../chat-message-transport";
import { appendAndSortMessages, compareMessagesByTime, mergeMessageWindow } from "../chat-message-state";
import { fetchExactDirectMessage, fetchExactSharedMessage } from "../chat-message-hydration";
import { applyRealtimeLinkActivityUpdate } from "../chat-realtime-activity";
import { shouldApplyChatPreviewByTimestamp, upsertRealtimeAddedChat } from "../chat-realtime-chatlist";
import { applyEditedDirectChatPreview, applyEditedSharedChatPreview, applyIncomingDirectChatPreview, applyIncomingSharedChatPreview } from "../chat-realtime-message-updates";
import { applyMessageReactionUpdate, matchesRealtimeConversation, mergeReadMessageIds } from "../chat-realtime-message-state";
import { decryptWithTextCache, buildSharedDecryptCacheKey, canDecryptPayload, buildDirectDecryptCacheKey, appendMessageToConversationCaches, clearConversationCaches, decryptedPayloadFailureCache } from "./chat-cache";
import { retainChatPreviewContent } from "./chat-previews";
import { getRealtimeSendingLabel } from "./message-presentation";

export interface SubscribeChatRealtimeContext {
  selfId: string | null;
  pusherRef: React.RefObject<{ disconnect: () => void; } | null>;
  realtimeSelfIdRef: React.RefObject<string | null>;
  chatsRef: React.RefObject<ChatSummary[]>;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
  loadSharedKeyByVersion: (chatKeyId: string, version: number) => { version: number; keyBase64: string; createdAt: number } | null;
  ensureSharedKeyFromServer: (chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{ version: number; keyBase64: string; createdAt: number; } | null>;
  cryptoDiagnosticRef: React.RefObject<CryptoDiagnosticLogger>;
  inflightHydrationRef: React.RefObject<Set<string>>;
  privateKeyRef: React.RefObject<CryptoKey | null>;
  decryptMessageWithRecoveryRef: React.RefObject<(params: { privateKey: CryptoKey; cipherText: string; iv: string; encryptedKey: string; }) => Promise<string>>;
  ensureOwnE2EReadyRef: React.RefObject<(options?: { allowPrompt?: boolean | undefined; } | undefined) => Promise<{ privateKey: CryptoKey; publicKeyBase64: string; privateKeyBase64: string | null; }>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  handleSecretChatExpiredRef: React.RefObject<(expiredChatId?: string | undefined) => void>;
  ensureProfilesBatchRef: React.RefObject<(userIds: string[]) => Promise<void>>;
  selfProfile: SelfProfile | null;
  currentUserIdRef: React.RefObject<string | null>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  selectedLinkRef: React.RefObject<string | null>;
  setUnreadByLink: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isMessageMarkedDeleted: (messageId: string) => boolean;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  sendReadReceipt: (link: string, chatType: ConversationChatType, messageIds: string[]) => Promise<void>;
  readProfileFromCacheRef: React.RefObject<(userId: string) => ProfileBatchItem | null>;
  loadChatPage: (cursor: string | null, mode: "replace" | "append") => Promise<void>;
  currentSessionIdRef: React.RefObject<string | null>;
  handleSecretChatExpired: (expiredChatId?: string | undefined) => void;
  setReadMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setReadReceiptMarker: (link: string, isoTime: string) => void;
  setTypingByLink: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  typingResetByLinkRef: React.RefObject<Record<string, NodeJS.Timeout>>;
  setRecordingByLink: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  recordingResetByLinkRef: React.RefObject<Record<string, NodeJS.Timeout>>;
  setSendingByLink: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  sendingResetByLinkRef: React.RefObject<Record<string, NodeJS.Timeout>>;
  animateDeleteMessageRef: React.RefObject<(messageId: string, link: string, chatType?: ConversationChatType) => void>;
  setPollResults: React.Dispatch<React.SetStateAction<Record<string, { totalVotes: number; optionCounts: Record<number, number>; userVotedOptionIdx: number | null; }>>>;
  messagesRef: React.RefObject<DecryptedMessage[]>;
  triggerReactionPulse: (messageId: string, emoji: string) => void;
  removeDirectChatLocally: (link: string) => void;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  sharedKeyServerCacheRef: React.RefObject<Map<string, { expiresAt: number; value: { version: number; keyBase64: string; createdAt: number; } | null; }>>;
  conversationDecryptRetryRef: React.RefObject<Record<string, { fingerprint: string; attempts: number; lastAttemptAt: number; }>>;
  decryptedPreviewFingerprintRef: React.RefObject<Record<string, string>>;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
  rotateSharedKeyRef: React.RefObject<(chatType: "group" | "channel", link: string, chatId: string) => Promise<{ version: number; keyBase64: string; createdAt: number; }>>;
  ensureSharedKeyForMembersRef: React.RefObject<(chatType: "group" | "channel", link: string, chatId: string, targetUserIds?: string[] | undefined) => Promise<{ version: number; added: number; failedVersions: number[]; } | null>>;
  setSecretChatExpiresAt: React.Dispatch<React.SetStateAction<string | null>>;
  loadSecretChatsRef: React.RefObject<() => Promise<void>>;
  setErrorText: (message: string | null) => void;
  typingStopTimerRef: React.RefObject<NodeJS.Timeout | null>;
  recordingHeartbeatRef: React.RefObject<NodeJS.Timeout | null>;
  sendingHeartbeatRef: React.RefObject<NodeJS.Timeout | null>;
}

export function subscribeChatRealtime({ selfId, pusherRef, realtimeSelfIdRef, chatsRef, activeConversationRef, buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, cryptoDiagnosticRef, inflightHydrationRef, privateKeyRef, decryptMessageWithRecoveryRef, ensureOwnE2EReadyRef, t, handleSecretChatExpiredRef, ensureProfilesBatchRef, selfProfile, currentUserIdRef, setChats, selectedLinkRef, setUnreadByLink, isMessageMarkedDeleted, setMessages, sanitizeMessages, sendReadReceipt, readProfileFromCacheRef, loadChatPage, currentSessionIdRef, handleSecretChatExpired, setReadMessageIds, setReadReceiptMarker, setTypingByLink, typingResetByLinkRef, setRecordingByLink, recordingResetByLinkRef, setSendingByLink, sendingResetByLinkRef, animateDeleteMessageRef, setPollResults, messagesRef, triggerReactionPulse, removeDirectChatLocally, setActiveConversation, setGroupModalData, groupModalCacheRef, setChannelModalData, channelModalCacheRef, sharedKeyServerCacheRef, conversationDecryptRetryRef, decryptedPreviewFingerprintRef, openConversationRef, rotateSharedKeyRef, ensureSharedKeyForMembersRef, setSecretChatExpiresAt, loadSecretChatsRef, setErrorText, typingStopTimerRef, recordingHeartbeatRef, sendingHeartbeatRef }: SubscribeChatRealtimeContext): (() => void) | undefined {
  if (!selfId) {
    return;
  }
  if (pusherRef.current && realtimeSelfIdRef.current === selfId) {
    return;
  }
  if (pusherRef.current && realtimeSelfIdRef.current !== selfId) {
    try {
      pusherRef.current.disconnect();
    } catch {
      // ignore disconnect errors
    }
    pusherRef.current = null;
  }
  realtimeSelfIdRef.current = selfId;

  let cancelled = false;
  let teardownRealtimeUnload: (() => void) | null = null;

  async function setupRealtime() {
    try {
      const Pusher = await ensurePusherScript();
      if (cancelled) return;

      const pusher = new Pusher("86cd1bbadf1da227f274", {
        cluster: "eu",
        forceTLS: true,
        channelAuthorization: {
          endpoint: "/api/realtime/auth",
          transport: "ajax",
        },
        authEndpoint: "/api/realtime/auth",
        authTransport: "ajax",
        enabledTransports: ["ws", "wss"],
      });
      const disconnectRealtime = () => {
        try {
          if (pusher.connection?.state !== "disconnected") {
            pusher.disconnect();
          }
        } catch {
          // ignore disconnect errors
        }
      };
      window.addEventListener("pagehide", disconnectRealtime);
      window.addEventListener("beforeunload", disconnectRealtime);
      teardownRealtimeUnload = () => {
        window.removeEventListener("pagehide", disconnectRealtime);
        window.removeEventListener("beforeunload", disconnectRealtime);
      };

      const userChannel = pusher.subscribe(`private-user-${selfId}`);
      const refreshCallsRealtime = () => window.dispatchEvent(new Event(CALLS_CHANGED_EVENT));
      userChannel.bind("call:changed", refreshCallsRealtime);
      userChannel.bind("call:signal", (payload: unknown) => {
        if (payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string") {
          window.dispatchEvent(new CustomEvent("eclipse:call-signal", { detail: { id: payload.id } }));
        }
      });
      userChannel.bind("pusher:subscription_succeeded", refreshCallsRealtime);
      pusher.connection?.bind("connected", refreshCallsRealtime);
      const resolveChatIdByLink = (chatType: "group" | "channel", link: string) => {
        const chat = chatsRef.current.find((item) => item.chatType === chatType && item.link === link);
        const prefix = chatType === "group" ? "group:" : "channel:";
        if (chat?.conversationId?.startsWith(prefix)) {
          return chat.conversationId.slice(prefix.length);
        }
        const active = activeConversationRef.current;
        if (chatType === "group" && active?.chatType === "group" && active.group?.link === link) {
          return active.group.id;
        }
        if (chatType === "channel" && active?.chatType === "channel" && active.channel?.link === link) {
          return active.channel.id;
        }
        return null;
      };

      const decryptSharedPayload = async (chatType: "group" | "channel", link: string, payload: GroupMessagePayload | ChannelMessagePayload) => {
        if (!isValidSharedEncryptedPayload(payload)) {
          return payload.text ?? "";
        }
        const chatId = resolveChatIdByLink(chatType, link);
        if (!chatId) return payload.text ?? ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT;
        const chatKeyId = buildSharedChatKeyId(chatType, chatId);
        const encryptedPayload = {
          cipherText: payload.cipherText as string,
          iv: payload.iv as string,
          keyVersion: payload.keyVersion as number,
        };
        return decryptWithTextCache(
          buildSharedDecryptCacheKey({ chatType, chatLink: link, ...encryptedPayload }),
          () =>
            decryptSharedPayloadDeterministic({
              payload: encryptedPayload,
              chatType,
              chatLink: link,
              messageId: payload.id,
              resolveKeyByVersion: (version) => loadSharedKeyByVersion(chatKeyId, version)?.keyBase64 ?? null,
              fetchKeyByVersion: async (version) => {
                const fetched = await ensureSharedKeyFromServer(chatType, link, chatId, version);
                return fetched?.version === version ? fetched.keyBase64 : null;
              },
              decryptWithKey: (keyBase64) =>
                decryptWithSharedKey({
                  cipherText: encryptedPayload.cipherText,
                  iv: encryptedPayload.iv,
                  keyBase64,
                }),
              fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
              logger: cryptoDiagnosticRef.current,
            }),
        );
      };
      const hydrateDirectMessageFromServer = async (payload: RealtimeMessagePayload) => {
        if (!payload.fromLink || !payload.id) return;
        const hydrationKey = `${payload.fromLink}:${payload.id}`;
        if (inflightHydrationRef.current.has(hydrationKey)) return;
        inflightHydrationRef.current.add(hydrationKey);
        try {
          const target = await fetchExactDirectMessage(payload.fromLink, payload.id);
          if (!target) return;

          let resolvedText = ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT;
          if (canDecryptPayload(target)) {
            const encryptedPayload = {
              cipherText: target.cipherText as string,
              iv: target.iv as string,
              encryptedKey: target.encryptedKey as string,
            };
            resolvedText = await decryptWithTextCache(
              buildDirectDecryptCacheKey(encryptedPayload),
              () =>
                decryptDirectPayloadDeterministic({
                  payload: encryptedPayload,
                  tryPrimary: async () => {
                    const sessionPrivateKey = privateKeyRef.current;
                    if (!sessionPrivateKey) {
                      throw new Error("missing_session_private_key");
                    }
                    return decryptMessageWithRecoveryRef.current({
                      privateKey: sessionPrivateKey,
                      cipherText: encryptedPayload.cipherText,
                      iv: encryptedPayload.iv,
                      encryptedKey: encryptedPayload.encryptedKey,
                    });
                  },
                  tryFallback: async () => {
                    const identity = await ensureOwnE2EReadyRef.current();
                    return decryptMessageWithRecoveryRef.current({
                      privateKey: identity.privateKey,
                      cipherText: encryptedPayload.cipherText,
                      iv: encryptedPayload.iv,
                      encryptedKey: encryptedPayload.encryptedKey,
                    });
                  },
                  fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
                  chatLink: payload.fromLink,
                  messageId: target.id,
                  logger: cryptoDiagnosticRef.current,
                }),
            );
          } else if (target.systemPayload) {
            resolvedText = target.systemPayload.title || t("Уведомление");
          }

          // Secret messages arrive as metadata-only events so every device
          // must pass the session check before receiving the ciphertext.
          if (payload.fromLink.startsWith("secret-")) {
            const secretChatId = payload.fromLink.substring("secret-".length);
            const codeword = localStorage.getItem(`secret_codeword_${secretChatId}`);
            if (codeword && resolvedText.trim().toLowerCase() === codeword.trim().toLowerCase()) {
              await apiRequest(`/api/chats/secret-${secretChatId}`, { method: "DELETE" });
              handleSecretChatExpiredRef.current(secretChatId);
              return;
            }
          }
          const safeText = retainChatPreviewContent(resolvedText);
          void ensureProfilesBatchRef.current([target.senderId]);
          const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
          const isOwnMessage = effectiveSelfId ? target.senderId === effectiveSelfId : false;

          setChats((prev) =>
            applyIncomingDirectChatPreview(prev, {
              id: target.id,
              link: payload.fromLink,
              createdAt: target.createdAt,
              previewText: safeText,
              isOwnMessage: isOwnMessage,
              senderId: target.senderId,
              displayName: payload.fromDisplayName || payload.fromLink,
              systemPayload: target.systemPayload || null,
            }),
          );

          if (selectedLinkRef.current === payload.fromLink) {
            setUnreadByLink((prev) => {
              if (!prev[payload.fromLink!]) return prev;
              const next = { ...prev };
              delete next[payload.fromLink!];
              return next;
            });
            if (isMessageMarkedDeleted(target.id)) {
              return;
            }
            setMessages((prev) =>
              appendAndSortMessages(sanitizeMessages(prev), {
                id: target.id,
                senderId: target.senderId,
                text: resolvedText,
                replyToMessageId: target.replyToMessageId ?? null,
                createdAt: target.createdAt,
                systemPayload: target.systemPayload || undefined,
                reactions: target.reactions ?? [],
              }),
            );
            if (target.senderId !== effectiveSelfId) {
              void sendReadReceipt(payload.fromLink, "direct", [target.id]);
            }
          } else if (target.senderId !== effectiveSelfId) {
            setUnreadByLink((prev) => ({
              ...prev,
              [payload.fromLink!]: Math.min(99, (prev[payload.fromLink!] ?? 0) + 1),
            }));
          }
        } catch {
          // hydration is best-effort
        } finally {
          inflightHydrationRef.current.delete(hydrationKey);
        }
      };
      const hydrateGroupMessageFromServer = async (payload: RealtimeMessagePayload) => {
        const chatType = payload.chatType === "channel" ? "channel" : "group";
        const groupLink = payload.groupLink?.trim().toLowerCase();
        if (!groupLink || !payload.id) return;
        const hydrationKey = `${chatType}:${groupLink}:${payload.id}`;
        if (inflightHydrationRef.current.has(hydrationKey)) return;
        inflightHydrationRef.current.add(hydrationKey);
        try {
          if (chatType === "group") {
            const target = (await fetchExactSharedMessage("group", groupLink, payload.id)) as GroupMessagePayload | null;
            if (!target) return;

            const resolvedText = await decryptSharedPayload("group", groupLink, target);
            const previewBase = retainChatPreviewContent(resolvedText ?? "");
            const senderProfile = readProfileFromCacheRef.current(target.senderId);
            const senderName = target.senderDisplayName || senderProfile?.displayName || "";
            const preview = senderName ? `${senderName}: ${previewBase}` : previewBase;

            const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
            const isOwnMessage = effectiveSelfId ? target.senderId === effectiveSelfId : false;

            setChats((prev) =>
              prev.map((chat) =>
                chat.link === groupLink
                  ? shouldApplyChatPreviewByTimestamp(chat.lastMessageAt, target.createdAt)
                    ? {
                      ...chat,
                      lastMessage: preview,
                      lastMessageAt: target.createdAt,
                      lastMessageMine: isOwnMessage,
                    }
                    : chat
                  : chat,
              ),
            );

            if (selectedLinkRef.current === groupLink) {
              setUnreadByLink((prev) => {
                if (!prev[groupLink]) return prev;
                const next = { ...prev };
                delete next[groupLink];
                return next;
              });
              if (isMessageMarkedDeleted(target.id)) {
                return;
              }
              setMessages((prev) =>
                appendAndSortMessages(sanitizeMessages(prev), {
                  id: target.id,
                  senderId: target.senderId,
                  text: resolvedText ?? "",
                  replyToMessageId: target.replyToMessageId ?? null,
                  senderDisplayName: target.senderDisplayName,
                  createdAt: target.createdAt,
                  systemPayload: (target as any).systemPayload || undefined,
                  reactions: target.reactions ?? [],
                  readBy: target.readBy ?? [],
                }),
              );
              void ensureProfilesBatchRef.current([target.senderId]);
              if (target.senderId !== effectiveSelfId) {
                void sendReadReceipt(groupLink, "group", [target.id]);
              }
            } else if (target.senderId !== effectiveSelfId) {
              setUnreadByLink((prev) => ({
                ...prev,
                [groupLink]: Math.min(99, (prev[groupLink] ?? 0) + 1),
              }));
            }
            return;
          }

          const target = (await fetchExactSharedMessage("channel", groupLink, payload.id)) as ChannelMessagePayload | null;
          if (!target) return;

          const resolvedText = await decryptSharedPayload("channel", groupLink, target);
          const previewBase = retainChatPreviewContent(resolvedText ?? "");
          const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
          const isOwnMessage = effectiveSelfId ? target.senderId === effectiveSelfId : false;

          setChats((prev) =>
            prev.map((chat) =>
              chat.link === groupLink
                ? shouldApplyChatPreviewByTimestamp(chat.lastMessageAt, target.createdAt)
                  ? {
                    ...chat,
                    lastMessage: previewBase,
                    lastMessageAt: target.createdAt,
                    lastMessageMine: isOwnMessage,
                  }
                  : chat
                : chat,
            ),
          );

          if (selectedLinkRef.current === groupLink) {
            if (isMessageMarkedDeleted(target.id)) {
              return;
            }
            setMessages((prev) =>
              appendAndSortMessages(sanitizeMessages(prev), {
                id: target.id,
                senderId: target.senderId,
                text: resolvedText ?? "",
                replyToMessageId: target.replyToMessageId ?? null,
                createdAt: target.createdAt,
                viewsCount: target.viewsCount ?? "0",
                systemPayload: (target as any).systemPayload || undefined,
                reactions: target.reactions ?? [],
              }),
            );
            void ensureProfilesBatchRef.current([target.senderId]);
            if (target.senderId !== effectiveSelfId) {
              void sendReadReceipt(groupLink, "channel", [target.id]);
            }
          } else if (target.senderId !== effectiveSelfId) {
            setUnreadByLink((prev) => ({
              ...prev,
              [groupLink]: Math.min(99, (prev[groupLink] ?? 0) + 1),
            }));
          }
        } catch {
          // hydration is best-effort
        } finally {
          inflightHydrationRef.current.delete(hydrationKey);
        }
      };

      const botRefreshVersions = new Map<string, number>();
      userChannel.bind("bot:changed", (payload: unknown) => {
        const raw = payload as { conversationId?: string; messageId?: string };
        const active = activeConversationRef.current;
        const link = selectedLinkRef.current;
        if (active?.chatType === "direct" && active.peer?.isBot && active.conversationId === raw.conversationId && link && raw.messageId) {
          const messageId = raw.messageId;
          const version = (botRefreshVersions.get(messageId) ?? 0) + 1;
          botRefreshVersions.set(messageId, version);
          // Refresh one changed row without interrupting drafts, recordings or older pages.
          void apiRequest<ConversationResponse>(`/api/chats/${encodeURIComponent(link)}?chatType=direct&messageId=${encodeURIComponent(messageId)}`, { cache: "no-store" }).then(data => {
            if (selectedLinkRef.current !== link || activeConversationRef.current?.conversationId !== raw.conversationId || botRefreshVersions.get(messageId) !== version) return;
            const incoming = (data.messages as EncryptedMessage[]).map(message => ({
              id: message.id, senderId: message.senderId, text: message.text ?? (message as EncryptedMessage & { systemPayload?: { title?: string } }).systemPayload?.title ?? "",
              createdAt: message.createdAt, replyToMessageId: message.replyToMessageId, reactions: message.reactions ?? [], botReplyMarkup: message.botReplyMarkup, systemPayload: (message as any).systemPayload,
            }));
            setMessages(previous => sanitizeMessages(mergeMessageWindow(previous, incoming)));
          }).catch(() => { });
        }
        void loadChatPage(null, "replace");
      });

      userChannel.bind("bot:ui-changed", () => {
        window.dispatchEvent(new Event("eclipse:bot-ui-updated"));
      });
      userChannel.bind("message:new", async (rawPayload: unknown) => {
        window.dispatchEvent(new Event("eclipse:presence-refresh"));
        const payload = rawPayload as RealtimeMessagePayload;
        if (payload?.chatType === "eclipse" && (rawPayload as { refresh?: boolean }).refresh) {
          window.dispatchEvent(new Event("eclipse:bot-management-updated"));
          setChats(previous => previous.map(chat => chat.link === ECLIPSE_DIALOG_LINK ? { ...chat, lastMessageAt: payload.createdAt } : chat));
          if (selectedLinkRef.current === ECLIPSE_DIALOG_LINK) {
            try {
              const refreshed = await apiRequest<ConversationResponse>("/api/chats/eclipse?chatType=eclipse", { cache: "no-store" });
              if (selectedLinkRef.current !== ECLIPSE_DIALOG_LINK || currentUserIdRef.current !== selfId) return;
              const incoming = (refreshed.messages as EclipseSystemMessagePayload[]).map(message => ({ id: message.id, senderId: message.senderId, text: message.systemPayload?.botRole === "user" ? message.systemPayload.body : message.systemPayload?.title ?? "", systemPayload: message.systemPayload, createdAt: message.createdAt, reactions: [] }));
              setMessages(previous => mergeMessageWindow(previous, incoming).sort(compareMessagesByTime));
              const latest = incoming.at(-1);
              if (latest) setChats(previous => previous.map(chat => chat.link === ECLIPSE_DIALOG_LINK ? { ...chat, lastMessage: latest.text, lastMessageAt: latest.createdAt } : chat));
            } catch { /* Reopening the dialog also retrieves protected management messages. */ }
          }
          return;
        }
        if (!payload?.id) {
          return;
        }

        if (payload.chatType === "eclipse" && payload.systemPayload) {
          if (payload.systemPayload.eventType === "new_login" && payload.systemPayload.metadata?.sessionId === currentSessionIdRef.current) {
            return;
          }
          const eclipseLink = payload.fromLink?.trim().toLowerCase() || ECLIPSE_DIALOG_LINK;
          const previewText = payload.systemPayload.title || t("Уведомление");
          const eclipseSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? "self";

          setChats((prev) => {
            const existing = prev.find((chat) => chat.link === eclipseLink);
            const nextEntry: ChatSummary = existing
              ? {
                ...existing,
                lastMessage: previewText,
                lastMessageAt: payload.createdAt,
                lastMessageMine: false,
                isSystem: true,
                isVerified: true,
                statusText: ECLIPSE_LIST_STATUS,
              }
              : {
                chatType: "eclipse",
                conversationId: `eclipse:${eclipseSelfId}`,
                peerId: payload.senderId,
                link: eclipseLink,
                displayName: payload.fromDisplayName || ECLIPSE_DIALOG_TITLE,
                avatarUrl: null,
                lastMessage: previewText,
                lastMessageAt: payload.createdAt,
                lastMessageMine: false,
                isSystem: true,
                isVerified: true,
                statusText: ECLIPSE_LIST_STATUS,
              };
            const without = prev.filter((chat) => chat.link !== eclipseLink);
            return [nextEntry, ...without];
          });

          if (selectedLinkRef.current === eclipseLink) {
            setUnreadByLink((prev) => {
              if (!prev[eclipseLink]) return prev;
              const next = { ...prev };
              delete next[eclipseLink];
              return next;
            });
            setMessages((prev) =>
              appendAndSortMessages(sanitizeMessages(prev), {
                id: payload.id,
                senderId: payload.senderId,
                text: previewText,
                systemPayload: payload.systemPayload,
                createdAt: payload.createdAt,
                reactions: payload.reactions ?? [],
              }),
            );
            void sendReadReceipt(eclipseLink, "eclipse", [payload.id]);
          } else {
            setUnreadByLink((prev) => ({
              ...prev,
              [eclipseLink]: Math.min(99, (prev[eclipseLink] ?? 0) + 1),
            }));
          }
          if (selectedLinkRef.current !== eclipseLink) {
            appendMessageToConversationCaches(eclipseSelfId, eclipseLink, "eclipse", {
              id: payload.id,
              senderId: payload.senderId,
              text: previewText,
              systemPayload: payload.systemPayload,
              createdAt: payload.createdAt,
              reactions: payload.reactions ?? [],
            });
          }
          return;
        }

        if (payload.chatType === "group" || payload.chatType === "channel") {
          const groupLink = payload.groupLink?.trim().toLowerCase();
          if (!groupLink) return;
          if (!payload.text && (!payload.cipherText || !payload.iv || !payload.keyVersion)) {
            await hydrateGroupMessageFromServer(payload);
            return;
          }

          let resolvedText = payload.systemPayload?.title ?? payload.text ?? "";
          if (payload.cipherText && payload.iv && payload.keyVersion) {
            const tempPayload: GroupMessagePayload | ChannelMessagePayload = {
              id: payload.id,
              senderId: payload.senderId,
              text: payload.text ?? null,
              cipherText: payload.cipherText,
              iv: payload.iv,
              keyVersion: payload.keyVersion,
              replyToMessageId: payload.replyToMessageId ?? null,
              createdAt: payload.createdAt,
              viewsCount: payload.chatType === "channel" ? payload.viewsCount ?? "1" : undefined,
            } as GroupMessagePayload & ChannelMessagePayload;
            resolvedText = await decryptSharedPayload(payload.chatType, groupLink, tempPayload);
          }

          void ensureProfilesBatchRef.current([payload.senderId]);
          const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
          const isOwnMessage = effectiveSelfId ? payload.senderId === effectiveSelfId : false;
          const incomingSharedMessage: DecryptedMessage = {
            id: payload.id,
            senderId: payload.senderId,
            text: resolvedText ?? "",
            systemPayload: payload.systemPayload,
            replyToMessageId: payload.replyToMessageId ?? null,
            senderDisplayName: payload.chatType === "group" ? payload.fromDisplayName : undefined,
            createdAt: payload.createdAt,
            viewsCount: payload.chatType === "channel" ? payload.viewsCount ?? "1" : undefined,
            reactions: payload.reactions ?? [],
            readBy: [],
          };

          setChats((prev) => {
            const previewBase = retainChatPreviewContent(resolvedText ?? "");
            const senderProfile = payload.chatType === "group" ? readProfileFromCacheRef.current(payload.senderId) : null;
            const senderName = payload.fromDisplayName || senderProfile?.displayName || "";
            return applyIncomingSharedChatPreview(prev, {
              link: groupLink,
              createdAt: payload.createdAt,
              previewText: payload.chatType === "group" && senderName ? `${senderName}: ${previewBase}` : previewBase,
              isOwnMessage: isOwnMessage,
              chatType: payload.chatType as "group" | "channel",
              senderId: payload.senderId,
              senderAlias: senderName,
              cipherText: payload.cipherText ?? null,
              iv: payload.iv ?? null,
              keyVersion: payload.keyVersion ?? null,
            });
          });

          if (selectedLinkRef.current === groupLink) {
            setUnreadByLink((prev) => {
              if (!prev[groupLink]) return prev;
              const next = { ...prev };
              delete next[groupLink];
              return next;
            });
            if (isMessageMarkedDeleted(payload.id)) {
              return;
            }
            setMessages((prev) =>
              appendAndSortMessages(sanitizeMessages(prev), incomingSharedMessage),
            );
            if (payload.senderId !== effectiveSelfId) {
              void sendReadReceipt(groupLink, payload.chatType, [payload.id]);
            }
          } else {
            if (payload.senderId !== effectiveSelfId) {
              setUnreadByLink((prev) => ({
                ...prev,
                [groupLink]: Math.min(99, (prev[groupLink] ?? 0) + 1),
              }));
            }
            appendMessageToConversationCaches(
              effectiveSelfId,
              groupLink,
              payload.chatType as "group" | "channel",
              incomingSharedMessage,
            );
          }
          return;
        }

        if (!payload?.fromLink) {
          return;
        }
        if (payload.systemPayload) {
          const callMessage = readCallMessage(payload.systemPayload);
          const previewText = callMessage ? t(callMessageTitle(callMessage, selfId ?? "")) : payload.systemPayload.title || t("Уведомление");
          const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
          const isOwnMessage = effectiveSelfId ? payload.senderId === effectiveSelfId : false;
          const incomingDirectMessage: DecryptedMessage = {
            id: payload.id,
            senderId: payload.senderId,
            text: previewText,
            systemPayload: payload.systemPayload,
            replyToMessageId: payload.replyToMessageId ?? null,
            createdAt: payload.createdAt,
            reactions: payload.reactions ?? [],
          };

          setChats((prev) =>
            applyIncomingDirectChatPreview(prev, {
              id: payload.id,
              link: payload.fromLink,
              createdAt: payload.createdAt,
              previewText: previewText,
              isOwnMessage: isOwnMessage,
              senderId: payload.senderId,
              displayName: payload.fromDisplayName || payload.fromLink,
              systemPayload: payload.systemPayload,
            }),
          );

          if (selectedLinkRef.current === payload.fromLink) {
            setUnreadByLink((prev) => {
              if (!prev[payload.fromLink]) return prev;
              const next = { ...prev };
              delete next[payload.fromLink];
              return next;
            });
            setMessages((prev) => appendAndSortMessages(sanitizeMessages(prev), incomingDirectMessage));
          } else if (!isOwnMessage) {
            setUnreadByLink((prev) => ({
              ...prev,
              [payload.fromLink]: Math.min(99, (prev[payload.fromLink] ?? 0) + 1),
            }));
          }
          appendMessageToConversationCaches(
            effectiveSelfId,
            payload.fromLink,
            "direct",
            incomingDirectMessage,
          );
          return;
        }
        if (!payload.cipherText || !payload.iv || !payload.encryptedKey) {
          await hydrateDirectMessageFromServer(payload);
          return;
        }

        const text = canDecryptPayload(payload)
          ? await (() => {
            const encryptedPayload = {
              cipherText: payload.cipherText as string,
              iv: payload.iv as string,
              encryptedKey: payload.encryptedKey as string,
            };
            return decryptWithTextCache(
              buildDirectDecryptCacheKey(encryptedPayload),
              () =>
                decryptDirectPayloadDeterministic({
                  payload: encryptedPayload,
                  tryPrimary: async () => {
                    const sessionPrivateKey = privateKeyRef.current;
                    if (!sessionPrivateKey) {
                      throw new Error("missing_session_private_key");
                    }
                    return decryptMessageWithRecoveryRef.current({
                      privateKey: sessionPrivateKey,
                      cipherText: encryptedPayload.cipherText,
                      iv: encryptedPayload.iv,
                      encryptedKey: encryptedPayload.encryptedKey,
                    });
                  },
                  tryFallback: async () => {
                    const identity = await ensureOwnE2EReadyRef.current();
                    return decryptMessageWithRecoveryRef.current({
                      privateKey: identity.privateKey,
                      cipherText: encryptedPayload.cipherText,
                      iv: encryptedPayload.iv,
                      encryptedKey: encryptedPayload.encryptedKey,
                    });
                  },
                  fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
                  chatLink: payload.fromLink,
                  messageId: payload.id,
                  logger: cryptoDiagnosticRef.current,
                }),
            );
          })()
          : ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT;

        const rawText = text;

        if (payload.fromLink?.startsWith("secret-")) {
          const secretChatId = payload.fromLink.substring("secret-".length);
          const storedCodeword = typeof window !== "undefined" ? localStorage.getItem(`secret_codeword_${secretChatId}`) : null;
          if (storedCodeword && rawText.trim().toLowerCase() === storedCodeword.trim().toLowerCase()) {
            void (async () => {
              try {
                await apiRequest(`/api/chats/secret-${secretChatId}`, { method: "DELETE" });
                handleSecretChatExpired(secretChatId);
                toast.info(t("Кодовое слово активировано. Секретный чат удален."));
              } catch (err) {
                console.error("Failed to delete secret chat via codeword on incoming:", err);
              }
            })();
          }
        }

        const safeText = retainChatPreviewContent(rawText);
        void ensureProfilesBatchRef.current([payload.senderId]);
        const effectiveSelfId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? null;
        const isOwnMessage = effectiveSelfId ? payload.senderId === effectiveSelfId : false;
        const incomingDirectMessage: DecryptedMessage = {
          id: payload.id,
          senderId: payload.senderId,
          text: rawText,
          replyToMessageId: payload.replyToMessageId ?? null,
          createdAt: payload.createdAt,
          reactions: payload.reactions ?? [],
        };

        setChats((prev) =>
          applyIncomingDirectChatPreview(prev, {
            id: payload.id,
            link: payload.fromLink,
            createdAt: payload.createdAt,
            previewText: safeText,
            isOwnMessage: isOwnMessage,
            senderId: payload.senderId,
            displayName: payload.fromDisplayName || payload.fromLink,
          }),
        );

        if (selectedLinkRef.current === payload.fromLink) {
          setUnreadByLink((prev) => {
            if (!prev[payload.fromLink]) return prev;
            const next = { ...prev };
            delete next[payload.fromLink];
            return next;
          });
          if (isMessageMarkedDeleted(payload.id)) {
            return;
          }
          setMessages((prev) => appendAndSortMessages(sanitizeMessages(prev), incomingDirectMessage));
          if (payload.senderId !== effectiveSelfId) {
            void sendReadReceipt(payload.fromLink, "direct", [payload.id]);
          }
        } else {
          if (payload.senderId !== effectiveSelfId) {
            setUnreadByLink((prev) => ({
              ...prev,
              [payload.fromLink]: Math.min(99, (prev[payload.fromLink] ?? 0) + 1),
            }));
          }
          appendMessageToConversationCaches(
            effectiveSelfId,
            payload.fromLink,
            "direct",
            incomingDirectMessage,
          );
        }
      });

      userChannel.bind("message:edited", async (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeMessageEditedPayload;
        if (!payload?.id) return;

        if (payload.chatType === "eclipse") {
          const eclipseLink = payload.fromLink?.trim().toLowerCase() || ECLIPSE_DIALOG_LINK;
          if (selectedLinkRef.current === eclipseLink) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === payload.id
                  ? { ...message, systemPayload: payload.systemPayload }
                  : message
              )
            );
          }
          return;
        }

        if (payload.chatType === "group" || payload.chatType === "channel") {
          const groupLink = payload.groupLink?.trim().toLowerCase();
          if (!groupLink) return;
          let resolvedText = payload.text ?? "";
          if (payload.cipherText && payload.iv && payload.keyVersion) {
            const tempPayload: GroupMessagePayload | ChannelMessagePayload = {
              id: payload.id,
              senderId: payload.senderId,
              text: payload.text ?? null,
              cipherText: payload.cipherText,
              iv: payload.iv,
              keyVersion: payload.keyVersion,
              replyToMessageId: payload.replyToMessageId ?? null,
              createdAt: payload.createdAt,
              viewsCount: payload.chatType === "channel" ? payload.viewsCount ?? "1" : undefined,
            } as GroupMessagePayload & ChannelMessagePayload;
            resolvedText = await decryptSharedPayload(payload.chatType, groupLink, tempPayload);
          }

          setChats((prev) => {
            const previewBase = retainChatPreviewContent(resolvedText ?? "");
            const senderProfile = payload.chatType === "group" ? readProfileFromCacheRef.current(payload.senderId) : null;
            const senderName = payload.fromDisplayName || senderProfile?.displayName || "";
            return applyEditedSharedChatPreview(prev, {
              link: groupLink,
              createdAt: payload.createdAt,
              previewText: previewBase,
              includeSenderPrefix: payload.chatType === "group" && payload.senderId !== selfId,
              senderId: payload.senderId,
              senderAlias: senderName,
              cipherText: payload.cipherText ?? null,
              iv: payload.iv ?? null,
              keyVersion: payload.keyVersion ?? null,
            });
          });

          if (selectedLinkRef.current === groupLink) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === payload.id
                  ? { ...message, text: resolvedText ?? "", senderDisplayName: payload.fromDisplayName ?? message.senderDisplayName }
                  : message,
              ),
            );
          }
          return;
        }

        if (!payload?.fromLink) return;
        if (payload.isSystemMessage || payload.systemPayload) {
          if (readCallMessage(payload.systemPayload)) {
            if (isMessageMarkedDeleted(payload.id)) return;
            clearConversationCaches(selfId, payload.fromLink, "direct");
          }
          // Update the message in state if the chat is open
          if (selectedLinkRef.current === payload.fromLink) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === payload.id);
              if (exists) {
                return prev.map((message) =>
                  message.id === payload.id
                    ? { ...message, systemPayload: payload.systemPayload }
                    : message,
                );
              }
              const newMsg: DecryptedMessage = {
                id: payload.id,
                senderId: payload.senderId,
                text: payload.systemPayload?.title ?? "",
                createdAt: payload.createdAt,
                reactions: [],
                systemPayload: payload.systemPayload,
              };
              return appendAndSortMessages(sanitizeMessages(prev), newMsg);
            });
          }
          // Update the chat summary in the sidebar
          setChats((prev) => {
            const callMessage = readCallMessage(payload.systemPayload);
            const previewText = callMessage ? t(callMessageTitle(callMessage, selfId ?? "")) : payload.systemPayload?.title || t("Уведомление");
            return prev.map((chat) =>
              chat.link === payload.fromLink && (!callMessage || !chat.lastMessageAt || new Date(chat.lastMessageAt).getTime() <= new Date(payload.createdAt).getTime())
                ? {
                  ...chat,
                  lastMessage: previewText,
                  lastMessageAt: payload.createdAt,
                  systemPayload: payload.systemPayload,
                }
                : chat
            );
          });
          return;
        }
        if (!payload.cipherText || !payload.iv || !payload.encryptedKey) {
          return;
        }

        const text = canDecryptPayload(payload)
          ? await (() => {
            const encryptedPayload = {
              cipherText: payload.cipherText as string,
              iv: payload.iv as string,
              encryptedKey: payload.encryptedKey as string,
            };
            return decryptWithTextCache(
              buildDirectDecryptCacheKey(encryptedPayload),
              () =>
                decryptDirectPayloadDeterministic({
                  payload: encryptedPayload,
                  tryPrimary: async () => {
                    const sessionPrivateKey = privateKeyRef.current;
                    if (!sessionPrivateKey) {
                      throw new Error("missing_session_private_key");
                    }
                    return decryptMessageWithRecoveryRef.current({
                      privateKey: sessionPrivateKey,
                      cipherText: encryptedPayload.cipherText,
                      iv: encryptedPayload.iv,
                      encryptedKey: encryptedPayload.encryptedKey,
                    });
                  },
                  tryFallback: async () => {
                    const identity = await ensureOwnE2EReadyRef.current();
                    return decryptMessageWithRecoveryRef.current({
                      privateKey: identity.privateKey,
                      cipherText: encryptedPayload.cipherText,
                      iv: encryptedPayload.iv,
                      encryptedKey: encryptedPayload.encryptedKey,
                    });
                  },
                  fallbackText: ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT,
                  chatLink: payload.fromLink,
                  messageId: payload.id,
                  logger: cryptoDiagnosticRef.current,
                }),
            );
          })()
          : ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT;

        setChats((prev) =>
          applyEditedDirectChatPreview(prev, {
            link: payload.fromLink,
            createdAt: payload.createdAt,
            previewText: retainChatPreviewContent(text),
          }),
        );

        if (selectedLinkRef.current === payload.fromLink) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === payload.id ? { ...message, text } : message,
            ),
          );
        }
      });

      userChannel.bind("message:read", (rawPayload: unknown) => {
        window.dispatchEvent(new Event("eclipse:presence-refresh"));
        const payload = rawPayload as RealtimeMessageReadPayload;
        if (!Array.isArray(payload?.messageIds) || payload.messageIds.length === 0) return;
        setReadMessageIds((prev) => mergeReadMessageIds(prev, payload.messageIds));
        if (payload.chatType === "group") {
          const groupLink = payload.groupLink?.trim().toLowerCase();
          if (!groupLink) return;
          const viewer: MessageReadViewer = {
            id: payload.fromUserId,
            link: payload.fromLink,
            displayName: payload.fromDisplayName || payload.fromLink,
            avatarUrl: payload.fromAvatarUrl ?? null,
            readAt: payload.at,
          };
          if (selectedLinkRef.current === groupLink) {
            const messageIdSet = new Set(payload.messageIds);
            setMessages((prev) =>
              prev.map((message) => {
                if (!messageIdSet.has(message.id)) return message;
                const existing = message.readBy ?? [];
                const nextReadBy = [
                  viewer,
                  ...existing.filter((item) => item.id !== viewer.id),
                ].sort((a, b) => Date.parse(b.readAt) - Date.parse(a.readAt));
                return { ...message, readBy: nextReadBy };
              }),
            );
          }
          return;
        }
        if (payload?.chatType && payload.chatType !== "direct") return;
        if (payload.fromLink && payload.at) {
          setReadReceiptMarker(payload.fromLink, payload.at);
        }
      });

      userChannel.bind("typing:update", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeTypingPayload;
        if (payload?.isTyping) window.dispatchEvent(new Event("eclipse:presence-refresh"));
        const typingLink = payload?.chatType === "group" ? payload.groupLink : payload?.fromLink;
        if (!typingLink || !payload?.fromUserId) {
          return;
        }
        const typingKey = `${typingLink}:${payload.fromUserId}`;
        const typingLabel = payload.fromDisplayName || payload.fromLink;

        setTypingByLink((prev) =>
          applyRealtimeLinkActivityUpdate(prev, typingLink, payload.fromUserId, typingLabel, payload.isTyping),
        );

        const currentTimer = typingResetByLinkRef.current[typingKey];
        if (currentTimer) {
          clearTimeout(currentTimer);
        }

        if (payload.isTyping) {
          typingResetByLinkRef.current[typingKey] = setTimeout(() => {
            setTypingByLink((prev) =>
              applyRealtimeLinkActivityUpdate(prev, typingLink, payload.fromUserId, typingLabel, false),
            );
            delete typingResetByLinkRef.current[typingKey];
          }, 5000);
        }
      });

      userChannel.bind("recording:update", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeRecordingPayload;
        const recordingLink = payload?.chatType === "group" || payload?.chatType === "channel"
          ? payload.groupLink
          : payload?.fromLink;
        if (!recordingLink || !payload?.fromUserId || !payload?.mode) {
          return;
        }
        const recordingKey = `${recordingLink}:${payload.fromUserId}`;
        const recordingLabel = payload.mode === "video" ? t("записывает видео") : t("записывает голос");

        setRecordingByLink((prev) =>
          applyRealtimeLinkActivityUpdate(prev, recordingLink, payload.fromUserId, recordingLabel, payload.isRecording),
        );

        const currentTimer = recordingResetByLinkRef.current[recordingKey];
        if (currentTimer) {
          clearTimeout(currentTimer);
        }

        if (payload.isRecording) {
          recordingResetByLinkRef.current[recordingKey] = setTimeout(() => {
            setRecordingByLink((prev) =>
              applyRealtimeLinkActivityUpdate(prev, recordingLink, payload.fromUserId, recordingLabel, false),
            );
            delete recordingResetByLinkRef.current[recordingKey];
          }, 5000);
        }
      });

      userChannel.bind("sending:update", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeSendingPayload;
        const sendingLink =
          payload?.chatType === "group" || payload?.chatType === "channel" ? payload.groupLink : payload?.fromLink;
        if (!sendingLink || !payload?.fromUserId || !payload?.kind) {
          return;
        }
        const sendingKey = `${sendingLink}:${payload.fromUserId}`;
        const sendingLabel = getRealtimeSendingLabel(payload.kind);

        setSendingByLink((prev) =>
          applyRealtimeLinkActivityUpdate(prev, sendingLink, payload.fromUserId, sendingLabel, payload.isSending),
        );

        const currentTimer = sendingResetByLinkRef.current[sendingKey];
        if (currentTimer) {
          clearTimeout(currentTimer);
        }

        if (payload.isSending) {
          sendingResetByLinkRef.current[sendingKey] = setTimeout(() => {
            setSendingByLink((prev) =>
              applyRealtimeLinkActivityUpdate(prev, sendingLink, payload.fromUserId, sendingLabel, false),
            );
            delete sendingResetByLinkRef.current[sendingKey];
          }, 12000);
        }
      });

      userChannel.bind("message:deleted", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeMessageDeletedPayload;
        const deleteLink =
          payload?.chatType === "group" || payload?.chatType === "channel"
            ? payload.groupLink
            : payload?.fromLink;
        if (!payload?.id || !deleteLink) return;
        animateDeleteMessageRef.current(payload.id, deleteLink, payload.chatType ?? "direct");
      });

      userChannel.bind("poll:update", (rawPayload: unknown) => {
        const payload = rawPayload as {
          messageId: string;
          totalVotes: number;
          optionCounts: Record<number, number>;
          userVotedOptionIdx: number | null;
        };
        if (!payload?.messageId) return;
        setPollResults((prev) => ({
          ...prev,
          [payload.messageId]: {
            totalVotes: payload.totalVotes,
            optionCounts: payload.optionCounts,
            userVotedOptionIdx: payload.userVotedOptionIdx,
          },
        }));
      });

      userChannel.bind("reaction:update", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeReactionPayload;
        if (!payload?.messageId || !payload.reactions) return;
        const active = activeConversationRef.current;
        if (!matchesRealtimeConversation(active, payload.chatType, payload.groupLink)) return;

        const current = messagesRef.current.find((message) => message.id === payload.messageId);
        const previousByEmoji = new Map((current?.reactions ?? []).map((reaction) => [reaction.emoji, reaction]));
        payload.reactions.forEach((reaction) => {
          const previous = previousByEmoji.get(reaction.emoji);
          if (shouldAnimateReaction(previous?.count ?? 0, reaction.count)) {
            triggerReactionPulse(payload.messageId, reaction.emoji);
          }
        });

        setMessages((prev) => applyMessageReactionUpdate(prev, payload.messageId, payload.reactions));
      });

      userChannel.bind("chat:deleted", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeChatDeletedPayload;
        if (payload?.chatType !== "direct" || !payload?.fromLink) return;
        removeDirectChatLocally(payload.fromLink);
      });

      userChannel.bind("profile:updated", (rawPayload: unknown) => {
        const payload = rawPayload as {
          id?: string;
          link?: string;
          previousLink?: string | null;
          displayName?: string;
          emojiStatusId?: string | null;
          avatarUrl?: string | null;
          backgroundUrl?: string | null;
        };
        if (!payload?.link || !payload?.displayName) return;
        broadcastProfileUpdated({
          id: payload.id ?? null,
          link: payload.link,
          previousLink: payload.previousLink ?? null,
          displayName: payload.displayName,
          emojiStatusId: payload.emojiStatusId,
          avatarUrl: payload.avatarUrl ?? null,
          backgroundUrl: payload.backgroundUrl ?? null,
        });
      });

      userChannel.bind("group:added", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeGroupAddedPayload;
        if (!payload?.id || !payload?.link || !payload?.name || !payload?.createdAt) return;
        setChats((prev) =>
          upsertRealtimeAddedChat(prev, {
            type: "group",
            id: payload.id,
            link: payload.link,
            name: payload.name,
            avatarUrl: payload.avatarUrl ?? null,
            createdAt: payload.createdAt,
            previewText: payload.previewText,
          }),
        );
      });

      userChannel.bind("channel:added", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeChannelAddedPayload;
        if (!payload?.id || !payload?.link || !payload?.name || !payload?.createdAt) return;
        setChats((prev) =>
          upsertRealtimeAddedChat(prev, {
            type: "channel",
            id: payload.id,
            link: payload.link,
            name: payload.name,
            avatarUrl: payload.avatarUrl ?? null,
            createdAt: payload.createdAt,
            previewText: payload.previewText,
          }),
        );
      });

      userChannel.bind("group:updated", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeGroupUpdatedPayload;
        if (!payload?.id || !payload?.link || !payload?.name) return;
        const avatarUrl = payload.avatarUrl ?? null;
        const policy = payload.reactionMode ? { reactionMode: payload.reactionMode, allowedReactions: payload.allowedReactions ?? [] } : {};
        clearConversationCaches(selfId, payload.link, "group");
        setChats((prev) =>
          prev.map((chat) =>
            chat.chatType === "group" && chat.link === payload.link
              ? { ...chat, displayName: payload.name, avatarUrl }
              : chat,
          ),
        );
        setActiveConversation((prev) =>
          prev?.chatType === "group" && prev.group?.link === payload.link
            ? {
              ...prev,
              group: {
                ...prev.group,
                ...policy,
                name: payload.name,
                avatarUrl,
                ownerId: payload.ownerId ?? prev.group.ownerId,
              },
            }
            : prev,
        );
        setGroupModalData((prev) => {
          if (!prev || prev.group.link !== payload.link) return prev;
          const next = {
            ...prev,
            group: {
              ...prev.group,
              ...policy,
              name: payload.name,
              avatarUrl,
              ownerId: payload.ownerId ?? prev.group.ownerId,
            },
          };
          groupModalCacheRef.current.set(payload.link, { savedAt: Date.now(), data: next });
          return next;
        });
      });

      userChannel.bind("channel:updated", (rawPayload: unknown) => {
        const payload = rawPayload as RealtimeChannelUpdatedPayload;
        if (!payload?.id || !payload?.link || !payload?.name) return;
        const avatarUrl = payload.avatarUrl ?? null;
        const policy = payload.reactionMode ? { reactionMode: payload.reactionMode, allowedReactions: payload.allowedReactions ?? [] } : {};
        clearConversationCaches(selfId, payload.link, "channel");
        setChats((prev) =>
          prev.map((chat) =>
            chat.chatType === "channel" && chat.link === payload.link
              ? { ...chat, displayName: payload.name, avatarUrl }
              : chat,
          ),
        );
        setActiveConversation((prev) =>
          prev?.chatType === "channel" && prev.channel?.link === payload.link
            ? { ...prev, channel: { ...prev.channel, ...policy, name: payload.name, avatarUrl } }
            : prev,
        );
        setChannelModalData((prev) => {
          if (!prev || prev.channel.link !== payload.link) return prev;
          const next = { ...prev, channel: { ...prev.channel, ...policy, name: payload.name, avatarUrl } };
          channelModalCacheRef.current.set(payload.link, { savedAt: Date.now(), data: next });
          return next;
        });
      });

      userChannel.bind("message:pins-updated", (payload: unknown) => {
        if (payload && typeof payload === "object" && "chatId" in payload && "chatType" in payload)
          window.dispatchEvent(new CustomEvent(PINS_UPDATED_EVENT, { detail: payload as PinScope }));
      });

      userChannel.bind("group:role-updated", (rawPayload: unknown) => {
        const payload = rawPayload as { groupLink?: string; groupId?: string; memberId?: string; role?: string; roleLabel?: string; canChangeReactions?: boolean; canPinMessages?: boolean };
        if (!payload?.groupLink || !payload?.memberId) return;
        clearConversationCaches(selfId, payload.groupLink, "group");
        if (payload.memberId === selfId && payload.groupId) window.dispatchEvent(new CustomEvent(PINS_UPDATED_EVENT, { detail: { chatType: "group", chatId: payload.groupId } }));
        const permissionPatch = {
          ...(typeof payload.canChangeReactions === "boolean" ? { canChangeReactions: payload.canChangeReactions } : {}),
          ...(typeof payload.canPinMessages === "boolean" ? { canPinMessages: payload.canPinMessages } : {}),
        };
        const ownPermission = payload.memberId === selfId ? {
          ...(typeof payload.canChangeReactions === "boolean" ? { myCanChangeReactions: payload.canChangeReactions } : {}),
          ...(typeof payload.canPinMessages === "boolean" ? { myCanPinMessages: payload.canPinMessages } : {}),
          ...(payload.role ? { myRole: payload.role } : {}),
        } : {};
        setActiveConversation(previous => previous?.chatType === "group" && previous.group && previous.group.link === payload.groupLink
          ? { ...previous, group: { ...previous.group, ...ownPermission } } : previous);
        setGroupModalData((prev) => {
          if (!prev || prev.group.link !== payload.groupLink) return prev;
          const nextMembers = (prev.members ?? []).map((m: any) =>
            m.id === payload.memberId
              ? { ...m, ...permissionPatch, role: payload.role ?? m.role, roleLabel: payload.roleLabel ?? m.roleLabel }
              : m,
          );
          const next = { ...prev, group: { ...prev.group, ...ownPermission }, members: nextMembers };
          groupModalCacheRef.current.set(payload.groupLink, { savedAt: Date.now(), data: next });
          return next;
        });
      });

      userChannel.bind("channel:role-updated", (rawPayload: unknown) => {
        const payload = rawPayload as { channelLink?: string; channelId?: string; memberId?: string; role?: string; roleLabel?: string; canChangeReactions?: boolean; canPinMessages?: boolean };
        if (!payload?.channelLink || !payload?.memberId) return;
        clearConversationCaches(selfId, payload.channelLink, "channel");
        if (payload.memberId === selfId && payload.channelId) window.dispatchEvent(new CustomEvent(PINS_UPDATED_EVENT, { detail: { chatType: "channel", chatId: payload.channelId } }));
        const permissionPatch = {
          ...(typeof payload.canChangeReactions === "boolean" ? { canChangeReactions: payload.canChangeReactions } : {}),
          ...(typeof payload.canPinMessages === "boolean" ? { canPinMessages: payload.canPinMessages } : {}),
        };
        const ownPermission = payload.memberId === selfId ? {
          ...(typeof payload.canChangeReactions === "boolean" ? { myCanChangeReactions: payload.canChangeReactions } : {}),
          ...(typeof payload.canPinMessages === "boolean" ? { myCanPinMessages: payload.canPinMessages } : {}),
          ...(payload.role ? { myRole: payload.role } : {}),
        } : {};
        setActiveConversation(previous => previous?.chatType === "channel" && previous.channel && previous.channel.link === payload.channelLink
          ? { ...previous, channel: { ...previous.channel, ...ownPermission } } : previous);
        setChannelModalData((prev) => {
          if (!prev || prev.channel.link !== payload.channelLink) return prev;
          const currentSubs = prev.subscribers ?? prev.members ?? [];
          const nextSubs = currentSubs.map((s: any) =>
            s.id === payload.memberId
              ? { ...s, ...permissionPatch, role: payload.role ?? s.role, roleLabel: payload.roleLabel ?? s.roleLabel }
              : s,
          );
          const next = { ...prev, channel: { ...prev.channel, ...ownPermission }, subscribers: nextSubs, members: nextSubs };
          channelModalCacheRef.current.set(payload.channelLink, { savedAt: Date.now(), data: next });
          return next;
        });
      });

      userChannel.bind("shared:e2e-key-ready", (rawPayload: unknown) => {
        const payload = rawPayload as { chatType?: "group" | "channel"; link?: string };
        if (!payload?.link || (payload.chatType !== "group" && payload.chatType !== "channel")) return;
        decryptedPayloadFailureCache.clear();
        sharedKeyServerCacheRef.current.clear();
        delete conversationDecryptRetryRef.current[payload.link];
        delete decryptedPreviewFingerprintRef.current[payload.link];
        if (selectedLinkRef.current === payload.link) {
          void openConversationRef.current(payload.link, { force: true, chatType: payload.chatType });
        }
      });

      userChannel.bind("group:e2e-rotate", async (rawPayload: unknown) => {
        const payload = rawPayload as { groupLink?: string; groupId?: string; rotate?: boolean };
        if (!payload?.groupLink) return;
        try {
          const chatId = payload.groupId ?? resolveChatIdByLink("group", payload.groupLink) ?? "";
          if (!chatId) return;
          if (payload.rotate) {
            await rotateSharedKeyRef.current("group", payload.groupLink, chatId);
          } else {
            await ensureSharedKeyForMembersRef.current("group", payload.groupLink, chatId);
          }
        } catch {
          // ignore
        }
      });

      userChannel.bind("channel:e2e-rotate", async (rawPayload: unknown) => {
        const payload = rawPayload as { channelLink?: string; channelId?: string; rotate?: boolean };
        if (!payload?.channelLink) return;
        try {
          const chatId = payload.channelId ?? resolveChatIdByLink("channel", payload.channelLink) ?? "";
          if (!chatId) return;
          if (payload.rotate) {
            await rotateSharedKeyRef.current("channel", payload.channelLink, chatId);
          } else {
            await ensureSharedKeyForMembersRef.current("channel", payload.channelLink, chatId);
          }
        } catch {
          // ignore
        }
      });
      userChannel.bind("secret:accepted", async (rawPayload: unknown) => {
        const payload = rawPayload as { secretChatId: string; expiresAt: string };
        if (!payload?.secretChatId) return;

        toast.success(t("Запрос на секретный чат принят!"));

        // 2. Update active conversation if it matches
        const activeConversationId = activeConversationRef.current?.conversationId;
        const targetSecretId = `secret:${payload.secretChatId}`;
        if (activeConversationId === targetSecretId) {
          setActiveConversation((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              isApproved: true,
              expiresAt: payload.expiresAt,
            };
          });
          setSecretChatExpiresAt(payload.expiresAt);
        }

        // 3. Update chats list
        setChats((prev) =>
          prev.map((chat) => {
            const isMatch =
              chat.conversationId === `secret:${payload.secretChatId}` ||
              chat.link === `secret-${payload.secretChatId}`;
            if (isMatch) {
              return {
                ...chat,
                isApproved: true,
                expiresAt: payload.expiresAt,
                lastMessage: t("Секретный чат"),
                unreadCount: 0,
              };
            }
            return chat;
          })
        );
        void loadSecretChatsRef.current();
        if (activeConversationId === targetSecretId) {
          void openConversationRef.current(`secret-${payload.secretChatId}`, { force: true, chatType: "direct" });
        }
      });

      userChannel.bind("secret:deleted", (rawPayload: unknown) => {
        const payload = rawPayload as { secretChatId: string };
        if (payload?.secretChatId) {
          handleSecretChatExpiredRef.current(payload.secretChatId);
        }
      });

      userChannel.bind("secret:created", (rawPayload: unknown) => {
        const payload = rawPayload as {
          id: string;
          title: string;
          expiresAt: string | null;
          lifetimeSeconds: number;
          isApproved: boolean;
          peer: { id: string; link: string; displayName: string; avatarUrl: string | null };
        };
        if (!payload?.id || !payload?.peer) return;

        const expTime = payload.expiresAt ? new Date(payload.expiresAt).getTime() : null;
        const peerDisplayName = payload.peer.displayName || payload.peer.link || payload.title || t("Секретный чат");

        const nextChat: ChatSummary = {
          chatType: "direct",
          conversationId: `secret:${payload.id}`,
          peerId: payload.peer.id,
          link: `secret-${payload.id}`,
          displayName: peerDisplayName,
          avatarUrl: payload.peer.avatarUrl || null,
          membersCount: "0",
          lastMessage: t("Приглашение в секретный чат"),
          lastMessageAt: new Date().toISOString(),
          lastMessageMine: false,
          unreadCount: 1,
          contactTag: "SECRET",
          contactTagVariant: "outline",
          lastMessageCipherText: null,
          lastMessageIv: null,
          lastMessageEncryptedKey: null,
          lastMessageKeyVersion: null,
          lastMessageSenderId: null,
          lastMessageSenderAlias: null,
          isCreator: false,
          isApproved: false,
          creatorId: payload.peer.id,
          expiresAt: payload.expiresAt,
        };

        showAppToast({
          title: peerDisplayName,
          description: t("Приглашение в секретный чат"),
          type: "info",
        });

        setChats((prev) => {
          const filtered = prev.filter((c) => c.conversationId !== `secret:${payload.id}` && c.link !== `secret-${payload.id}`);
          return [nextChat, ...filtered];
        });

        void loadSecretChatsRef.current();
      });

      pusherRef.current = pusher;
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
    }
  }

  void setupRealtime();

  return () => {
    cancelled = true;
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
    if (recordingHeartbeatRef.current) {
      clearInterval(recordingHeartbeatRef.current);
      recordingHeartbeatRef.current = null;
    }
    if (sendingHeartbeatRef.current) {
      clearInterval(sendingHeartbeatRef.current);
      sendingHeartbeatRef.current = null;
    }
    Object.values(typingResetByLinkRef.current).forEach((timer) => clearTimeout(timer));
    typingResetByLinkRef.current = {};
    Object.values(recordingResetByLinkRef.current).forEach((timer) => clearTimeout(timer));
    recordingResetByLinkRef.current = {};
    Object.values(sendingResetByLinkRef.current).forEach((timer) => clearTimeout(timer));
    sendingResetByLinkRef.current = {};
    teardownRealtimeUnload?.();
    const current = pusherRef.current as { disconnect: () => void; connection?: { state?: string } } | null;
    if (current) {
      try {
        if (current.connection?.state !== "disconnected") {
          current.disconnect();
        }
      } catch {
        // ignore disconnect errors
      }
    }
    pusherRef.current = null;
  };
}
