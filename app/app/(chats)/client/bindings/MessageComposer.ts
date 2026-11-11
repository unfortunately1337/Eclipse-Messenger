

import { type MessageComposer } from "../MessageComposer";

import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatPagePresentationModel } from "../controllers/useChatPagePresentation";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ChatInteractionModel } from "../controllers/useChatInteraction";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ComposerCaptureModel } from "../controllers/useComposerCapture";
import type { ProfileMediaModel } from "../controllers/useProfileMedia";
import type { MessageReactionsModel } from "../controllers/useMessageReactions";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface MessageComposerSources {
  readonly elements: Pick<ChatElementStateModel, "mobileEmojiPickerHeight" | "scrollMessagesToBottom"> & {
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "footerRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "messageInputRef">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "imageInputRef">;
    mediaRecorder: Pick<ChatElementStateModel["mediaRecorder"], "voiceWaveformSamplesRef" | "micRecordButtonRef">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "messagesAtBottomRef">;

  };
  readonly history: Pick<MessageHistoryModel, "messageSearch">;
  readonly page: Pick<ChatPageStateModel, "t" | "activeCustomTheme" | "transparentVisual" | "reducedPanelMotion"> & {
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "videoRecording" | "videoRecorderOpen" | "voiceRecording" | "voiceRecordingStream" | "videoRecordingStream" | "voiceRecordingMs" | "videoCameraSwitching" | "composerRecordMode" | "recordModeHintUntil">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "stickerPickerOpen" | "hasRenderedPicker" | "setStickerPickerOpen" | "pendingMediaBatch" | "pendingImage" | "pendingVideo" | "pendingAudio" | "pendingFile" | "setPendingMediaBatch" | "setPendingImage" | "setPendingVideo" | "setPendingAudio" | "setPendingFile">;
    conversation: Pick<ChatPageStateModel["conversation"], "messages" | "startingBot" | "activeConversation" | "composerPickerTab" | "setComposerPickerTab" | "attachmentMenuOpen" | "setAttachmentMenuOpen">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "loadingConversation" | "syncing" | "sendingMedia" | "sending" | "sendingMessageInFlightRef">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "mutedChatLinkSet">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "joiningGroup">;
    panels: Pick<ChatPageStateModel["panels"], "chatActionPanel" | "isDesktop">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "preventPickerCloseOnFocusRef" | "editTarget" | "setReplyToMessageId" | "videoRecordingMs" | "editSaving">;
    pollDraft: Pick<ChatPageStateModel["pollDraft"], "setPollQuestion" | "setPollOptions" | "setPollQuizMode" | "setPollCorrectOptionIndex" | "setPollExpiresInHours" | "setPollDialogOpen">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "acceptingSecretChat">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "forwardDraft" | "forwardSending" | "setForwardDraft">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyReplyTarget" | "setStoryReplyTarget">;
    account: Pick<ChatPageStateModel["account"], "selfId">;
    selection: Pick<ChatPageStateModel["selection"], "messageText" | "setMessageText">;
    appearance: Pick<ChatPageStateModel["appearance"], "chatUiSettings">;
    identity: Pick<ChatPageStateModel["identity"], "privateKey" | "selfPublicKey">;

  };
  readonly presentation: Pick<ConversationPresentationModel, "isEclipseConversation" | "isManagedBotConversation" | "isSecretChatComposerBlocked" | "activeTitle" | "isSecretChatAcceptRequired" | "replyTargetMessage" | "eclipseBots" | "botChatUi" | "isSecretChat">;
  readonly callbacks: Pick<ChatPageCallbacks, "startActiveBot" | "subscribeToActiveChannel" | "joinActiveGroup" | "sendStickerFromPicker" | "onPickMedia" | "acceptSecretChat" | "declineSecretChat" | "cancelEditMode" | "sendMessage">;
  readonly view: Pick<ChatPagePresentationModel, "canPostToChannel" | "canSubscribeToChannel" | "canJoinGroup">;
  readonly active: Pick<ActiveConversationModel, "activeChat">;
  readonly interaction: Pick<ChatInteractionModel, "toggleChatMutedState">;
  readonly appearance: Pick<ChatAppearanceModel, "composerInputThemeStyle" | "chatActionPanelThemeStyle" | "composerSendButtonToneClassName" | "composerSendButtonStyle">;
  readonly capture: Pick<ComposerCaptureModel, "cancelVoiceRecording" | "cancelVideoRecording" | "sendPreparedMessage" | "flipVideoCamera" | "finishVoiceRecording" | "finishVideoRecording" | "handleMicPointerDown" | "handleMicPointerMove" | "handleMicPointerUp" | "handleMicPointerCancel" | "handleMicClick">;
  readonly profileMedia: Pick<ProfileMediaModel, "replyComposerAuthor" | "canSubmitMessage">;
  readonly reactions: Pick<MessageReactionsModel, "openExternalLinkPrompt">;
}

/** Projects only the props this memoized view consumes. */
export function bindMessageComposer(sources: MessageComposerSources): React.ComponentProps<typeof MessageComposer> {
  const { mobileEmojiPickerHeight, scrollMessagesToBottom } = sources.elements;
  const { footerRef } = sources.elements.messageDelivery;
  const { messageInputRef } = sources.elements.storyAndViewport;
  const { imageInputRef } = sources.elements.conversationElement;
  const { voiceWaveformSamplesRef, micRecordButtonRef } = sources.elements.mediaRecorder;
  const { messagesAtBottomRef } = sources.elements.conversationScroll;
  const { messageSearch } = sources.history;
  const { t, activeCustomTheme, transparentVisual, reducedPanelMotion } = sources.page;
  const { videoRecording, videoRecorderOpen, voiceRecording, voiceRecordingStream, videoRecordingStream, voiceRecordingMs, videoCameraSwitching, composerRecordMode, recordModeHintUntil } = sources.page.recorderPresentation;
  const { stickerPickerOpen, hasRenderedPicker, setStickerPickerOpen, pendingMediaBatch, pendingImage, pendingVideo, pendingAudio, pendingFile, setPendingMediaBatch, setPendingImage, setPendingVideo, setPendingAudio, setPendingFile } = sources.page.attachmentDraft;
  const { messages, startingBot, activeConversation, composerPickerTab, setComposerPickerTab, attachmentMenuOpen, setAttachmentMenuOpen } = sources.page.conversation;
  const { loadingConversation, syncing, sendingMedia, sending, sendingMessageInFlightRef } = sources.page.conversationRequest;
  const { mutedChatLinkSet } = sources.page.notificationAndContacts;
  const { joiningGroup } = sources.page.groupDetails;
  const { chatActionPanel, isDesktop } = sources.page.panels;
  const { preventPickerCloseOnFocusRef, editTarget, setReplyToMessageId, videoRecordingMs, editSaving } = sources.page.composerInteraction;
  const { setPollQuestion, setPollOptions, setPollQuizMode, setPollCorrectOptionIndex, setPollExpiresInHours, setPollDialogOpen } = sources.page.pollDraft;
  const { acceptingSecretChat } = sources.page.secretChatDraft;
  const { forwardDraft, forwardSending, setForwardDraft } = sources.page.messageInteraction;
  const { storyReplyTarget, setStoryReplyTarget } = sources.page.storyDraft;
  const { selfId } = sources.page.account;
  const { messageText, setMessageText } = sources.page.selection;
  const { chatUiSettings } = sources.page.appearance;
  const { privateKey, selfPublicKey } = sources.page.identity;
  const { isEclipseConversation, isManagedBotConversation, isSecretChatComposerBlocked, activeTitle, isSecretChatAcceptRequired, replyTargetMessage, eclipseBots, botChatUi, isSecretChat } = sources.presentation;
  const { startActiveBot, subscribeToActiveChannel, joinActiveGroup, sendStickerFromPicker, onPickMedia, acceptSecretChat, declineSecretChat, cancelEditMode, sendMessage } = sources.callbacks;
  const { canPostToChannel, canSubscribeToChannel, canJoinGroup } = sources.view;
  const { activeChat } = sources.active;
  const { toggleChatMutedState } = sources.interaction;
  const { composerInputThemeStyle, chatActionPanelThemeStyle, composerSendButtonToneClassName, composerSendButtonStyle } = sources.appearance;
  const { cancelVoiceRecording, cancelVideoRecording, sendPreparedMessage, flipVideoCamera, finishVoiceRecording, finishVideoRecording, handleMicPointerDown, handleMicPointerMove, handleMicPointerUp, handleMicPointerCancel, handleMicClick } = sources.capture;
  const { replyComposerAuthor, canSubmitMessage } = sources.profileMedia;
  const { openExternalLinkPrompt } = sources.reactions;
  return {
    "footerRef": footerRef,
    "messageSearch": messageSearch,
    "videoRecording": videoRecording,
    "videoRecorderOpen": videoRecorderOpen,
    "stickerPickerOpen": stickerPickerOpen,
    "isEclipseConversation": isEclipseConversation,
    "isManagedBotConversation": isManagedBotConversation,
    "messages": messages,
    "startActiveBot": startActiveBot,
    "startingBot": startingBot,
    "loadingConversation": loadingConversation,
    "t": t,
    "activeConversation": activeConversation,
    "canPostToChannel": canPostToChannel,
    "canSubscribeToChannel": canSubscribeToChannel,
    "subscribeToActiveChannel": subscribeToActiveChannel,
    "activeChat": activeChat,
    "toggleChatMutedState": toggleChatMutedState,
    "composerInputThemeStyle": composerInputThemeStyle,
    "mutedChatLinkSet": mutedChatLinkSet,
    "canJoinGroup": canJoinGroup,
    "joinActiveGroup": joinActiveGroup,
    "joiningGroup": joiningGroup,
    "chatActionPanel": chatActionPanel,
    "chatActionPanelThemeStyle": chatActionPanelThemeStyle,
    "hasRenderedPicker": hasRenderedPicker,
    "isDesktop": isDesktop,
    "mobileEmojiPickerHeight": mobileEmojiPickerHeight,
    "composerPickerTab": composerPickerTab,
    "preventPickerCloseOnFocusRef": preventPickerCloseOnFocusRef,
    "messageInputRef": messageInputRef,
    "sendStickerFromPicker": sendStickerFromPicker,
    "setComposerPickerTab": setComposerPickerTab,
    "attachmentMenuOpen": attachmentMenuOpen,
    "setAttachmentMenuOpen": setAttachmentMenuOpen,
    "imageInputRef": imageInputRef,
    "setPollQuestion": setPollQuestion,
    "setPollOptions": setPollOptions,
    "setPollQuizMode": setPollQuizMode,
    "setPollCorrectOptionIndex": setPollCorrectOptionIndex,
    "setPollExpiresInHours": setPollExpiresInHours,
    "setPollDialogOpen": setPollDialogOpen,
    "syncing": syncing,
    "editTarget": editTarget,
    "onPickMedia": onPickMedia,
    "voiceRecording": voiceRecording,
    "cancelVoiceRecording": cancelVoiceRecording,
    "cancelVideoRecording": cancelVideoRecording,
    "isSecretChatComposerBlocked": isSecretChatComposerBlocked,
    "activeTitle": activeTitle,
    "isSecretChatAcceptRequired": isSecretChatAcceptRequired,
    "acceptSecretChat": acceptSecretChat,
    "acceptingSecretChat": acceptingSecretChat,
    "declineSecretChat": declineSecretChat,
    "setStickerPickerOpen": setStickerPickerOpen,
    "forwardDraft": forwardDraft,
    "replyTargetMessage": replyTargetMessage,
    "storyReplyTarget": storyReplyTarget,
    "pendingMediaBatch": pendingMediaBatch,
    "pendingImage": pendingImage,
    "pendingVideo": pendingVideo,
    "pendingAudio": pendingAudio,
    "pendingFile": pendingFile,
    "selfId": selfId,
    "forwardSending": forwardSending,
    "setForwardDraft": setForwardDraft,
    "activeCustomTheme": activeCustomTheme,
    "replyComposerAuthor": replyComposerAuthor,
    "cancelEditMode": cancelEditMode,
    "setReplyToMessageId": setReplyToMessageId,
    "setStoryReplyTarget": setStoryReplyTarget,
    "setPendingMediaBatch": setPendingMediaBatch,
    "sendingMedia": sendingMedia,
    "setPendingImage": setPendingImage,
    "setPendingVideo": setPendingVideo,
    "setPendingAudio": setPendingAudio,
    "setPendingFile": setPendingFile,
    "voiceRecordingStream": voiceRecordingStream,
    "videoRecordingStream": videoRecordingStream,
    "voiceRecordingMs": voiceRecordingMs,
    "videoRecordingMs": videoRecordingMs,
    "voiceWaveformSamplesRef": voiceWaveformSamplesRef,
    "eclipseBots": eclipseBots,
    "messageText": messageText,
    "setMessageText": setMessageText,
    "messagesAtBottomRef": messagesAtBottomRef,
    "scrollMessagesToBottom": scrollMessagesToBottom,
    "chatUiSettings": chatUiSettings,
    "sending": sending,
    "sendingMessageInFlightRef": sendingMessageInFlightRef,
    "sendMessage": sendMessage,
    "botChatUi": botChatUi,
    "isSecretChat": isSecretChat,
    "sendPreparedMessage": sendPreparedMessage,
    "editSaving": editSaving,
    "flipVideoCamera": flipVideoCamera,
    "videoCameraSwitching": videoCameraSwitching,
    "finishVoiceRecording": finishVoiceRecording,
    "finishVideoRecording": finishVideoRecording,
    "composerSendButtonToneClassName": composerSendButtonToneClassName,
    "composerSendButtonStyle": composerSendButtonStyle,
    "canSubmitMessage": canSubmitMessage,
    "privateKey": privateKey,
    "selfPublicKey": selfPublicKey,
    "composerRecordMode": composerRecordMode,
    "recordModeHintUntil": recordModeHintUntil,
    "transparentVisual": transparentVisual,
    "micRecordButtonRef": micRecordButtonRef,
    "handleMicPointerDown": handleMicPointerDown,
    "handleMicPointerMove": handleMicPointerMove,
    "handleMicPointerUp": handleMicPointerUp,
    "handleMicPointerCancel": handleMicPointerCancel,
    "handleMicClick": handleMicClick,
    "reducedPanelMotion": reducedPanelMotion,
    "openExternalLinkPrompt": openExternalLinkPrompt
  };
}
