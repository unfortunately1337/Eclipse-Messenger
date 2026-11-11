"use client";

import { type ChatSummary, type ConversationResponse, type StoryReplyTarget, type DecryptedMessage, type PendingImagePayload, type PendingVideoPayload, type PendingAudioPayload, type PendingFilePayload, type PendingAlbumItem, type ConversationChatType, type EditTarget, type EncryptedMessage, type GroupMessagePayload, type ChannelMessagePayload } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type BotManagementState, type BotManagementAction } from "@/lib/bot-management";
import { bindSecretDeviceKey, loadSecretDeviceIdentity, secretEncryptionContext } from "@/lib/client/secret-device-keys";
import { apiRequest } from "@/lib/client/http";
import { appToast as toast } from "@/lib/client/app-toast";
import { serializeForwardedContent, copyForwardMedia, type ForwardedContent } from "@/lib/client/message-forwarding";
import { type EmojiComposerHandle } from "@/components/EmojiComposer";
import { makeMediaPreviewDetails } from "@/lib/client/media-preview";
import { loadEncryptedMediaBlob } from "@/lib/client/media-crypto";
import { cacheMediaBlobUrl, cacheMediaPreviewDetails } from "@/lib/client/media-cache";
import { MEDIA_UPLOAD_CONCURRENCY } from "../constants";
import { encryptMessageForUsers, encryptWithSharedKey } from "@/lib/client/e2e";
import { MAX_MEDIA_ALBUM_ITEMS, serializeAlbumContent, serializeFileContent, serializeMessageContent, serializeMusicContent, serializeStoryReplyContent, serializeVideoContent } from "../chat-message-transport";
import { finalizeOptimisticMessage } from "../chat-message-state";
import { shouldApplyChatPreviewByTimestamp } from "../chat-realtime-chatlist";
import { assertMessageCooldown, messageRateLimit, rememberMessageCooldown } from "@/lib/client/message-send-limit";
import { forgetOutgoingMessage, peekOutgoingMessage, rememberOutgoingMessage, removeFailedMessage, saveFailedMessage } from "@/lib/client/failed-message-store";

export interface SendPreparedMessageActionContext {
  activeChat: ChatSummary | null;
  activeConversation: ConversationResponse | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  selectedLinkRef: React.RefObject<string | null>;
  currentUserIdRef: React.RefObject<string | null>;
  selfId: string | null;
  removeOptimisticMessage: (optimisticMessageId: string | null | undefined) => void;
  beginMessageSend: () => void;
  eclipseBots: { state: BotManagementState | null; menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>; busy: boolean; error: string | null; act: (action: BotManagementAction, options?: { text?: string | undefined; botId?: string | undefined; file?: File | undefined; throwOnRateLimit?: boolean }) => Promise<boolean>; refresh: () => Promise<BotManagementState>; };
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  endMessageSend: () => void;
  replyToMessageId: string | null;
  setErrorText: (message: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  setPendingImage: React.Dispatch<React.SetStateAction<PendingImagePayload | null>>;
  setPendingVideo: React.Dispatch<React.SetStateAction<PendingVideoPayload | null>>;
  setPendingAudio: React.Dispatch<React.SetStateAction<PendingAudioPayload | null>>;
  setPendingFile: React.Dispatch<React.SetStateAction<PendingFilePayload | null>>;
  setPendingMediaBatch: React.Dispatch<React.SetStateAction<PendingAlbumItem[] | null>>;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
  ensureSharedKeyFromServer: (chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{ version: number; keyBase64: string; createdAt: number; } | null>;
  rotateSharedKey: (chatType: "group" | "channel", link: string, chatId: string) => Promise<{ version: number; keyBase64: string; createdAt: number; }>;
  animatedMessageIdsRef: React.RefObject<Set<string>>;
  isMessageMarkedDeleted: (messageId: string) => boolean;
  markMessageDeletedTombstone: (messageId: string) => void;
  pendingDeleteRef: React.RefObject<{ messageId: string; link: string; chatType: ConversationChatType; previousMessages: DecryptedMessage[]; finalizeTimer: NodeJS.Timeout; } | null>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  ensureOwnE2EReady: (options?: { allowPrompt?: boolean | undefined; } | undefined) => Promise<{ privateKey: CryptoKey; publicKeyBase64: string; privateKeyBase64: string | null; }>;
  peerPublicKeyByLinkRef: React.RefObject<Record<string, string>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  handleSecretChatExpired: (expiredChatId?: string | undefined) => void;
  activeTitle: string;
}

export async function sendPreparedMessageAction({ activeChat, activeConversation, t, selectedLinkRef, currentUserIdRef, selfId, removeOptimisticMessage, beginMessageSend, eclipseBots, setMessageText, setReplyToMessageId, setStoryReplyTarget, endMessageSend, replyToMessageId, setErrorText, setMessages, sanitizeMessages, setPendingImage, setPendingVideo, setPendingAudio, setPendingFile, setPendingMediaBatch, openConversationRef, buildSharedChatKeyId, ensureSharedKeyFromServer, rotateSharedKey, animatedMessageIdsRef, isMessageMarkedDeleted, markMessageDeletedTombstone, pendingDeleteRef, setChats, ensureOwnE2EReady, peerPublicKeyByLinkRef, setActiveConversation, handleSecretChatExpired, activeTitle }: SendPreparedMessageActionContext, payloadText: string, options?: { resetComposer?: boolean; replyToMessageId?: string | null; optimisticMessageId?: string | null; throwOnError?: boolean }): Promise<void> {
  if (!payloadText || !activeChat || !activeConversation) {
    if (options?.throwOnError) throw new Error(t("Чат ещё загружается"));
    return;
  }
  const stillCurrentDialog = () => selectedLinkRef.current === activeChat.link && currentUserIdRef.current === selfId;

  const targetReplyId = options && "replyToMessageId" in options ? options.replyToMessageId ?? null : replyToMessageId ?? null;
  const replyPayload = targetReplyId ? { replyToMessageId: targetReplyId } : {};
  const clientMessageId =
    options?.optimisticMessageId ??
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `msg:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`);

  beginMessageSend();
  setErrorText(null);
  const account = selfId ?? currentUserIdRef.current ?? "";
  const sendTarget = `${activeConversation.chatType}:${activeChat.link}`;
  const snapshot = peekOutgoingMessage(clientMessageId) ?? { id: clientMessageId, localId: clientMessageId, senderId: account, text: payloadText, createdAt: new Date().toISOString(), replyToMessageId: targetReplyId };
  rememberOutgoingMessage({ ...snapshot, text: payloadText, pending: true, sendFailure: undefined });
  if (stillCurrentDialog()) setMessages(previous => previous.map(message => message.id === clientMessageId ? { ...message, pending: true, sendFailure: undefined } : message));
  const sendRequest = async <T,>(url: string, init: RequestInit): Promise<T> => {
    const result = await apiRequest<T>(url, init);
    void removeFailedMessage(clientMessageId);
    forgetOutgoingMessage(clientMessageId);
    return result;
  };

  try {
    assertMessageCooldown(account, sendTarget);
    if (activeConversation.chatType === "eclipse") {
      const completed = await eclipseBots.act("submit", { text: payloadText, throwOnRateLimit: true });
      if (completed) {
        void removeFailedMessage(clientMessageId);
        if (stillCurrentDialog()) {
          removeOptimisticMessage(clientMessageId);
          if (options?.resetComposer ?? true) setMessageText("");
          setReplyToMessageId(null); setStoryReplyTarget(null);
        }
      } else if (stillCurrentDialog()) removeOptimisticMessage(clientMessageId);
      return;
    }
    if (activeConversation.chatType === "direct" && activeConversation.peer?.isBot && !activeChat.link.startsWith("secret-")) {
      const data = await sendRequest<{ message: EncryptedMessage }>(`/api/bots/${encodeURIComponent(activeChat.link)}/messages`, {
        method: "POST", body: JSON.stringify({ text: payloadText, requestId: clientMessageId, ...(targetReplyId ? { replyToMessageId: targetReplyId } : {}) }),
      });
      if (!stillCurrentDialog()) return;
      setMessages(previous => finalizeOptimisticMessage({
        prev: sanitizeMessages(previous), optimisticMessageId: options?.optimisticMessageId,
        nextMessage: { id: data.message.id, senderId: data.message.senderId, text: payloadText, createdAt: data.message.createdAt, replyToMessageId: targetReplyId, reactions: [] }
      }));
      if (options?.resetComposer ?? true) { setMessageText(""); setPendingImage(null); setPendingVideo(null); setPendingAudio(null); setPendingFile(null); setPendingMediaBatch(null); }
      setReplyToMessageId(null); setStoryReplyTarget(null);
      void openConversationRef.current(activeChat.link, { force: true, chatType: "direct" });
      return;
    }
    if (activeConversation.chatType === "group") {
      const groupId = activeConversation.group?.id ?? "";
      const chatKeyId = groupId ? buildSharedChatKeyId("group", groupId) : null;
      let keyEntry: { version: number; keyBase64: string; createdAt: number } | null = null;
      if (!keyEntry && groupId) {
        try {
          const fetched = await ensureSharedKeyFromServer("group", activeChat.link, groupId, null);
          if (fetched) {
            keyEntry = fetched;
          }
        } catch {
          // ignore
        }
      }
      if (!keyEntry && groupId) {
        try {
          keyEntry = await rotateSharedKey("group", activeChat.link, groupId);
        } catch (err) {
          console.warn("Failed to initialize/rotate group shared key:", err);
        }
      }
      if (!keyEntry) {
        throw new Error(t("Не удалось получить ключ шифрования для группы. Попробуйте еще раз."));
      }
      const encrypted = await encryptWithSharedKey({
        plainText: payloadText,
        keyBase64: keyEntry.keyBase64,
      });

      const data = await sendRequest<{ message: GroupMessagePayload }>(
        `/api/chats/${encodeURIComponent(activeChat.link)}?chatType=group`,
        {
          method: "POST",
          body: JSON.stringify({
            cipherText: encrypted.cipherText,
            iv: encrypted.iv,
            keyVersion: keyEntry.version,
            clientMessageId,
            ...replyPayload,
          }),
        },
      );

      if (!stillCurrentDialog()) return;
      const effectiveSelfId = selfId ?? currentUserIdRef.current ?? null;
      animatedMessageIdsRef.current.add(data.message.id);
      if (options?.optimisticMessageId && isMessageMarkedDeleted(options.optimisticMessageId)) {
        markMessageDeletedTombstone(data.message.id);
        if (pendingDeleteRef.current && pendingDeleteRef.current.messageId === options.optimisticMessageId) {
          pendingDeleteRef.current.messageId = data.message.id;
        }
        void apiRequest(`/api/chats/${encodeURIComponent(activeChat.link)}?chatType=group`, {
          method: "DELETE",
          body: JSON.stringify({ messageId: data.message.id }),
        }).catch(() => { });
        return;
      }
      if (pendingDeleteRef.current && options?.optimisticMessageId && pendingDeleteRef.current.messageId === options.optimisticMessageId) {
        pendingDeleteRef.current.messageId = data.message.id;
      }
      setMessages((prev) =>
        finalizeOptimisticMessage({
          prev: sanitizeMessages(prev),
          optimisticMessageId: options?.optimisticMessageId,
          nextMessage: {
            id: data.message.id,
            senderId: effectiveSelfId ?? data.message.senderId ?? "",
            text: payloadText,
            replyToMessageId: data.message.replyToMessageId ?? targetReplyId,
            createdAt: data.message.createdAt,
            senderDisplayName: data.message.senderDisplayName,
            reactions: data.message.reactions ?? [],
            readBy: data.message.readBy ?? [],
          },
        }),
      );

      setChats((prev) =>
        prev.map((chat) =>
          chat.link === activeChat.link
            ? shouldApplyChatPreviewByTimestamp(chat.lastMessageAt, data.message.createdAt)
              ? {
                ...chat,
                lastMessage: payloadText,
                lastMessageAt: data.message.createdAt,
                lastMessageMine: true,
              }
              : chat
            : chat,
        ),
      );

      if (options?.resetComposer ?? true) {
        setMessageText("");
        setPendingImage(null);
        setPendingVideo(null);
        setPendingAudio(null);
        setPendingFile(null);
        setPendingMediaBatch(null);
      }
      setReplyToMessageId(null);
      setStoryReplyTarget(null);
      return;
    }

    if (activeConversation.chatType === "channel") {
      const channel = activeConversation.channel;
      const canPublish = channel?.ownerId === selfId || (channel?.myRole === "admin" && channel.myCanPostMessages);
      if (!canPublish) {
        throw new Error(t("У вас нет права публиковать сообщения в этом канале"));
      }

      const channelId = activeConversation.channel?.id ?? "";
      const chatKeyId = channelId ? buildSharedChatKeyId("channel", channelId) : null;
      let keyEntry: { version: number; keyBase64: string; createdAt: number } | null = null;
      if (!keyEntry && channelId) {
        try {
          const fetched = await ensureSharedKeyFromServer("channel", activeChat.link, channelId, null);
          if (fetched) {
            keyEntry = fetched;
          }
        } catch {
          // ignore
        }
      }
      if (!keyEntry && channelId) {
        try {
          keyEntry = await rotateSharedKey("channel", activeChat.link, channelId);
        } catch (err) {
          console.warn("Failed to initialize/rotate channel shared key:", err);
        }
      }
      if (!keyEntry) {
        throw new Error(t("Не удалось получить ключ шифрования для канала."));
      }
      const encrypted = await encryptWithSharedKey({
        plainText: payloadText,
        keyBase64: keyEntry.keyBase64,
      });

      const data = await sendRequest<{ message: ChannelMessagePayload }>(
        `/api/chats/${encodeURIComponent(activeChat.link)}?chatType=channel`,
        {
          method: "POST",
          body: JSON.stringify({
            cipherText: encrypted.cipherText,
            iv: encrypted.iv,
            keyVersion: keyEntry.version,
            clientMessageId,
            ...replyPayload,
          }),
        },
      );

      if (!stillCurrentDialog()) return;
      const effectiveSelfId = selfId ?? currentUserIdRef.current ?? null;
      animatedMessageIdsRef.current.add(data.message.id);
      if (options?.optimisticMessageId && isMessageMarkedDeleted(options.optimisticMessageId)) {
        markMessageDeletedTombstone(data.message.id);
        if (pendingDeleteRef.current && pendingDeleteRef.current.messageId === options.optimisticMessageId) {
          pendingDeleteRef.current.messageId = data.message.id;
        }
        void apiRequest(`/api/chats/${encodeURIComponent(activeChat.link)}?chatType=channel`, {
          method: "DELETE",
          body: JSON.stringify({ messageId: data.message.id }),
        }).catch(() => { });
        return;
      }
      if (pendingDeleteRef.current && options?.optimisticMessageId && pendingDeleteRef.current.messageId === options.optimisticMessageId) {
        pendingDeleteRef.current.messageId = data.message.id;
      }
      setMessages((prev) =>
        finalizeOptimisticMessage({
          prev: sanitizeMessages(prev),
          optimisticMessageId: options?.optimisticMessageId,
          nextMessage: {
            id: data.message.id,
            senderId: effectiveSelfId ?? data.message.senderId ?? "",
            text: payloadText,
            replyToMessageId: data.message.replyToMessageId ?? targetReplyId,
            createdAt: data.message.createdAt,
            viewsCount: activeConversation?.chatType === "channel" ? data.message.viewsCount ?? "1" : data.message.viewsCount,
          },
        }),
      );

      setChats((prev) =>
        prev.map((chat) =>
          chat.link === activeChat.link
            ? shouldApplyChatPreviewByTimestamp(chat.lastMessageAt, data.message.createdAt)
              ? {
                ...chat,
                lastMessage: payloadText,
                lastMessageAt: data.message.createdAt,
                lastMessageMine: true,
              }
              : chat
            : chat,
        ),
      );

      if (options?.resetComposer ?? true) {
        setMessageText("");
        setPendingImage(null);
        setPendingVideo(null);
        setPendingAudio(null);
        setPendingFile(null);
        setPendingMediaBatch(null);
      }
      setReplyToMessageId(null);
      setStoryReplyTarget(null);
      return;
    }

    const secretInfo = activeChat.link.startsWith("secret-") ? activeConversation.secretCrypto : undefined;
    if (secretInfo?.version === 2) {
      await bindSecretDeviceKey(selfId ?? "", activeChat.link.substring("secret-".length), secretInfo, activeConversation.peer?.publicKey ?? null, activeConversation.expiresAt);
    }
    const ownKeys = secretInfo?.version === 2 ? await loadSecretDeviceIdentity(selfId ?? "", secretInfo) : await ensureOwnE2EReady();

    const isSavedDialog = activeConversation.chatType === "saved";
    let recipientPublicKey = isSavedDialog ? ownKeys.publicKeyBase64 : activeConversation.peer?.publicKey ?? null;
    if (recipientPublicKey?.startsWith("encdet:v1:")) {
      recipientPublicKey = null;
    }
    if (!isSavedDialog && secretInfo?.version !== 2 && activeConversation.peer?.link) {
      const peerLink = activeConversation.peer.link;
      recipientPublicKey = recipientPublicKey ?? peerPublicKeyByLinkRef.current[peerLink] ?? null;
      if (recipientPublicKey?.startsWith("encdet:v1:")) {
        recipientPublicKey = null;
      }
      if (!recipientPublicKey) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const keyState = await apiRequest<{ publicKey: string | null }>(
              `/api/settings/e2e-key/${encodeURIComponent(peerLink)}`,
              { method: "GET" },
            );
            if (keyState.publicKey && !keyState.publicKey.startsWith("encdet:v1:")) {
              recipientPublicKey = keyState.publicKey;
              peerPublicKeyByLinkRef.current[peerLink] = keyState.publicKey;
              setActiveConversation((prev) =>
                (prev?.chatType === "direct" || prev?.chatType === "saved") && prev.peer
                  ? { ...prev, peer: { ...prev.peer, publicKey: recipientPublicKey } }
                  : prev,
              );
              break;
            }
          } catch {
            // ignore refresh failure and continue retry loop
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 220));
          }
        }
      }
    }

    if (!recipientPublicKey) {
      throw new Error(t("У пользователя старая версия Eclipse, ему необходимо перезайти в мессенджер"));
    }

    const body = await encryptMessageForUsers({
      plainText: payloadText,
      senderPublicKeyBase64: ownKeys.publicKeyBase64,
      recipientPublicKeyBase64: recipientPublicKey,
      context: secretInfo?.version === 2 ? secretEncryptionContext(activeChat.link.substring("secret-".length)) : undefined,
    });

    const data = await sendRequest<{ message: EncryptedMessage }>(`/api/chats/${encodeURIComponent(activeChat.link)}?chatType=${isSavedDialog ? "saved" : "direct"}`, {
      method: "POST",
      body: JSON.stringify({ ...body, ...replyPayload, clientMessageId }),
    });

    const plain = payloadText;

    if (activeChat.link.startsWith("secret-")) {
      const secretChatId = activeChat.link.substring("secret-".length);
      const storedCodeword = typeof window !== "undefined" ? localStorage.getItem(`secret_codeword_${secretChatId}`) : null;
      if (storedCodeword && plain.trim().toLowerCase() === storedCodeword.trim().toLowerCase()) {
        void (async () => {
          try {
            await apiRequest(`/api/chats/secret-${secretChatId}`, { method: "DELETE" });
            handleSecretChatExpired(secretChatId);
            toast.info(t("Кодовое слово активировано. Секретный чат удален."));
          } catch (err) {
            console.error("Failed to delete secret chat via codeword:", err);
          }
        })();
      }
    }

    if (!stillCurrentDialog()) return;
    const effectiveSelfId = selfId ?? currentUserIdRef.current ?? null;
    animatedMessageIdsRef.current.add(data.message.id);
    if (options?.optimisticMessageId && isMessageMarkedDeleted(options.optimisticMessageId)) {
      markMessageDeletedTombstone(data.message.id);
      if (pendingDeleteRef.current && pendingDeleteRef.current.messageId === options.optimisticMessageId) {
        pendingDeleteRef.current.messageId = data.message.id;
      }
      void apiRequest(`/api/chats/${encodeURIComponent(activeChat.link)}?chatType=${isSavedDialog ? "saved" : "direct"}`, {
        method: "DELETE",
        body: JSON.stringify({ messageId: data.message.id }),
      }).catch(() => { });
      return;
    }
    if (pendingDeleteRef.current && options?.optimisticMessageId && pendingDeleteRef.current.messageId === options.optimisticMessageId) {
      pendingDeleteRef.current.messageId = data.message.id;
    }
    setMessages((prev) =>
      finalizeOptimisticMessage({
        prev: sanitizeMessages(prev),
        optimisticMessageId: options?.optimisticMessageId,
        nextMessage: {
          id: data.message.id,
          senderId: effectiveSelfId ?? data.message.senderId ?? "",
          text: plain,
          replyToMessageId: data.message.replyToMessageId ?? targetReplyId,
          createdAt: data.message.createdAt,
        },
      }),
    );

    setChats((prev) => {
      const updatedExisting = prev.map((chat) =>
        chat.link === activeChat.link
          ? shouldApplyChatPreviewByTimestamp(chat.lastMessageAt, data.message.createdAt)
            ? {
              ...chat,
              lastMessage: plain,
              lastMessageAt: data.message.createdAt,
              lastMessageMine: true,
            }
            : chat
          : chat,
      );
      if (updatedExisting.some((chat) => chat.link === activeChat.link)) {
        return updatedExisting;
      }

      if (activeConversation.chatType === "direct" && activeConversation.peer) {
        return [
          {
            chatType: "direct",
            conversationId:
              activeConversation.conversationId ?? `direct:${activeConversation.peer.id}`,
            peerId: activeConversation.peer.id,
            link: activeConversation.peer.link,
            displayName: activeConversation.peer.displayName,
            contactAlias: activeConversation.peer.contactAlias ?? null,
            avatarUrl: activeConversation.peer.avatarUrl ?? null,
            lastMessage: plain,
            lastMessageAt: data.message.createdAt,
            lastMessageMine: true,
            contactTag: null,
            contactTagVariant: "outline",
            lastMessageCipherText: null,
            lastMessageIv: null,
            lastMessageEncryptedKey: null,
          },
          ...updatedExisting,
        ];
      }
      if (activeConversation.chatType === "saved") {
        return [
          {
            chatType: "saved",
            conversationId: activeConversation.conversationId ?? "saved",
            peerId: selfId ?? "self",
            link: activeChat.link,
            displayName: activeTitle || t("Избранное"),
            avatarUrl: null,
            lastMessage: plain,
            lastMessageAt: data.message.createdAt,
            lastMessageMine: true,
            contactTag: null,
            contactTagVariant: "outline",
            lastMessageCipherText: null,
            lastMessageIv: null,
            lastMessageEncryptedKey: null,
          },
          ...updatedExisting,
        ];
      }

      return updatedExisting;
    });

    if (options?.resetComposer ?? true) {
      setMessageText("");
      setPendingImage(null);
      setPendingVideo(null);
      setPendingAudio(null);
      setPendingFile(null);
      setPendingMediaBatch(null);
    }
    setReplyToMessageId(null);
    setStoryReplyTarget(null);
  } catch (error) {
    const limited = messageRateLimit(error);
    if (limited) {
      rememberMessageCooldown(account, sendTarget, limited);
      const failed: DecryptedMessage = { ...snapshot, text: payloadText, pending: false, sendFailure: { kind: "rate_limit", retryAt: limited.retryAt } };
      rememberOutgoingMessage(failed);
      if (currentUserIdRef.current === account && !isMessageMarkedDeleted(clientMessageId)) {
        if (stillCurrentDialog()) setMessages(previous => {
          const existing = previous.find(message => message.id === clientMessageId || message.localId === clientMessageId);
          const value = { ...failed, createdAt: existing?.createdAt ?? failed.createdAt };
          return existing ? previous.map(message => message === existing ? value : message) : [...previous, value];
        });
        void saveFailedMessage(account, sendTarget, failed).then(() => {
          if (isMessageMarkedDeleted(clientMessageId) || currentUserIdRef.current !== account) void removeFailedMessage(clientMessageId);
        });
      }
      if (stillCurrentDialog() && (options?.resetComposer ?? true)) {
        setMessageText(""); setReplyToMessageId(null); setStoryReplyTarget(null);
        setPendingImage(null); setPendingVideo(null); setPendingAudio(null); setPendingFile(null); setPendingMediaBatch(null);
      }
      return; // Bubble owns the error. Outer media/sticker handlers must not toast or remove it.
    }
    if (snapshot.sendFailure && currentUserIdRef.current === account && !isMessageMarkedDeleted(clientMessageId)) {
      const failed = { ...snapshot, pending: false };
      rememberOutgoingMessage(failed);
      if (stillCurrentDialog()) setMessages(previous => previous.map(message => message.id === clientMessageId ? failed : message));
      return;
    }
    forgetOutgoingMessage(clientMessageId);
    if (stillCurrentDialog() && options?.optimisticMessageId) {
      setMessages((prev) => prev.filter((message) => message.id !== options.optimisticMessageId));
    }
    if (stillCurrentDialog() && !options?.throwOnError) setErrorText(error instanceof Error ? error.message : t("Не удалось отправить сообщение"));
    if (options?.throwOnError) throw error;
  } finally {
    endMessageSend();
  }
}

export interface SendMessageActionContext {
  sendingMessageInFlightRef: React.RefObject<boolean>;
  sending: boolean;
  sendingMedia: boolean;
  forwardDraft: { link: string; chatType: "direct" | "group" | "channel" | "saved"; share?: boolean | undefined; messages: (ForwardedContent & { requestId: string; preparedContent?: string | undefined; })[]; } | null;
  forwardSending: boolean;
  selectedLink: string | null;
  activeChat: ChatSummary | null;
  activeConversation: ConversationResponse | null;
  setForwardSending: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLinkRef: React.RefObject<string | null>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  uploadChatMediaFile: (file: Blob, kind: "image" | "video" | "voice" | "file" | "audio" | "video_note", durationMs?: number | undefined) => Promise<{ id: string; url: string; expiresAt?: string | null | undefined; }>;
  pushOptimisticMessage: (payloadText: string, options?: { replyToMessageId?: string | null | undefined; id?: string | undefined; } | undefined) => string | null;
  sendPreparedMessage: (payloadText: string, options?: { resetComposer?: boolean | undefined; replyToMessageId?: string | null | undefined; optimisticMessageId?: string | null | undefined; throwOnError?: boolean | undefined; } | undefined) => Promise<void>;
  setForwardDraft: React.Dispatch<React.SetStateAction<{ link: string; chatType: "direct" | "group" | "channel" | "saved"; share?: boolean | undefined; messages: (ForwardedContent & { requestId: string; preparedContent?: string | undefined; })[]; } | null>>;
  messageText: string;
  setErrorText: (message: string | null) => void;
  editTarget: EditTarget | null;
  saveEditedMessage: () => Promise<void>;
  isManagedBotConversation: boolean;
  startActiveBot: () => Promise<boolean>;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  isEclipseConversation: boolean;
  eclipseBots: { state: BotManagementState | null; menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>; busy: boolean; error: string | null; act: (action: BotManagementAction, options?: { text?: string | undefined; botId?: string | undefined; file?: File | undefined; throwOnRateLimit?: boolean }) => Promise<boolean>; refresh: () => Promise<BotManagementState>; };
  pendingImage: PendingImagePayload | null;
  pendingMediaBatch: PendingAlbumItem[] | null;
  pendingVideo: PendingVideoPayload | null;
  pendingAudio: PendingAudioPayload | null;
  pendingFile: PendingFilePayload | null;
  beginMessageSend: () => void;
  setPendingImage: React.Dispatch<React.SetStateAction<PendingImagePayload | null>>;
  setPendingMediaBatch: React.Dispatch<React.SetStateAction<PendingAlbumItem[] | null>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  endMessageSend: () => void;
  setSendingMedia: React.Dispatch<React.SetStateAction<boolean>>;
  setSendingRealtimeKind: React.Dispatch<React.SetStateAction<"image" | "video" | "voice" | "file" | "music" | "video_note" | null>>;
  pushSending: (kind: "image" | "video" | "voice" | "file" | "music" | "video_note", isSending: boolean) => Promise<void>;
  removeOptimisticMessage: (optimisticMessageId: string | null | undefined) => void;
  setPendingAudio: React.Dispatch<React.SetStateAction<PendingAudioPayload | null>>;
  setPendingFile: React.Dispatch<React.SetStateAction<PendingFilePayload | null>>;
  setPendingVideo: React.Dispatch<React.SetStateAction<PendingVideoPayload | null>>;
  isDesktop: boolean;
  messageInputRef: React.RefObject<EmojiComposerHandle | null>;
  storyReplyTarget: StoryReplyTarget | null;
  replyToMessageId: string | null;
}

export async function sendMessageAction({ sendingMessageInFlightRef, sending, sendingMedia, forwardDraft, forwardSending, selectedLink, activeChat, activeConversation, setForwardSending, selectedLinkRef, t, uploadChatMediaFile, pushOptimisticMessage, sendPreparedMessage, setForwardDraft, messageText, setErrorText, editTarget, saveEditedMessage, isManagedBotConversation, startActiveBot, setMessageText, isEclipseConversation, eclipseBots, pendingImage, pendingMediaBatch, pendingVideo, pendingAudio, pendingFile, beginMessageSend, setPendingImage, setPendingMediaBatch, setReplyToMessageId, setStoryReplyTarget, endMessageSend, setSendingMedia, setSendingRealtimeKind, pushSending, removeOptimisticMessage, setPendingAudio, setPendingFile, setPendingVideo, isDesktop, messageInputRef, storyReplyTarget, replyToMessageId }: SendMessageActionContext): Promise<void> {
  if (sendingMessageInFlightRef.current || sending || sendingMedia) {
    return;
  }
  if (forwardDraft?.messages.length) {
    if (forwardSending || selectedLink !== forwardDraft.link || activeChat?.link !== forwardDraft.link || activeConversation?.chatType !== forwardDraft.chatType) return;
    sendingMessageInFlightRef.current = true;
    setForwardSending(true);
    const draft = forwardDraft;
    let remaining = draft.messages;
    try {
      for (const item of draft.messages) {
        if (selectedLinkRef.current !== draft.link) throw new Error(t("Пересылка остановлена: чат изменился"));
        const content = item.preparedContent ?? await copyForwardMedia(item.content, async (url, kind, name, duration) => {
          const blob = await loadEncryptedMediaBlob(url);
          const file = name ? new File([blob], name, { type: blob.type }) : blob;
          return (await uploadChatMediaFile(file, kind, duration)).url;
        });
        if (selectedLinkRef.current !== draft.link) throw new Error(t("Пересылка остановлена: чат изменился"));
        item.preparedContent = content;
        const payload = draft.share ? content : serializeForwardedContent(content, item.author);
        const optimisticId = pushOptimisticMessage(payload, { replyToMessageId: null, id: item.requestId });
        await sendPreparedMessage(payload, { resetComposer: false, replyToMessageId: null, optimisticMessageId: optimisticId, throwOnError: true });
        remaining = remaining.slice(1);
        setForwardDraft(previous => previous?.link === draft.link ? remaining.length ? { ...previous, messages: remaining } : null : previous);
      }
      if (messageText.trim()) {
        await sendPreparedMessage(messageText.trim(), { resetComposer: true, replyToMessageId: null, throwOnError: true });
      }
    } catch (error) { setErrorText(error instanceof Error ? error.message : t("Не удалось переслать сообщения")); }
    finally { sendingMessageInFlightRef.current = false; setForwardSending(false); }
    return;
  }
  if (editTarget) {
    sendingMessageInFlightRef.current = true;
    try {
      await saveEditedMessage();
    } finally {
      sendingMessageInFlightRef.current = false;
    }
    return;
  }
  const text = messageText.trim();
  if (isManagedBotConversation && text === "/start") {
    if (await startActiveBot()) setMessageText("");
    return;
  }
  if (isEclipseConversation) {
    if (eclipseBots.busy) return;
    const avatarFile = pendingImage?.file ?? (pendingMediaBatch?.length === 1 && pendingMediaBatch[0].kind === "image" ? pendingMediaBatch[0].file : null);
    const hasAttachment = Boolean(pendingImage || pendingVideo || pendingAudio || pendingFile || pendingMediaBatch?.length);
    if (!text && !hasAttachment) return;
    if (!hasAttachment) {
      const id = pushOptimisticMessage(text);
      await sendPreparedMessage(text, { optimisticMessageId: id });
      return;
    }
    if (hasAttachment && (eclipseBots.state?.step !== "avatar" || !avatarFile || pendingVideo || pendingAudio || pendingFile || (pendingMediaBatch?.length ?? 0) > 1)) {
      setErrorText(t("Для создания бота прикрепите одно изображение на шаге аватара. Сейчас системный бот принимает текст, стикеры и аватар бота."));
      return;
    }
    sendingMessageInFlightRef.current = true;
    beginMessageSend();
    try {
      const completed = await eclipseBots.act(avatarFile ? "avatar" : "submit", avatarFile ? { file: avatarFile } : { text });
      if (completed) {
        setMessageText(""); setPendingImage(null); setPendingMediaBatch(null);
        setReplyToMessageId(null); setStoryReplyTarget(null);
      }
    } finally { sendingMessageInFlightRef.current = false; endMessageSend(); }
    return;
  }
  if (
    !text &&
    !pendingMediaBatch?.length &&
    !pendingAudio &&
    !pendingFile &&
    !pendingVideo &&
    !pendingImage
  ) {
    return;
  }

  sendingMessageInFlightRef.current = true;
  try {
    if (pendingMediaBatch?.length) {
      setMessageText("");
      setReplyToMessageId(null);
      setStoryReplyTarget(null);
      setSendingMedia(true);
      const mediaBatch = pendingMediaBatch.slice(0, MAX_MEDIA_ALBUM_ITEMS);
      setPendingMediaBatch(null);
      const itemsToUpload = mediaBatch;
      const optimisticUrls = itemsToUpload.map((item) => URL.createObjectURL(item.file));
      const optimisticPayloadText = serializeAlbumContent(
        itemsToUpload.map((item, index) => ({
          src: optimisticUrls[index] ?? item.previewUrl,
          kind: item.kind,
          durationMs: item.kind === "video" ? item.durationMs ?? 0 : undefined,
        })),
        text,
      );
      const optimisticMessageId = pushOptimisticMessage(optimisticPayloadText);
      try {
        const sendingKind =
          mediaBatch.every((item) => item.kind === "image")
            ? "image"
            : mediaBatch.every((item) => item.kind === "video")
              ? "video"
              : "file";
        setSendingRealtimeKind(sendingKind);
        void pushSending(sendingKind, true);
        const uploadedItems: Array<{ src: string; kind: "image" | "video"; durationMs?: number }> = new Array(
          itemsToUpload.length,
        );
        let nextUploadIndex = 0;
        const uploadWorkerCount = Math.min(MEDIA_UPLOAD_CONCURRENCY, itemsToUpload.length);

        await Promise.all(
          Array.from({ length: uploadWorkerCount }, async () => {
            while (true) {
              const currentIndex = nextUploadIndex;
              nextUploadIndex += 1;
              if (currentIndex >= itemsToUpload.length) break;
              const item = itemsToUpload[currentIndex];
              if (item.kind === "video") {
                const uploaded = await uploadChatMediaFile(item.file, "video", item.durationMs ?? 0);
                const optUrl = optimisticUrls[currentIndex] ?? item.previewUrl;
                if (uploaded.url && optUrl) cacheMediaBlobUrl(uploaded.url, optUrl);
                uploadedItems[currentIndex] = {
                  src: uploaded.url,
                  kind: "video",
                  durationMs: item.durationMs ?? 0,
                };
              } else {
                const uploaded = await uploadChatMediaFile(item.file, "image");
                const optUrl = optimisticUrls[currentIndex] ?? item.previewUrl;
                if (uploaded.url && optUrl) cacheMediaBlobUrl(uploaded.url, optUrl);
                uploadedItems[currentIndex] = {
                  src: uploaded.url,
                  kind: "image",
                };
              }
            }
          }),
        );
        const payloadText = serializeAlbumContent(uploadedItems, text);
        await sendPreparedMessage(payloadText, { resetComposer: true, optimisticMessageId });
        return;
      } catch (error) {
        removeOptimisticMessage(optimisticMessageId);
        setPendingMediaBatch(mediaBatch);
        setErrorText(error instanceof Error ? error.message : t("Не удалось отправить медиа"));
        return;
      } finally {
        const sendingKind =
          mediaBatch.every((item) => item.kind === "image")
            ? "image"
            : mediaBatch.every((item) => item.kind === "video")
              ? "video"
              : "file";
        void pushSending(sendingKind, false);
        setSendingRealtimeKind(null);
        setSendingMedia(false);
      }
    }
    if (pendingAudio) {
      setMessageText("");
      setReplyToMessageId(null);
      setStoryReplyTarget(null);
      setSendingMedia(true);
      const audioToUpload = pendingAudio;
      setPendingAudio(null);
      const optimisticUrl = URL.createObjectURL(audioToUpload.file);
      const rawTitle = audioToUpload.name.replace(/\.[^.]+$/u, "").trim();
      const title = audioToUpload.title || rawTitle || t("Музыка");
      const optimisticCoverUrl = audioToUpload.cover ? URL.createObjectURL(audioToUpload.cover) : undefined;
      const metadata = { author: audioToUpload.author, durationMs: audioToUpload.durationMs };
      const optimisticPayloadText = serializeMusicContent(optimisticUrl, title, text, { ...metadata, coverUrl: optimisticCoverUrl });
      const optimisticMessageId = pushOptimisticMessage(optimisticPayloadText);
      try {
        setSendingRealtimeKind("music");
        void pushSending("music", true);
        const [uploaded, uploadedCover] = await Promise.all([
          uploadChatMediaFile(audioToUpload.file, "audio", audioToUpload.durationMs),
          audioToUpload.cover ? uploadChatMediaFile(audioToUpload.cover, "image") : Promise.resolve(null),
        ]);
        const payloadText = serializeMusicContent(uploaded.url, title, text, { ...metadata, coverUrl: uploadedCover?.url });
        await sendPreparedMessage(payloadText, { resetComposer: true, optimisticMessageId });
        return;
      } catch (error) {
        removeOptimisticMessage(optimisticMessageId);
        setPendingAudio(audioToUpload);
        setErrorText(error instanceof Error ? error.message : t("Не удалось отправить музыку"));
        return;
      } finally {
        setTimeout(() => {
          try { URL.revokeObjectURL(optimisticUrl); } catch { }
          if (optimisticCoverUrl) URL.revokeObjectURL(optimisticCoverUrl);
        }, 15000);
        void pushSending("music", false);
        setSendingRealtimeKind(null);
        setSendingMedia(false);
      }
    }
    if (pendingFile) {
      setMessageText("");
      setReplyToMessageId(null);
      setStoryReplyTarget(null);
      setSendingMedia(true);
      const fileToUpload = pendingFile;
      setPendingFile(null);
      const optimisticUrl = URL.createObjectURL(fileToUpload.file);
      const optimisticPayloadText = serializeFileContent(
        optimisticUrl,
        fileToUpload.name,
        fileToUpload.size,
        fileToUpload.mimeType,
        text,
      );
      const optimisticMessageId = pushOptimisticMessage(optimisticPayloadText);
      try {
        setSendingRealtimeKind("file");
        void pushSending("file", true);
        const uploaded = await uploadChatMediaFile(fileToUpload.file, "file");
        const payloadText = serializeFileContent(
          uploaded.url,
          fileToUpload.name,
          fileToUpload.size,
          fileToUpload.mimeType,
          text,
        );
        await sendPreparedMessage(payloadText, { resetComposer: true, optimisticMessageId });
        return;
      } catch (error) {
        removeOptimisticMessage(optimisticMessageId);
        setPendingFile(fileToUpload);
        setErrorText(error instanceof Error ? error.message : t("Не удалось отправить файл"));
        return;
      } finally {
        setTimeout(() => {
          try { URL.revokeObjectURL(optimisticUrl); } catch { }
        }, 15000);
        void pushSending("file", false);
        setSendingRealtimeKind(null);
        setSendingMedia(false);
      }
    }
    if (pendingVideo) {
      setMessageText("");
      setReplyToMessageId(null);
      setStoryReplyTarget(null);
      setSendingMedia(true);
      const videoToUpload = pendingVideo;
      setPendingVideo(null);
      const optimisticUrl = URL.createObjectURL(videoToUpload.file);
      cacheMediaPreviewDetails(optimisticUrl, await makeMediaPreviewDetails(videoToUpload.file, "video"));
      const optimisticPayloadText = serializeVideoContent(optimisticUrl, videoToUpload.durationMs, text, "file");
      const optimisticMessageId = pushOptimisticMessage(optimisticPayloadText);
      try {
        setSendingRealtimeKind("video");
        void pushSending("video", true);
        const uploaded = await uploadChatMediaFile(videoToUpload.file, "video", videoToUpload.durationMs);
        if (uploaded.url && optimisticUrl) cacheMediaBlobUrl(uploaded.url, optimisticUrl);
        const payloadText = serializeVideoContent(uploaded.url, videoToUpload.durationMs, text, "file");
        await sendPreparedMessage(payloadText, { resetComposer: true, optimisticMessageId });
        return;
      } catch (error) {
        removeOptimisticMessage(optimisticMessageId);
        setPendingVideo(videoToUpload);
        setErrorText(error instanceof Error ? error.message : t("Не удалось отправить видео"));
        return;
      } finally {
        void pushSending("video", false);
        setSendingRealtimeKind(null);
        setSendingMedia(false);
      }
    }
    if (pendingImage) {
      setMessageText("");
      setReplyToMessageId(null);
      setStoryReplyTarget(null);
      setSendingMedia(true);
      const imageToUpload = pendingImage;
      setPendingImage(null);
      const optimisticUrl = URL.createObjectURL(imageToUpload.file);
      cacheMediaPreviewDetails(optimisticUrl, await makeMediaPreviewDetails(imageToUpload.file, "image"));
      const optimisticPayloadText = serializeMessageContent(text, optimisticUrl);
      const optimisticMessageId = pushOptimisticMessage(optimisticPayloadText);
      try {
        setSendingRealtimeKind("image");
        void pushSending("image", true);
        const uploaded = await uploadChatMediaFile(imageToUpload.file, "image");
        if (uploaded.url && optimisticUrl) cacheMediaBlobUrl(uploaded.url, optimisticUrl);
        const payloadText = serializeMessageContent(text, uploaded.url);
        await sendPreparedMessage(payloadText, { resetComposer: true, optimisticMessageId });
        return;
      } catch (error) {
        removeOptimisticMessage(optimisticMessageId);
        setPendingImage(imageToUpload);
        setErrorText(error instanceof Error ? error.message : t("Не удалось отправить фото"));
        return;
      } finally {
        void pushSending("image", false);
        setSendingRealtimeKind(null);
        setSendingMedia(false);
      }
    }
    setMessageText("");
    if (!isDesktop) {
      requestAnimationFrame(() => {
        try { messageInputRef.current?.focus({ preventScroll: true }); } catch { }
      });
    }
    const payloadText =
      storyReplyTarget && !replyToMessageId && text.length > 0
        ? serializeStoryReplyContent(text, storyReplyTarget)
        : serializeMessageContent(text, null);
    const optimisticMessageId = pushOptimisticMessage(payloadText);
    await sendPreparedMessage(payloadText, { resetComposer: true, optimisticMessageId });
  } finally {
    sendingMessageInFlightRef.current = false;
  }
}
