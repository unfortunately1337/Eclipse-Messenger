

import { type ConversationMessages } from "../ConversationMessages";

import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ChatInteractionModel } from "../controllers/useChatInteraction";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatPagePresentationModel } from "../controllers/useChatPagePresentation";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { ChatDirectoryModel } from "../controllers/useChatDirectory";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ChatRealtimeModel } from "../controllers/useChatRealtime";
import type { ConversationActionsModel } from "../controllers/useConversationActions";
import type { MessageReactionsModel } from "../controllers/useMessageReactions";
import type { ProfileMediaModel } from "../controllers/useProfileMedia";

export interface ConversationMessagesSources {
  readonly elements: Pick<ChatElementStateModel, "mobileEmojiPickerHeight"> & {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "messagesViewportRef" | "messageLongPressStartRef" | "messageLongPressTriggeredRef" | "messageSwipeStartRef" | "messageLongPressTimerRef" | "messagesEndRef">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "messagesTouchYRef">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "footerHeight" | "lastTapRef">;

  };
  readonly interaction: Pick<ChatInteractionModel, "handleMessagesScroll" | "interruptMessageAutoScroll" | "clearMessageLongPress">;
  readonly presentation: Pick<ConversationPresentationModel, "isSecretChat" | "showDirectEmptyState" | "isSecretChatCreator" | "activeTitle" | "isManagedBotConversation" | "botChatUi" | "isSavedConversation" | "groupMembersById" | "hasSentWelcomeSticker" | "replyMessageById" | "selectedMessageIdSet" | "shouldUseLegacyMessageHelper">;
  readonly page: Pick<ChatPageStateModel, "t" | "pollResults" | "handlePollVote" | "fetchPollResults"> & {
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "globalMusicVisible">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "selectionMode" | "removingMessageIds" | "readMessageIds" | "deletingShift" | "highlightedMessageId" | "messageHelperHorizontalPlacement" | "deletingMessageId">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "stickerPickerOpen" | "pendingImage" | "pendingVideo" | "pendingAudio">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "syncing">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile" | "suppressMessageEntranceRef" | "animatedMessageIdsRef">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "messages">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "applyingWallpaper">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalData" | "contactsForAdd" | "isCoarsePointer" | "setVideoViewer" | "setVideoViewerFailed" | "setVideoViewerPlaying">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "messageText">;
    appearance: Pick<ChatPageStateModel["appearance"], "chatUiSettings" | "messageHelperId" | "setMessageHelperId">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "hoverReactionLeaveTimerRef" | "hoverReactionTimerRef" | "setHoverReactionMessageId" | "setHoverReactionExpandedMessageId" | "hoverReactionMessageId" | "hoverReactionExpandedMessageId">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "swipeMessageId" | "swipeOffsetX" | "setSwipeMessageId" | "setSwipeOffsetX" | "setReplyToMessageId" | "editSaving" | "editTarget">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryReplyTarget">;

  };
  readonly view: Pick<ChatPagePresentationModel, "messageListPins" | "messageListActions" | "messageListCallControls">;
  readonly appearance: Pick<ChatAppearanceModel, "emptyChatPanelThemeStyle" | "renderCommunityBanners" | "dateSeparatorThemeStyle" | "mineMessageClassName" | "incomingMessageClassName" | "mineMessageGradientStyle" | "mineReplyPreviewThemeStyle" | "composerInputThemeStyle">;
  readonly history: Pick<MessageHistoryModel, "messagesCanvasHeight" | "renderedMessages" | "getMessageRowRef">;
  readonly directory: Pick<ChatDirectoryModel, "bannersHeight" | "messageVerticalOffset" | "activeReadReceiptIso" | "scrollToMessageById">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache"> & {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "currentUserIdRef">;

  };
  readonly active: Pick<ActiveConversationModel, "activeChat">;
  readonly realtime: Pick<ChatRealtimeModel, "handleApplyPeerWallpaper">;
  readonly messageActions: Pick<ConversationActionsModel, "toggleMessageSelection" | "beginMessageSwipe" | "moveMessageSwipe" | "endMessageSwipe" | "beginSelectionMode">;
  readonly reactions: Pick<MessageReactionsModel, "renderInlineReactions" | "renderLinkifiedText" | "hasAllowedReactions" | "hoverReactionEmojis" | "toggleReaction" | "defaultQuickReaction" | "helperReactionEmojis">;
  readonly profileMedia: Pick<ProfileMediaModel, "openImageViewer">;
}

/** Projects only the props this memoized view consumes. */
export function bindConversationMessages(sources: ConversationMessagesSources): React.ComponentProps<typeof ConversationMessages> {
  const { mobileEmojiPickerHeight } = sources.elements;
  const { messagesViewportRef, messageLongPressStartRef, messageLongPressTriggeredRef, messageSwipeStartRef, messageLongPressTimerRef, messagesEndRef } = sources.elements.conversationElement;
  const { messagesTouchYRef } = sources.elements.conversationScroll;
  const { footerHeight, lastTapRef } = sources.elements.messageDelivery;
  const { handleMessagesScroll, interruptMessageAutoScroll, clearMessageLongPress } = sources.interaction;
  const { isSecretChat, showDirectEmptyState, isSecretChatCreator, activeTitle, isManagedBotConversation, botChatUi, isSavedConversation, groupMembersById, hasSentWelcomeSticker, replyMessageById, selectedMessageIdSet, shouldUseLegacyMessageHelper } = sources.presentation;
  const { t, pollResults, handlePollVote, fetchPollResults } = sources.page;
  const { globalMusicVisible } = sources.page.secretChatDraft;
  const { selectionMode, removingMessageIds, readMessageIds, deletingShift, highlightedMessageId, messageHelperHorizontalPlacement, deletingMessageId } = sources.page.messageInteraction;
  const { isDesktop } = sources.page.panels;
  const { stickerPickerOpen, pendingImage, pendingVideo, pendingAudio } = sources.page.attachmentDraft;
  const { syncing } = sources.page.conversationRequest;
  const { selfId, selfProfile, suppressMessageEntranceRef, animatedMessageIdsRef } = sources.page.account;
  const { activeConversation, messages } = sources.page.conversation;
  const { applyingWallpaper } = sources.page.wallpaperUpload;
  const { channelModalData, contactsForAdd, isCoarsePointer, setVideoViewer, setVideoViewerFailed, setVideoViewerPlaying } = sources.page.mediaAndChannel;
  const { selectedLink, messageText } = sources.page.selection;
  const { chatUiSettings, messageHelperId, setMessageHelperId } = sources.page.appearance;
  const { hoverReactionLeaveTimerRef, hoverReactionTimerRef, setHoverReactionMessageId, setHoverReactionExpandedMessageId, hoverReactionMessageId, hoverReactionExpandedMessageId } = sources.page.profileNavigation;
  const { swipeMessageId, swipeOffsetX, setSwipeMessageId, setSwipeOffsetX, setReplyToMessageId, editSaving, editTarget } = sources.page.composerInteraction;
  const { setStoryReplyTarget } = sources.page.storyDraft;
  const { messageListPins, messageListActions, messageListCallControls } = sources.view;
  const { emptyChatPanelThemeStyle, renderCommunityBanners, dateSeparatorThemeStyle, mineMessageClassName, incomingMessageClassName, mineMessageGradientStyle, mineReplyPreviewThemeStyle, composerInputThemeStyle } = sources.appearance;
  const { messagesCanvasHeight, renderedMessages, getMessageRowRef } = sources.history;
  const { bannersHeight, messageVerticalOffset, activeReadReceiptIso, scrollToMessageById } = sources.directory;
  const { readProfileFromCache } = sources.bootstrap;
  const { currentUserIdRef } = sources.bootstrap.accountNavigation;
  const { activeChat } = sources.active;
  const { handleApplyPeerWallpaper } = sources.realtime;
  const { toggleMessageSelection, beginMessageSwipe, moveMessageSwipe, endMessageSwipe, beginSelectionMode } = sources.messageActions;
  const { renderInlineReactions, renderLinkifiedText, hasAllowedReactions, hoverReactionEmojis, toggleReaction, defaultQuickReaction, helperReactionEmojis } = sources.reactions;
  const { openImageViewer } = sources.profileMedia;
  return {
    "messagesViewportRef": messagesViewportRef,
    "handleMessagesScroll": handleMessagesScroll,
    "interruptMessageAutoScroll": interruptMessageAutoScroll,
    "messagesTouchYRef": messagesTouchYRef,
    "isSecretChat": isSecretChat,
    "globalMusicVisible": globalMusicVisible,
    "messagePins": messageListPins,
    "selectionMode": selectionMode,
    "showDirectEmptyState": showDirectEmptyState,
    "isDesktop": isDesktop,
    "stickerPickerOpen": stickerPickerOpen,
    "mobileEmojiPickerHeight": mobileEmojiPickerHeight,
    "footerHeight": footerHeight,
    "emptyChatPanelThemeStyle": emptyChatPanelThemeStyle,
    "isSecretChatCreator": isSecretChatCreator,
    "t": t,
    "activeTitle": activeTitle,
    "isManagedBotConversation": isManagedBotConversation,
    "botEmptyText": botChatUi.settings.empty_text,
    "isSavedConversation": isSavedConversation,
    "syncing": syncing,
    "sendWelcomeSticker": messageListActions.sendWelcomeSticker,
    "messagesCanvasHeight": messagesCanvasHeight,
    "bannersHeight": bannersHeight,
    "messageVerticalOffset": messageVerticalOffset,
    "renderCommunityBanners": renderCommunityBanners,
    "renderedMessages": renderedMessages,
    "selfId": selfId,
    "selfProfile": selfProfile,
    "currentUserIdRef": currentUserIdRef,
    "activeConversation": activeConversation,
    "getMessageRowRef": getMessageRowRef,
    "dateSeparatorThemeStyle": dateSeparatorThemeStyle,
    "mineMessageClassName": mineMessageClassName,
    "incomingMessageClassName": incomingMessageClassName,
    "mineMessageGradientStyle": mineMessageGradientStyle,
    "calls": messageListCallControls,
    "activeChat": activeChat,
    "handleApplyPeerWallpaper": handleApplyPeerWallpaper,
    "applyingWallpaper": applyingWallpaper,
    "channelModalData": channelModalData,
    "removingMessageIds": removingMessageIds,
    "groupMembersById": groupMembersById,
    "readProfileFromCache": readProfileFromCache,
    "contactsForAdd": contactsForAdd,
    "selectedLink": selectedLink,
    "messages": messages,
    "hasComposerText": Boolean(messageText.trim()),
    "hasPendingImage": Boolean(pendingImage),
    "hasPendingVideo": Boolean(pendingVideo),
    "hasPendingAudio": Boolean(pendingAudio),
    "hasSentWelcomeSticker": hasSentWelcomeSticker,
    "readMessageIds": readMessageIds,
    "activeReadReceiptIso": activeReadReceiptIso,
    "replyMessageById": replyMessageById,
    "mineReplyPreviewThemeStyle": mineReplyPreviewThemeStyle,
    "scrollToMessageById": scrollToMessageById,
    "openForwardAuthorProfile": messageListActions.openForwardAuthorProfile,
    "selectedMessageIdSet": selectedMessageIdSet,
    "chatUiSettings": chatUiSettings,
    "suppressMessageEntranceRef": suppressMessageEntranceRef,
    "animatedMessageIdsRef": animatedMessageIdsRef,
    "deletingShift": deletingShift,
    "messageHelperId": messageHelperId,
    "toggleMessageSelection": toggleMessageSelection,
    "hoverReactionLeaveTimerRef": hoverReactionLeaveTimerRef,
    "hoverReactionTimerRef": hoverReactionTimerRef,
    "setHoverReactionMessageId": setHoverReactionMessageId,
    "setHoverReactionExpandedMessageId": setHoverReactionExpandedMessageId,
    "highlightedMessageId": highlightedMessageId,
    "swipeMessageId": swipeMessageId,
    "swipeOffsetX": swipeOffsetX,
    "isCoarsePointer": isCoarsePointer,
    "setMessageHelperId": setMessageHelperId,
    "beginMessageSwipe": beginMessageSwipe,
    "messageLongPressStartRef": messageLongPressStartRef,
    "clearMessageLongPress": clearMessageLongPress,
    "moveMessageSwipe": moveMessageSwipe,
    "endMessageSwipe": endMessageSwipe,
    "messageLongPressTriggeredRef": messageLongPressTriggeredRef,
    "lastTapRef": lastTapRef,
    "messageSwipeStartRef": messageSwipeStartRef,
    "setSwipeMessageId": setSwipeMessageId,
    "setSwipeOffsetX": setSwipeOffsetX,
    "messageLongPressTimerRef": messageLongPressTimerRef,
    "renderInlineReactions": renderInlineReactions,
    "composerInputThemeStyle": composerInputThemeStyle,
    "setVideoViewer": setVideoViewer,
    "setVideoViewerFailed": setVideoViewerFailed,
    "setVideoViewerPlaying": setVideoViewerPlaying,
    "openImageViewer": openImageViewer,
    "renderLinkifiedText": renderLinkifiedText,
    "pollResults": pollResults,
    "handlePollVote": handlePollVote,
    "fetchPollResults": fetchPollResults,
    "hasAllowedReactions": hasAllowedReactions,
    "hoverReactionMessageId": hoverReactionMessageId,
    "hoverReactionExpandedMessageId": hoverReactionExpandedMessageId,
    "hoverReactionEmojis": hoverReactionEmojis,
    "toggleReaction": toggleReaction,
    "defaultQuickReaction": defaultQuickReaction,
    "shouldUseLegacyMessageHelper": shouldUseLegacyMessageHelper,
    "messageHelperHorizontalPlacement": messageHelperHorizontalPlacement,
    "helperReactionEmojis": helperReactionEmojis,
    "setStoryReplyTarget": setStoryReplyTarget,
    "setReplyToMessageId": setReplyToMessageId,
    "beginForwardMessages": messageListActions.beginForwardMessages,
    "editSaving": editSaving,
    "editTarget": editTarget,
    "beginEditMessage": messageListActions.beginEditMessage,
    "copyMessageText": messageListActions.copyMessageText,
    "beginSelectionMode": beginSelectionMode,
    "deletingMessageId": deletingMessageId,
    "deleteMessage": messageListActions.deleteMessage,
    "messagesEndRef": messagesEndRef
  };
}
