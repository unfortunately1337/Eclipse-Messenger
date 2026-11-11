"use client";

import { type ChangeEvent } from "react";

import { apiRequest } from "@/lib/client/http";

import { showAppToast, appToast as toast } from "@/lib/client/app-toast";

import { type ForwardRecipient } from "../../components/common/ForwardRecipientPicker";
import { readForwardedContent, type ForwardAuthor } from "@/lib/client/message-forwarding";

import { writeEmojiClipboard } from "@/lib/client/emoji-clipboard";

import { getStickerEmojiBySrc } from "@/lib/client/stickers";

import { type ConversationChatType, type DecryptedMessage, type EditTarget, type ParsedMessageContent } from "../../types";

import { serializePollContent, serializeStickerContent } from "../../chat-message-transport";

import { parseMessageContent, getEditableTextFromParsed } from "../message-content";

import { sendReadReceiptAction } from "../chat-bootstrap";

import { processPickedFilesAction } from "../attachment-actions";

import { sendMessageAction } from "../send-message";

import { deleteMessageAction, buildEditTargetAction, saveEditedMessageAction } from "../message-actions";

import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ComposerCaptureModel } from "../controllers/useComposerCapture";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ConversationActionsModel } from "../controllers/useConversationActions";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface MessageCallbackSources {
  readonly elements: Pick<ChatElementStateModel, "clearMessageDeletedTombstone"> & {
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "readReceiptEndpointUnsupportedRef" | "sentReadReceiptIdsRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "openConversationRef">;
    mediaRecorder: Pick<ChatElementStateModel["mediaRecorder"], "setSendingRealtimeKind">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "messageInputRef">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "deleteAnimationTimersRef" | "draftBeforeEditRef" | "editPrefillTargetIdRef" | "peerPublicKeyByLinkRef">;

  };
  readonly page: Pick<ChatPageStateModel, "setErrorText" | "t" | "beginMessageSend" | "endMessageSend" | "router" | "showChatActionPanel"> & {
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "pendingMediaBatch" | "pendingImage" | "pendingVideo" | "setPendingMediaBatch" | "setPendingImage" | "setPendingVideo" | "setPendingAudio" | "setPendingFile" | "pendingAudio" | "pendingFile" | "setStickerPickerOpen">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "pickedFilesProcessingRef">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "selectedLinkRef" | "messageText" | "setMessageText" | "selectedSearchTargetRef" | "setSelectedLink">;
    conversation: Pick<ChatPageStateModel["conversation"], "startingBot" | "botStartRequestRef" | "setStartingBot" | "activeConversation" | "chats" | "messages" | "activeConversationRef" | "setMessages" | "setChats">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "sendingMessageInFlightRef" | "sending" | "sendingMedia" | "setSendingMedia" | "setSending">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "forwardDraft" | "forwardSending" | "setForwardSending" | "setForwardDraft" | "setForwardPickerMode" | "setForwardPickerMessages" | "forwardPickerMessages" | "forwardPickerMode" | "removingMessageIds" | "setRemovingMessageIds" | "setDeletingShift">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "editTarget" | "setReplyToMessageId" | "replyToMessageId" | "setEditTarget" | "editSaving" | "setEditSaving">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryReplyTarget" | "storyReplyTarget">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    appearance: Pick<ChatPageStateModel["appearance"], "setMessageHelperId">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "contactsForAdd">;
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "voiceRecording" | "videoRecording">;

  };
  readonly presentation: Pick<ConversationPresentationModel, "isManagedBotConversation" | "isEclipseConversation" | "eclipseBots" | "activeTitle" | "groupMembersById">;
  readonly active: Pick<ActiveConversationModel, "activeChat">;
  readonly callbacks: Pick<ChatPageCallbacks, "uploadChatMediaFile" | "openChannelModal" | "openProfileModal" | "ensureCreateChatContacts">;
  readonly capture: Pick<ComposerCaptureModel, "pushOptimisticMessage" | "sendPreparedMessage" | "pushSending" | "removeOptimisticMessage">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache" | "loadChatPage">;
  readonly messageActions: Pick<ConversationActionsModel, "clearSelectionMode" | "animateDeleteMessage" | "syncConversationCacheMessages" | "updateLastMessagePreviewAfterEdit">;
  readonly history: Pick<MessageHistoryModel, "ensureOwnE2EReady" | "buildSharedChatKeyId" | "ensureSharedKeyFromServer">;
}

/** Creates render-snapshot callbacks without reading models during construction. */
export function createMessageCallbacks(sources: MessageCallbackSources): Pick<ChatPageCallbacks, "sendReadReceipt" | "processPickedFiles" | "onPickMedia" | "startActiveBot" | "sendMessage" | "sendWelcomeSticker" | "sendStickerFromPicker" | "sendPollMessage" | "openForwardAuthorProfile" | "beginForwardMessages" | "chooseForwardRecipient" | "deleteMessage" | "buildEditTarget" | "beginEditMessage" | "cancelEditMode" | "isEditDraftValid" | "saveEditedMessage" | "copyMessageText"> {
  async function sendReadReceipt(
    link: string,
    chatType: ConversationChatType,
    messageIds: string[],
  ): ReturnType<ChatPageCallbacks["sendReadReceipt"]> {
    const { readReceiptEndpointUnsupportedRef, sentReadReceiptIdsRef } = sources.elements.messageDelivery;

    return sendReadReceiptAction({ readReceiptEndpointUnsupportedRef, sentReadReceiptIdsRef }, link, chatType, messageIds);
  }

  async function processPickedFiles(files: File[]): ReturnType<ChatPageCallbacks["processPickedFiles"]> {
    const { setErrorText, t } = sources.page;
    const { pendingMediaBatch, pendingImage, pendingVideo, setPendingMediaBatch, setPendingImage, setPendingVideo, setPendingAudio, setPendingFile } = sources.page.attachmentDraft;

    return processPickedFilesAction({ pendingMediaBatch, setErrorText, t, pendingImage, pendingVideo, setPendingMediaBatch, setPendingImage, setPendingVideo, setPendingAudio, setPendingFile }, files);
  }

  async function onPickMedia(event: ChangeEvent<HTMLInputElement>): ReturnType<ChatPageCallbacks["onPickMedia"]> {
    const { pickedFilesProcessingRef } = sources.page.wallpaperUpload;

    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (pickedFilesProcessingRef.current) return;
    pickedFilesProcessingRef.current = true;
    try { await processPickedFiles(files); }
    finally { pickedFilesProcessingRef.current = false; }
  }

  async function startActiveBot(): ReturnType<ChatPageCallbacks["startActiveBot"]> {
    const { t } = sources.page;
    const { selectedLink, selectedLinkRef } = sources.page.selection;
    const { startingBot, botStartRequestRef, setStartingBot } = sources.page.conversation;
    const { isManagedBotConversation } = sources.presentation;
    const { openConversationRef } = sources.elements.conversationRequest;

    if (!selectedLink || !isManagedBotConversation || startingBot) return false;
    const link = selectedLink;
    const request = botStartRequestRef.current?.link === link ? botStartRequestRef.current : { link, requestId: crypto.randomUUID() };
    botStartRequestRef.current = request;
    setStartingBot(true);
    try {
      await apiRequest(`/api/bots/${encodeURIComponent(link)}/start`, { method: "POST", body: JSON.stringify({ requestId: request.requestId }) });
      botStartRequestRef.current = null;
      if (selectedLinkRef.current === link) await openConversationRef.current(link, { chatType: "direct", force: true });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Не удалось запустить бота."));
      return false;
    } finally { setStartingBot(false); }
  }

  async function sendMessage(): ReturnType<ChatPageCallbacks["sendMessage"]> {
    const { t, setErrorText, beginMessageSend, endMessageSend } = sources.page;
    const { sendingMessageInFlightRef, sending, sendingMedia, setSendingMedia } = sources.page.conversationRequest;
    const { forwardDraft, forwardSending, setForwardSending, setForwardDraft } = sources.page.messageInteraction;
    const { selectedLink, selectedLinkRef, messageText, setMessageText } = sources.page.selection;
    const { activeConversation } = sources.page.conversation;
    const { editTarget, setReplyToMessageId, replyToMessageId } = sources.page.composerInteraction;
    const { pendingImage, pendingMediaBatch, pendingVideo, pendingAudio, pendingFile, setPendingImage, setPendingMediaBatch, setPendingAudio, setPendingFile, setPendingVideo } = sources.page.attachmentDraft;
    const { setStoryReplyTarget, storyReplyTarget } = sources.page.storyDraft;
    const { isDesktop } = sources.page.panels;
    const { activeChat } = sources.active;
    const { uploadChatMediaFile } = sources.callbacks;
    const { pushOptimisticMessage, sendPreparedMessage, pushSending, removeOptimisticMessage } = sources.capture;
    const { isManagedBotConversation, isEclipseConversation, eclipseBots } = sources.presentation;
    const { setSendingRealtimeKind } = sources.elements.mediaRecorder;
    const { messageInputRef } = sources.elements.storyAndViewport;

    return sendMessageAction({ sendingMessageInFlightRef, sending, sendingMedia, forwardDraft, forwardSending, selectedLink, activeChat, activeConversation, setForwardSending, selectedLinkRef, t, uploadChatMediaFile, pushOptimisticMessage, sendPreparedMessage, setForwardDraft, messageText, setErrorText, editTarget, saveEditedMessage, isManagedBotConversation, startActiveBot, setMessageText, isEclipseConversation, eclipseBots, pendingImage, pendingMediaBatch, pendingVideo, pendingAudio, pendingFile, beginMessageSend, setPendingImage, setPendingMediaBatch, setReplyToMessageId, setStoryReplyTarget, endMessageSend, setSendingMedia, setSendingRealtimeKind, pushSending, removeOptimisticMessage, setPendingAudio, setPendingFile, setPendingVideo, isDesktop, messageInputRef, storyReplyTarget, replyToMessageId });
  }

  async function sendWelcomeSticker(): ReturnType<ChatPageCallbacks["sendWelcomeSticker"]> {
    const { pushOptimisticMessage, sendPreparedMessage } = sources.capture;

    const payloadText = serializeStickerContent("/stickers/tg-duck-greeting.tgs", {
      source: "greeting_button",
      emoji: "👋",
    });
    const optimisticMessageId = pushOptimisticMessage(payloadText);
    await sendPreparedMessage(payloadText, { resetComposer: false, optimisticMessageId, throwOnError: true });
  }

  async function sendStickerFromPicker(src: string, emoji?: string): ReturnType<ChatPageCallbacks["sendStickerFromPicker"]> {
    const { pushOptimisticMessage, sendPreparedMessage } = sources.capture;
    const { setStickerPickerOpen } = sources.page.attachmentDraft;

    const matchedEmoji = emoji || getStickerEmojiBySrc(src);
    const payloadText = serializeStickerContent(src, { source: "picker", emoji: matchedEmoji });
    const optimisticMessageId = pushOptimisticMessage(payloadText);
    await sendPreparedMessage(payloadText, { resetComposer: false, optimisticMessageId, throwOnError: true });
    setStickerPickerOpen(false);
  }

  async function sendPollMessage(
    question: string,
    options: string[],
    quizMode: boolean,
    correctOptionIndex: number | null,
    expiresInHours: number | null,
  ): ReturnType<ChatPageCallbacks["sendPollMessage"]> {
    const { activeChat } = sources.active;
    const { activeConversation } = sources.page.conversation;
    const { pushOptimisticMessage, sendPreparedMessage } = sources.capture;

    if (!activeChat || !activeConversation) return;

    const hours = expiresInHours !== null ? expiresInHours : 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const payloadText = serializePollContent(
      question.trim(),
      options.map((o) => o.trim()).filter(Boolean),
      quizMode,
      correctOptionIndex,
      expiresAt,
    );
    const optimisticMessageId = pushOptimisticMessage(payloadText);
    await sendPreparedMessage(payloadText, { resetComposer: false, optimisticMessageId, throwOnError: true });
  }

  function openForwardAuthorProfile(author: ForwardAuthor): ReturnType<ChatPageCallbacks["openForwardAuthorProfile"]> {
    const { t } = sources.page;
    const { setMessageHelperId } = sources.page.appearance;
    const { selfId, selfProfile } = sources.page.account;
    const { contactsForAdd } = sources.page.mediaAndChannel;
    const { chats } = sources.page.conversation;
    const { readProfileFromCache } = sources.bootstrap;
    const { openChannelModal, openProfileModal } = sources.callbacks;

    setMessageHelperId(null);
    if (author.id === selfId) { showAppToast({ title: t("Это вы"), type: "info" }); return; }
    const link = author.id === selfId ? selfProfile?.link : author.link || (author.id ? readProfileFromCache(author.id)?.link || contactsForAdd.find(contact => contact.id === author.id)?.link || chats.find(chat => chat.peerId === author.id)?.link : undefined);
    if (!link) return;
    if (author.kind === "channel") void openChannelModal(link);
    else void openProfileModal(link);
  }

  function beginForwardMessages(source: DecryptedMessage[]): ReturnType<ChatPageCallbacks["beginForwardMessages"]> {
    const { t } = sources.page;
    const { selectedLink } = sources.page.selection;
    const { forwardSending, setForwardPickerMode, setForwardPickerMessages } = sources.page.messageInteraction;
    const { selfId, selfProfile } = sources.page.account;
    const { contactsForAdd } = sources.page.mediaAndChannel;
    const { activeConversation } = sources.page.conversation;
    const { setMessageHelperId } = sources.page.appearance;
    const { readProfileFromCache, loadChatPage } = sources.bootstrap;
    const { activeTitle, groupMembersById } = sources.presentation;
    const { activeChat } = sources.active;
    const { ensureCreateChatContacts } = sources.callbacks;

    if (selectedLink?.startsWith("secret-") || forwardSending) return;
    const items = source.filter(message => !message.pending && !message.systemPayload).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).map(message => {
      const previous = readForwardedContent(message.text);
      if (previous) return { ...previous, requestId: crypto.randomUUID() };
      const profile = readProfileFromCache(message.senderId);
      const mine = message.senderId === selfId;
      const contact = contactsForAdd.find(item => item.id === message.senderId);
      const channel = activeConversation?.chatType === "channel";
      return {
        requestId: crypto.randomUUID(), content: message.text, author: {
          kind: channel ? "channel" as const : "user" as const, id: channel ? activeConversation?.channel?.id : message.senderId,
          name: channel ? activeTitle || t("Канал") : mine ? selfProfile?.displayName || selfProfile?.link || t("Вы") : contact?.alias || message.senderDisplayName || profile?.displayName || activeTitle || t("Пользователь"),
          avatarUrl: channel ? activeChat?.avatarUrl : mine ? selfProfile?.avatarUrl : profile?.avatarUrl ?? contact?.avatarUrl ?? groupMembersById.get(message.senderId)?.avatarUrl ?? (activeConversation?.peer?.id === message.senderId ? activeChat?.avatarUrl : null),
          link: channel ? activeChat?.link : mine ? selfProfile?.link : profile?.link || contact?.link || groupMembersById.get(message.senderId)?.link || (activeConversation?.peer?.id === message.senderId ? activeConversation.peer.link : undefined)
        }
      };
    });
    if (!items.length) return;
    setForwardPickerMode("forward");
    setForwardPickerMessages(items);
    setMessageHelperId(null);
    void loadChatPage(null, "replace");
    void ensureCreateChatContacts(true);
  }

  function chooseForwardRecipient(recipient: ForwardRecipient): ReturnType<ChatPageCallbacks["chooseForwardRecipient"]> {
    const { router } = sources.page;
    const { forwardPickerMessages, setForwardDraft, forwardPickerMode, setForwardPickerMessages } = sources.page.messageInteraction;
    const { setReplyToMessageId } = sources.page.composerInteraction;
    const { setStoryReplyTarget } = sources.page.storyDraft;
    const { setMessageText, selectedSearchTargetRef, selectedLinkRef, setSelectedLink } = sources.page.selection;
    const { setPendingImage, setPendingVideo, setPendingAudio, setPendingFile, setPendingMediaBatch } = sources.page.attachmentDraft;
    const { clearSelectionMode } = sources.messageActions;

    if (!forwardPickerMessages) return;
    setForwardDraft({ link: recipient.link, chatType: recipient.chatType, share: forwardPickerMode === "share", messages: forwardPickerMessages });
    setForwardPickerMessages(null);
    clearSelectionMode();
    cancelEditMode(); setReplyToMessageId(null); setStoryReplyTarget(null); setMessageText("");
    setPendingImage(null); setPendingVideo(null); setPendingAudio(null); setPendingFile(null); setPendingMediaBatch(null);
    selectedSearchTargetRef.current = { link: recipient.link, chatType: recipient.chatType, isBot: false };
    selectedLinkRef.current = recipient.link;
    setSelectedLink(recipient.link);
    router.replace(`/app?chat=${encodeURIComponent(recipient.link)}&chatType=${recipient.chatType}`, { scroll: false });
  }

  async function deleteMessage(messageId: string): ReturnType<ChatPageCallbacks["deleteMessage"]> {
    const { activeChat } = sources.active;
    const { setErrorText, t } = sources.page;
    const { removingMessageIds, setRemovingMessageIds, setDeletingShift } = sources.page.messageInteraction;
    const { setMessageHelperId } = sources.page.appearance;
    const { messages, activeConversationRef, setMessages } = sources.page.conversation;
    const { selectedLinkRef } = sources.page.selection;
    const { animateDeleteMessage, syncConversationCacheMessages } = sources.messageActions;
    const { clearMessageDeletedTombstone } = sources.elements;
    const { deleteAnimationTimersRef } = sources.elements.conversationElement;

    return deleteMessageAction({ activeChat, removingMessageIds, setErrorText, setMessageHelperId, messages, animateDeleteMessage, clearMessageDeletedTombstone, deleteAnimationTimersRef, setRemovingMessageIds, setDeletingShift, syncConversationCacheMessages, selectedLinkRef, activeConversationRef, setMessages, t }, messageId);
  }

  function buildEditTarget(message: DecryptedMessage, parsed: ParsedMessageContent): EditTarget | null {
    const { selfId } = sources.page.account;

    return buildEditTargetAction({ selfId }, message, parsed);
  }

  function beginEditMessage(message: DecryptedMessage, parsed: ParsedMessageContent): ReturnType<ChatPageCallbacks["beginEditMessage"]> {
    const { setErrorText, t } = sources.page;
    const { pendingMediaBatch, pendingImage, pendingVideo, pendingAudio, pendingFile } = sources.page.attachmentDraft;
    const { voiceRecording, videoRecording } = sources.page.recorderPresentation;
    const { messageText, setMessageText } = sources.page.selection;
    const { setEditTarget, setReplyToMessageId } = sources.page.composerInteraction;
    const { setStoryReplyTarget } = sources.page.storyDraft;
    const { setMessageHelperId } = sources.page.appearance;
    const { draftBeforeEditRef, editPrefillTargetIdRef } = sources.elements.conversationElement;

    parsed = parseMessageContent(message.text);
    if (pendingMediaBatch?.length || pendingImage || pendingVideo || pendingAudio || pendingFile || voiceRecording || videoRecording) {
      setErrorText(t("Сначала завершите отправку медиа или отмените запись"));
      return;
    }
    const target = buildEditTarget(message, parsed);
    if (!target) return;
    draftBeforeEditRef.current = messageText;
    editPrefillTargetIdRef.current = target.id;
    setEditTarget(target);
    setMessageText(getEditableTextFromParsed(parsed));
    setReplyToMessageId(null);
    setStoryReplyTarget(null);
    setMessageHelperId(null);
  }

  function cancelEditMode(): ReturnType<ChatPageCallbacks["cancelEditMode"]> {
    const { editPrefillTargetIdRef, draftBeforeEditRef } = sources.elements.conversationElement;
    const { setEditTarget } = sources.page.composerInteraction;
    const { setMessageText } = sources.page.selection;

    editPrefillTargetIdRef.current = null;
    setEditTarget(null);
    setMessageText(draftBeforeEditRef.current);
  }

  function isEditDraftValid(target: EditTarget | null, draft: string): ReturnType<ChatPageCallbacks["isEditDraftValid"]> {

    if (!target) return false;
    if (target.kind === "text") {
      return draft.trim().length > 0;
    }
    return true;
  }

  async function saveEditedMessage(): ReturnType<ChatPageCallbacks["saveEditedMessage"]> {
    const { setErrorText, t } = sources.page;
    const { editTarget, editSaving, setEditSaving, setEditTarget, setReplyToMessageId } = sources.page.composerInteraction;
    const { activeConversation, messages, chats, setMessages, setChats } = sources.page.conversation;
    const { sending, sendingMedia, setSending } = sources.page.conversationRequest;
    const { messageText, setMessageText } = sources.page.selection;
    const { setStoryReplyTarget } = sources.page.storyDraft;
    const { selfId } = sources.page.account;
    const { activeChat } = sources.active;
    const { updateLastMessagePreviewAfterEdit } = sources.messageActions;
    const { ensureOwnE2EReady, buildSharedChatKeyId, ensureSharedKeyFromServer } = sources.history;
    const { peerPublicKeyByLinkRef, editPrefillTargetIdRef } = sources.elements.conversationElement;

    return saveEditedMessageAction({ editTarget, activeChat, activeConversation, sending, sendingMedia, editSaving, messageText, setErrorText, t, messages, cancelEditMode, chats, setMessages, updateLastMessagePreviewAfterEdit, setEditSaving, setSending, setEditTarget, setMessageText, setReplyToMessageId, setStoryReplyTarget, ensureOwnE2EReady, peerPublicKeyByLinkRef, buildSharedChatKeyId, ensureSharedKeyFromServer, selfId, editPrefillTargetIdRef, setChats });
  }

  async function copyMessageText(value: string): ReturnType<ChatPageCallbacks["copyMessageText"]> {
    const { showChatActionPanel, t } = sources.page;
    const { setMessageHelperId } = sources.page.appearance;

    if (!value.trim()) return;
    try {
      await writeEmojiClipboard(value);
      setMessageHelperId(null);
      showChatActionPanel({ icon: "copy", message: t("Сообщение скопировано.") }, 2200);
    } catch {
      // no-op: clipboard is unavailable in some browsers/contexts
    }
  }

  return { sendReadReceipt, processPickedFiles, onPickMedia, startActiveBot, sendMessage, sendWelcomeSticker, sendStickerFromPicker, sendPollMessage, openForwardAuthorProfile, beginForwardMessages, chooseForwardRecipient, deleteMessage, buildEditTarget, beginEditMessage, cancelEditMode, isEditDraftValid, saveEditedMessage, copyMessageText };
}
