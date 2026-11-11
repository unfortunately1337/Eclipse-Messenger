"use client";
import type { MessageDeletionShift } from "./message-deletion-layout";
import { removeFailedMessage } from "@/lib/client/failed-message-store";
import { cancelMessageDissolve } from "@/lib/client/message-dissolve";

import { type ChatSummary, type DecryptedMessage, type ConversationChatType, type ConversationResponse, type EditTarget, type StoryReplyTarget, type ParsedMessageContent } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { apiRequest } from "@/lib/client/http";
import { encryptMessageForUsers, encryptWithSharedKey } from "@/lib/client/e2e";
import { compareMessagesByTime } from "../chat-message-state";
import { canEditMessage, buildEditedMessagePayload } from "./message-content";
import { cacheConversationSnapshot } from "./chat-cache";

export interface DeleteSelectedMessagesActionContext {
  activeChat: ChatSummary | null;
  selectedMessages: DecryptedMessage[];
  selectionDeleting: boolean;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectionDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingSelectionDeleteRef: React.RefObject<{ messageIds: string[]; link: string; chatType: ConversationChatType; previousMessages: DecryptedMessage[]; previousHiddenMessageIds: string[]; mode: "mine" | "everyone"; finalizeTimer?: NodeJS.Timeout | undefined; } | null>;
  finalizePendingSelectionDelete: () => Promise<void>;
  messages: DecryptedMessage[];
  locallyHiddenMessageIds: Set<string>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  syncConversationCacheMessages: (link: string, chatType: ConversationChatType, updater: (messages: DecryptedMessage[]) => DecryptedMessage[]) => void;
  updateLastMessagePreviewAfterDelete: (nextMessages: DecryptedMessage[], link: string) => void;
  clearSelectionMode: () => void;
  animateDeleteMessages: (ids: string[], link: string, chatType: ConversationChatType) => void;
}

export async function deleteSelectedMessagesAction({ activeChat, selectedMessages, selectionDeleting, setMessageHelperId, setSelectionDeleteDialogOpen, pendingSelectionDeleteRef, finalizePendingSelectionDelete, messages, locallyHiddenMessageIds, clearSelectionMode, animateDeleteMessages }: DeleteSelectedMessagesActionContext): Promise<void> {
  if (!activeChat || selectedMessages.length === 0 || selectionDeleting) return;
  setMessageHelperId(null);
  setSelectionDeleteDialogOpen(false);
  if (pendingSelectionDeleteRef.current) {
    if (pendingSelectionDeleteRef.current.finalizeTimer) {
      clearTimeout(pendingSelectionDeleteRef.current.finalizeTimer);
    }
    await finalizePendingSelectionDelete();
  }
  const selectedIds = selectedMessages.map((message) => message.id);
  const previousMessages = messages;
  const previousHiddenMessageIds = [...locallyHiddenMessageIds];
  clearSelectionMode();
  animateDeleteMessages(selectedIds, activeChat.link, activeChat.chatType ?? "direct");
  for (const message of selectedMessages) if (message.sendFailure) void removeFailedMessage(message.id);
  pendingSelectionDeleteRef.current = {
    messageIds: selectedIds,
    link: activeChat.link,
    chatType: activeChat.chatType ?? "direct",
    previousMessages,
    previousHiddenMessageIds,
    mode: "everyone",
  };
  await finalizePendingSelectionDelete();
}

export interface DeleteMessageActionContext {
  activeChat: ChatSummary | null;
  removingMessageIds: Set<string>;
  setErrorText: (message: string | null) => void;
  setMessageHelperId: React.Dispatch<React.SetStateAction<string | null>>;
  messages: DecryptedMessage[];
  animateDeleteMessage: (messageId: string, link: string, chatType?: ConversationChatType) => void;
  clearMessageDeletedTombstone: (messageId: string) => void;
  deleteAnimationTimersRef: React.RefObject<Record<string, NodeJS.Timeout>>;
  setRemovingMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setDeletingShift: React.Dispatch<React.SetStateAction<MessageDeletionShift | null>>;
  syncConversationCacheMessages: (link: string, chatType: ConversationChatType, updater: (messages: DecryptedMessage[]) => DecryptedMessage[]) => void;
  selectedLinkRef: React.RefObject<string | null>;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function deleteMessageAction({ activeChat, removingMessageIds, setErrorText, setMessageHelperId, messages, animateDeleteMessage, clearMessageDeletedTombstone, deleteAnimationTimersRef, setRemovingMessageIds, setDeletingShift, syncConversationCacheMessages, selectedLinkRef, activeConversationRef, setMessages, t }: DeleteMessageActionContext, messageId: string): Promise<void> {
  if (!activeChat || removingMessageIds.has(messageId)) return;
  setErrorText(null);
  setMessageHelperId(null);
  const link = activeChat.link;
  const chatType = activeChat.chatType ?? "direct";
  const deletedMessage = messages.find(message => message.id === messageId);
  if (deletedMessage?.sendFailure) void removeFailedMessage(messageId);
  animateDeleteMessage(messageId, link, chatType);

  if (!messageId.startsWith("optimistic:") && !deletedMessage?.sendFailure) {
    void apiRequest(`/api/chats/${encodeURIComponent(link)}?chatType=${chatType}`, {
      method: "DELETE",
      body: JSON.stringify({ messageId }),
    }).catch((error) => {
      clearMessageDeletedTombstone(messageId);
      cancelMessageDissolve(messageId);
      const timer = deleteAnimationTimersRef.current[messageId];
      if (timer) { clearTimeout(timer); delete deleteAnimationTimersRef.current[messageId]; }
      setRemovingMessageIds(previous => { const next = new Set(previous); next.delete(messageId); return next; });
      setDeletingShift(null);
      if (deletedMessage) {
        const restore = (items: DecryptedMessage[]) => items.some(message => message.id === messageId) ? items : [...items, deletedMessage].sort(compareMessagesByTime);
        syncConversationCacheMessages(link, chatType, restore);
        if (selectedLinkRef.current === link && activeConversationRef.current?.chatType === chatType) setMessages(restore);
      }
      setErrorText(error instanceof Error ? error.message : t("Ошибка удаления сообщения"));
    });
  }
}

export interface BuildEditTargetActionContext {
  selfId: string | null;
}

export function buildEditTargetAction({ selfId }: BuildEditTargetActionContext, message: DecryptedMessage, parsed: ParsedMessageContent): EditTarget | null {
  if (!canEditMessage(message, parsed, message.senderId === selfId)) {
    return null;
  }
  if (parsed.kind === "text") {
    return { id: message.id, kind: "text" };
  }
  if (parsed.kind === "image") {
    return { id: message.id, kind: "image", src: parsed.src };
  }
  if (parsed.kind === "video") {
    return { id: message.id, kind: "video", src: parsed.src, durationMs: parsed.durationMs, mode: parsed.mode };
  }
  if (parsed.kind === "music") {
    return { id: message.id, kind: "music", url: parsed.url, title: parsed.title, author: parsed.author, coverUrl: parsed.coverUrl, durationMs: parsed.durationMs };
  }
  if (parsed.kind === "file") {
    return {
      id: message.id,
      kind: "file",
      src: parsed.src,
      name: parsed.name,
      size: parsed.size,
      mimeType: parsed.mimeType,
    };
  }
  return null;
}

export interface SaveEditedMessageActionContext {
  editTarget: EditTarget | null;
  activeChat: ChatSummary | null;
  activeConversation: ConversationResponse | null;
  sending: boolean;
  sendingMedia: boolean;
  editSaving: boolean;
  messageText: string;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  messages: DecryptedMessage[];
  cancelEditMode: () => void;
  chats: ChatSummary[];
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  updateLastMessagePreviewAfterEdit: (link: string, editedMessage: DecryptedMessage, editedText: string) => void;
  setEditSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setSending: React.Dispatch<React.SetStateAction<boolean>>;
  setEditTarget: React.Dispatch<React.SetStateAction<EditTarget | null>>;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setStoryReplyTarget: React.Dispatch<React.SetStateAction<StoryReplyTarget | null>>;
  ensureOwnE2EReady: (options?: { allowPrompt?: boolean | undefined; } | undefined) => Promise<{ privateKey: CryptoKey; publicKeyBase64: string; privateKeyBase64: string | null; }>;
  peerPublicKeyByLinkRef: React.RefObject<Record<string, string>>;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
  ensureSharedKeyFromServer: (chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{ version: number; keyBase64: string; createdAt: number; } | null>;
  selfId: string | null;
  editPrefillTargetIdRef: React.RefObject<string | null>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
}

export async function saveEditedMessageAction({ editTarget, activeChat, activeConversation, sending, sendingMedia, editSaving, messageText, setErrorText, t, messages, cancelEditMode, chats, setMessages, updateLastMessagePreviewAfterEdit, setEditSaving, setSending, setEditTarget, setMessageText, setReplyToMessageId, setStoryReplyTarget, ensureOwnE2EReady, peerPublicKeyByLinkRef, buildSharedChatKeyId, ensureSharedKeyFromServer, selfId, editPrefillTargetIdRef, setChats }: SaveEditedMessageActionContext): Promise<void> {
  if (!editTarget || !activeChat || !activeConversation) return;
  if (sending || sendingMedia || editSaving) return;
  const draft = messageText;
  if (editTarget.kind === "text" && !draft.trim()) {
    setErrorText(t("Сообщение не может быть пустым"));
    return;
  }
  const targetMessage = messages.find((item) => item.id === editTarget.id) ?? null;
  if (!targetMessage) {
    cancelEditMode();
    return;
  }

  const payloadText = buildEditedMessagePayload(editTarget, draft);
  const link = activeChat.link;
  const prevMessages = messages;
  const prevChatSnapshot = chats;
  const nextMessages = prevMessages.map((item) =>
    item.id === editTarget.id
      ? { ...item, text: payloadText }
      : item,
  );

  setMessages(nextMessages);
  updateLastMessagePreviewAfterEdit(link, { ...targetMessage, text: payloadText }, payloadText);

  setEditSaving(true);
  setSending(true);
  setErrorText(null);
  try {
    if (activeConversation.chatType === "direct" && activeConversation.peer?.isBot && !link.startsWith("secret-")) {
      await apiRequest(`/api/bots/${encodeURIComponent(link)}/messages`, { method: "PATCH", body: JSON.stringify({ messageId: editTarget.id, text: payloadText, requestId: crypto.randomUUID() }) });
      setEditTarget(null); setMessageText("");
      setReplyToMessageId(null); setStoryReplyTarget(null);
      return;
    }
    if (activeConversation.chatType === "direct" || activeConversation.chatType === "saved") {
      const ownKeys = await ensureOwnE2EReady();
      const isSavedDialog = activeConversation.chatType === "saved";
      let recipientPublicKey = isSavedDialog ? ownKeys.publicKeyBase64 : activeConversation.peer?.publicKey ?? null;
      if (recipientPublicKey?.startsWith("encdet:v1:")) {
        recipientPublicKey = null;
      }
      if (!isSavedDialog && activeConversation.peer?.link) {
        const peerLink = activeConversation.peer.link;
        recipientPublicKey = recipientPublicKey ?? peerPublicKeyByLinkRef.current[peerLink] ?? null;
        if (recipientPublicKey?.startsWith("encdet:v1:")) {
          recipientPublicKey = null;
        }
        if (!recipientPublicKey) {
          const keyState = await apiRequest<{ publicKey: string | null }>(
            `/api/settings/e2e-key/${encodeURIComponent(peerLink)}`,
            { method: "GET" },
          );
          if (keyState.publicKey && !keyState.publicKey.startsWith("encdet:v1:")) {
            recipientPublicKey = keyState.publicKey;
            peerPublicKeyByLinkRef.current[peerLink] = keyState.publicKey;
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
      });

      await apiRequest(`/api/chats/${encodeURIComponent(link)}?chatType=${isSavedDialog ? "saved" : "direct"}`, {
        method: "PATCH",
        body: JSON.stringify({
          messageId: editTarget.id,
          ...body,
        }),
      });
    } else if (activeConversation.chatType === "group") {
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
      if (!keyEntry) {
        throw new Error(t("Нет ключа группы для редактирования"));
      }
      const encrypted = await encryptWithSharedKey({
        plainText: payloadText,
        keyBase64: keyEntry.keyBase64,
      });
      await apiRequest(`/api/chats/${encodeURIComponent(link)}?chatType=group`, {
        method: "PATCH",
        body: JSON.stringify({
          messageId: editTarget.id,
          cipherText: encrypted.cipherText,
          iv: encrypted.iv,
          keyVersion: keyEntry.version,
        }),
      });
    } else if (activeConversation.chatType === "channel") {
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
      if (!keyEntry) {
        throw new Error(t("Нет ключа канала для редактирования"));
      }
      const encrypted = await encryptWithSharedKey({
        plainText: payloadText,
        keyBase64: keyEntry.keyBase64,
      });
      await apiRequest(`/api/chats/${encodeURIComponent(link)}?chatType=channel`, {
        method: "PATCH",
        body: JSON.stringify({
          messageId: editTarget.id,
          cipherText: encrypted.cipherText,
          iv: encrypted.iv,
          keyVersion: keyEntry.version,
        }),
      });
    }

    cacheConversationSnapshot(selfId, link, {
      savedAt: Date.now(),
      conversation: activeConversation,
      messages: nextMessages,
    });
    editPrefillTargetIdRef.current = null;
    setEditTarget(null);
    setReplyToMessageId(null);
    setStoryReplyTarget(null);
    setMessageText("");
  } catch (error) {
    setMessages(prevMessages);
    setChats(prevChatSnapshot);
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  } finally {
    setSending(false);
    setEditSaving(false);
  }
}
