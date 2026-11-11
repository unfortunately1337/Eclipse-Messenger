"use client";

import { useCallback, useEffect, useMemo } from "react";

import { apiRequest } from "@/lib/client/http";

import { MUSIC_SHARE_EVENT, takePendingMusicShare } from "@/lib/client/music-share";
import { type ForwardRecipient } from "../../components/common/ForwardRecipientPicker";

import { type ConversationChatType, type DecryptedMessage } from "../../types";

import { serializeMusicContent } from "../../chat-message-transport";

import { parseMessageContent, getEditableTextFromParsed } from "../message-content";

import { updateLastMessagePreviewAfterDeleteAction, syncConversationCacheMessagesAction, animateDeleteMessageAction, finalizePendingSelectionDeleteAction } from "../recording-actions";
import { cancelMessageDissolve } from "@/lib/client/message-dissolve";
import { deleteSelectedMessagesAction } from "../message-actions";
import { mergeMessageWindow } from "../../chat-message-state";

import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatDirectoryModel } from "./useChatDirectory";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ConversationActionsSources {
  page: Pick<ChatPageStateModel, "setErrorText" | "t" | "hideChatActionPanel" | "setLocallyHiddenMessageIds" | "locallyHiddenMessageIds"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "setChats" | "activeConversationRef" | "messages" | "setActiveConversation" | "setMessages" | "chats" | "setAttachmentMenuOpen">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "selectedLinkRef" | "messageText" | "setMessageText">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "setRemovingMessageIds" | "setDeletingShift" | "setDeletingMessageId" | "setSelectionDeleting" | "setSelectionMode" | "setSelectedMessageIds" | "setSelectionDeleteDialogOpen" | "setForwardPickerMode" | "setForwardPickerMessages" | "forwardDraft" | "setForwardDraft" | "selectionDeleting">;
    panels: Pick<ChatPageStateModel["panels"], "pendingDeleteRef" | "pendingSelectionDeleteRef" | "isDesktop">;
    appearance: Pick<ChatPageStateModel["appearance"], "setMessageHelperId">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "contactsForAdd">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "editTarget" | "replyToMessageId" | "setSwipeMessageId" | "setSwipeOffsetX" | "swipeOffsetX" | "setReplyToMessageId">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyReplyTarget" | "setStoryReplyTarget">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "setStickerPickerOpen">;

  };
  bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache" | "loadChatPage">;
  elements: Pick<ChatElementStateModel, "sanitizeMessages" | "markMessageDeletedTombstone" | "clearMessageDeletedTombstone"> & {
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "messageHeightsRef">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "deleteAnimationTimersRef" | "editPrefillTargetIdRef" | "messageSwipeStartRef">;

  };
  directory: Pick<ChatDirectoryModel, "messageOffsets" | "messageSizes">;
  callbacks: Pick<ChatPageCallbacks, "ensureCreateChatContacts">;
  active: Pick<ActiveConversationModel, "activeChat">;
  presentation: Pick<ConversationPresentationModel, "selectedMessages">;
}

export interface ConversationActionsModel {
  updateLastMessagePreviewAfterEdit: (link: string, editedMessage: import("@/app/app/(chats)/types").DecryptedMessage, editedText: string) => void;
  syncConversationCacheMessages: (link: string, chatType: import("@/app/app/(chats)/types").ConversationChatType, updater: (messages: import("@/app/app/(chats)/types").DecryptedMessage[]) => import("@/app/app/(chats)/types").DecryptedMessage[]) => void;
  animateDeleteMessage: (messageId: string, link: string, chatType?: import("@/app/app/(chats)/types").ConversationChatType) => void;
  clearSelectionMode: () => void;
  toggleMessageSelection: (messageId: string) => void;
  forwardRecipients: import("@/app/app/(chats)/components/common/ForwardRecipientPicker").ForwardRecipient[];
  beginSelectionMode: (messageId: string) => void;
  deleteSelectedMessages: () => Promise<void>;
  beginMessageSwipe: (event: React.TouchEvent<HTMLDivElement>, message: import("@/app/app/(chats)/types").DecryptedMessage, isMine: boolean) => void;
  moveMessageSwipe: (event: React.TouchEvent<HTMLDivElement>) => void;
  endMessageSwipe: (message: import("@/app/app/(chats)/types").DecryptedMessage) => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useConversationActions(sources: ConversationActionsSources): ConversationActionsModel {
  const { setErrorText, t, hideChatActionPanel, setLocallyHiddenMessageIds, locallyHiddenMessageIds } = sources.page;
  const { setChats, activeConversationRef, messages, setActiveConversation, setMessages, chats } = sources.page.conversation;
  const { setAttachmentMenuOpen } = sources.page.conversation;
  const { setStickerPickerOpen } = sources.page.attachmentDraft;
  const { selfId, selfProfile } = sources.page.account;
  const { selectedLink, selectedLinkRef, messageText, setMessageText } = sources.page.selection;
  const { setRemovingMessageIds, setDeletingShift, setDeletingMessageId, setSelectionDeleting, setSelectionMode, setSelectedMessageIds, setSelectionDeleteDialogOpen, setForwardPickerMode, setForwardPickerMessages, forwardDraft, setForwardDraft, selectionDeleting } = sources.page.messageInteraction;
  const { pendingDeleteRef, pendingSelectionDeleteRef, isDesktop } = sources.page.panels;
  const { setMessageHelperId } = sources.page.appearance;
  const { contactsForAdd } = sources.page.mediaAndChannel;
  const { editTarget, replyToMessageId, setSwipeMessageId, setSwipeOffsetX, swipeOffsetX, setReplyToMessageId } = sources.page.composerInteraction;
  const { storyReplyTarget, setStoryReplyTarget } = sources.page.storyDraft;
  const { readProfileFromCache, loadChatPage } = sources.bootstrap;
  const { sanitizeMessages, markMessageDeletedTombstone, clearMessageDeletedTombstone } = sources.elements;
  const { messageHeightsRef } = sources.elements.messageDelivery;
  const { deleteAnimationTimersRef, editPrefillTargetIdRef, messageSwipeStartRef } = sources.elements.conversationElement;
  const { messageOffsets, messageSizes } = sources.directory;
  const { ensureCreateChatContacts } = sources.callbacks;
  const { activeChat } = sources.active;
  const { selectedMessages } = sources.presentation;

  const updateLastMessagePreviewAfterDelete = useCallback(
    (nextMessages: DecryptedMessage[], link: string) => {
      return updateLastMessagePreviewAfterDeleteAction({ setChats, readProfileFromCache, selfId }, nextMessages, link);
    },
    [readProfileFromCache, selfId],
  );

  const updateLastMessagePreviewAfterEdit = useCallback(
    (link: string, editedMessage: DecryptedMessage, editedText: string) => {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.link !== link) return chat;
          if (chat.lastMessageAt !== editedMessage.createdAt) return chat;
          const previewBase = editedText;
          if (chat.chatType === "group" && editedMessage.senderId !== selfId) {
            const senderProfile = readProfileFromCache(editedMessage.senderId);
            const senderName = editedMessage.senderDisplayName || senderProfile?.displayName || "";
            return { ...chat, lastMessage: senderName ? `${senderName}: ${previewBase}` : previewBase };
          }
          return { ...chat, lastMessage: previewBase };
        }),
      );
    },
    [readProfileFromCache, selfId],
  );

  const syncConversationCacheMessages = useCallback(
    (
      link: string,
      chatType: ConversationChatType,
      updater: (messages: DecryptedMessage[]) => DecryptedMessage[],
    ) => {
      return syncConversationCacheMessagesAction({ selfId, selectedLink, activeConversationRef, messages, sanitizeMessages, setActiveConversation }, link, chatType, updater);
    },
    [messages, sanitizeMessages, selectedLink, selfId],
  );

  const animateDeleteMessage = useCallback(
    (messageId: string | string[], link: string, chatType: ConversationChatType = "direct") => {
      return animateDeleteMessageAction({ markMessageDeletedTombstone, syncConversationCacheMessages, selectedLinkRef, activeConversationRef, setRemovingMessageIds, messages, messageOffsets, messageHeightsRef, messageSizes, setDeletingShift, deleteAnimationTimersRef, setMessages, sanitizeMessages, updateLastMessagePreviewAfterDelete }, messageId, link, chatType);
    },
    [markMessageDeletedTombstone, messageOffsets, messageSizes, messages, sanitizeMessages, syncConversationCacheMessages, updateLastMessagePreviewAfterDelete],
  );

  const rollbackPendingDelete = useCallback((pending: NonNullable<typeof pendingDeleteRef.current>) => {
    cancelMessageDissolve(pending.messageId);
    const timer = deleteAnimationTimersRef.current[pending.messageId];
    if (timer) {
      clearTimeout(timer);
      delete deleteAnimationTimersRef.current[pending.messageId];
    }
    setDeletingShift(null);
    clearMessageDeletedTombstone(pending.messageId);
    setRemovingMessageIds((prev) => {
      const next = new Set(prev);
      next.delete(pending.messageId);
      return next;
    });
    setMessages(pending.previousMessages);
    syncConversationCacheMessages(pending.link, pending.chatType, () => pending.previousMessages);
    updateLastMessagePreviewAfterDelete(pending.previousMessages, pending.link);
  }, [clearMessageDeletedTombstone, syncConversationCacheMessages, updateLastMessagePreviewAfterDelete]);

  const finalizePendingDelete = useCallback(async () => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    pendingDeleteRef.current = null;
    if (pending.messageId.startsWith("optimistic:") || pending.messageId.startsWith("msg:")) {
      return;
    }
    setDeletingMessageId(pending.messageId);
    try {
      await apiRequest(`/api/chats/${encodeURIComponent(pending.link)}?chatType=${pending.chatType}`, {
        method: "DELETE",
        body: JSON.stringify({ messageId: pending.messageId }),
      });
    } catch (error) {
      rollbackPendingDelete(pending);
      setErrorText(error instanceof Error ? error.message : t("Ошибка удаления сообщения"));
    } finally {
      setDeletingMessageId(null);
    }
  }, [rollbackPendingDelete, setErrorText, t]);

  const undoPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.finalizeTimer);
    pendingDeleteRef.current = null;
    rollbackPendingDelete(pending);
    hideChatActionPanel();
  }, [hideChatActionPanel, rollbackPendingDelete]);

  const rollbackPendingSelectionDelete = useCallback((pending: NonNullable<typeof pendingSelectionDeleteRef.current>) => {
    pending.messageIds.forEach((messageId) => {
      const timer = deleteAnimationTimersRef.current[messageId];
      if (timer) {
        delete deleteAnimationTimersRef.current[messageId];
        if (!Object.values(deleteAnimationTimersRef.current).includes(timer)) clearTimeout(timer);
      }
      cancelMessageDissolve(messageId);
      clearMessageDeletedTombstone(messageId);
    });
    setDeletingShift(previous => {
      const rows = previous?.rows?.filter(row => !pending.messageIds.includes(row.id));
      return rows?.length ? { afterIndex: rows[0].index, shiftY: rows.reduce((sum, row) => sum + row.height, 0), rows } : null;
    });
    setRemovingMessageIds((prev) => {
      const next = new Set(prev);
      pending.messageIds.forEach((messageId) => next.delete(messageId));
      return next;
    });
    const restored = pending.previousMessages.filter(message => pending.messageIds.includes(message.id));
    setMessages(current => sanitizeMessages(mergeMessageWindow(current, restored)));
    setLocallyHiddenMessageIds(new Set(pending.previousHiddenMessageIds));
    syncConversationCacheMessages(pending.link, pending.chatType, current => mergeMessageWindow(current, restored));
    updateLastMessagePreviewAfterDelete(pending.previousMessages, pending.link);
  }, [clearMessageDeletedTombstone, syncConversationCacheMessages, updateLastMessagePreviewAfterDelete]);

  const finalizePendingSelectionDelete = useCallback(async () => {
    return finalizePendingSelectionDeleteAction({ pendingSelectionDeleteRef, setSelectionDeleting, rollbackPendingSelectionDelete, setErrorText, t });
  }, [rollbackPendingSelectionDelete, setErrorText, t]);

  const undoPendingSelectionDelete = useCallback(() => {
    const pending = pendingSelectionDeleteRef.current;
    if (!pending) return;
    if (pending.finalizeTimer) {
      clearTimeout(pending.finalizeTimer);
    }
    pendingSelectionDeleteRef.current = null;
    rollbackPendingSelectionDelete(pending);
    hideChatActionPanel();
  }, [hideChatActionPanel, rollbackPendingSelectionDelete]);

  const clearSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
    setSelectionDeleteDialogOpen(false);
  }, []);

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      if (prev.includes(messageId)) {
        const next = prev.filter((id) => id !== messageId);
        if (next.length === 0) {
          setSelectionMode(false);
        }
        return next;
      }
      return [...prev, messageId];
    });
  }, []);

  useEffect(() => {
    if (!selfId) return;
    const share = () => {
      const track = takePendingMusicShare();
      if (!track?.url) return;
      setForwardPickerMode("share");
      setForwardPickerMessages([{
        requestId: crypto.randomUUID(),
        content: serializeMusicContent(track.url, track.title, "", track),
        author: { id: selfId, name: selfProfile?.displayName || t("Вы") }
      }]);
      setMessageHelperId(null);
      void loadChatPage(null, "replace");
      void ensureCreateChatContacts(true);
    };
    window.addEventListener(MUSIC_SHARE_EVENT, share);
    share();
    return () => window.removeEventListener(MUSIC_SHARE_EVENT, share);
  }, [selfId, selfProfile?.displayName, loadChatPage, ensureCreateChatContacts, t]);

  const forwardRecipients = useMemo(() => {
    const saved = chats.find(chat => chat.chatType === "saved");
    const result: ForwardRecipient[] = [{ id: selfId || "saved", link: saved?.link || selfProfile?.link || "", name: t("Избранное"), chatType: "saved" }];
    const seen = new Set<string>();
    for (const chat of chats) {
      if (chat.link.startsWith("secret-") || chat.isBot || chat.peerId === selfId) continue;
      if (chat.chatType === "group" || chat.chatType === "channel") {
        if (chat.canSendMessages === true) {
          result.push({ id: chat.peerId, link: chat.link, name: chat.displayName, avatarUrl: chat.avatarUrl, chatType: chat.chatType });
        }
        continue;
      }
      if ((chat.chatType ?? "direct") !== "direct") continue;
      seen.add(chat.peerId);
      const contact = contactsForAdd.find(contact => contact.id === chat.peerId);
      result.push({ id: chat.peerId, link: chat.link, name: contact?.alias || chat.displayName, avatarUrl: chat.avatarUrl, chatType: "direct" });
    }
    for (const contact of contactsForAdd) if (!seen.has(contact.id) && contact.id !== selfId) result.push({ id: contact.id, link: contact.link, name: contact.alias || contact.displayName || contact.link, avatarUrl: contact.avatarUrl, chatType: "direct" });
    return result.filter(recipient => recipient.link);
  }, [chats, contactsForAdd, selfId, selfProfile?.link, t]);

  useEffect(() => {
    if (forwardDraft && (selectedLink !== forwardDraft.link || editTarget || replyToMessageId || storyReplyTarget)) setForwardDraft(null);
  }, [selectedLink, forwardDraft, editTarget, replyToMessageId, storyReplyTarget]);

  const beginSelectionMode = useCallback((messageId: string) => {
    setStickerPickerOpen(false);
    setAttachmentMenuOpen(false);
    setMessageHelperId(null);
    setSelectionMode(true);
    setSelectedMessageIds((prev) => (prev.includes(messageId) ? prev : [messageId]));
  }, []);

  const deleteSelectedMessages = useCallback(async () => {
    return deleteSelectedMessagesAction({ activeChat, selectedMessages, selectionDeleting, setMessageHelperId, setSelectionDeleteDialogOpen, pendingSelectionDeleteRef, finalizePendingSelectionDelete, messages, locallyHiddenMessageIds, sanitizeMessages, setMessages, syncConversationCacheMessages, updateLastMessagePreviewAfterDelete, clearSelectionMode, animateDeleteMessages: animateDeleteMessage });
  }, [
    activeChat,
    clearSelectionMode,
    finalizePendingSelectionDelete,
    locallyHiddenMessageIds,
    messages,
    sanitizeMessages,
    selectedMessages,
    selectionDeleting,
    setErrorText,
    syncConversationCacheMessages,
    updateLastMessagePreviewAfterDelete,
  ]);

  useEffect(() => {
    if (!editTarget) {
      editPrefillTargetIdRef.current = null;
      return;
    }
    if (editPrefillTargetIdRef.current !== editTarget.id) return;
    if (messageText.length > 0) {
      editPrefillTargetIdRef.current = null;
      return;
    }
    const targetMessage = messages.find((item) => item.id === editTarget.id);
    if (!targetMessage) return;
    const parsed = parseMessageContent(targetMessage.text);
    const nextText = getEditableTextFromParsed(parsed);
    editPrefillTargetIdRef.current = null;
    if (!nextText) return;
    setMessageText(nextText);
  }, [editTarget, messageText, messages]);

  const beginMessageSwipe = useCallback((event: React.TouchEvent<HTMLDivElement>, message: DecryptedMessage, isMine: boolean) => {
    if (isDesktop) return;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    messageSwipeStartRef.current = { id: message.id, x: touch.clientX, y: touch.clientY, isMine };
    setSwipeMessageId(message.id);
    setSwipeOffsetX(0);
  }, [isDesktop]);

  const moveMessageSwipe = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = messageSwipeStartRef.current;
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) {
      setSwipeOffsetX(0);
      return;
    }
    if (start.isMine) {
      setSwipeOffsetX(Math.max(0, Math.min(84, dx)));
      return;
    }
    setSwipeOffsetX(Math.min(0, Math.max(-84, dx)));
  }, []);

  const endMessageSwipe = useCallback((message: DecryptedMessage) => {
    const start = messageSwipeStartRef.current;
    if (!start || start.id !== message.id) {
      setSwipeMessageId(null);
      setSwipeOffsetX(0);
      return;
    }
    const threshold = 56;
    const offset = swipeOffsetX;
    if ((start.isMine && offset >= threshold) || (!start.isMine && offset <= -threshold)) {
      setStoryReplyTarget(null);
      setReplyToMessageId(message.id);
      setMessageHelperId(null);
    }
    messageSwipeStartRef.current = null;
    setSwipeMessageId(null);
    setSwipeOffsetX(0);
  }, [swipeOffsetX]);

  return {
    updateLastMessagePreviewAfterEdit,
    syncConversationCacheMessages,
    animateDeleteMessage,
    clearSelectionMode,
    toggleMessageSelection,
    forwardRecipients,
    beginSelectionMode,
    deleteSelectedMessages,
    beginMessageSwipe,
    moveMessageSwipe,
    endMessageSwipe
  };
}
