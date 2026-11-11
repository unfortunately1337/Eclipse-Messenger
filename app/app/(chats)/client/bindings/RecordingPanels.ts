

import { type RecordingPanels } from "../RecordingPanels";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { MessageReactionsModel } from "../controllers/useMessageReactions";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { ConversationActionsModel } from "../controllers/useConversationActions";
import type { ChatPagePresentationModel } from "../controllers/useChatPagePresentation";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface RecordingPanelsSources {
  readonly page: Pick<ChatPageStateModel, "t" | "reducedPanelMotion" | "messageHelperReadListOpen" | "setMessageHelperReadListOpen" | "pollResults" | "handlePollVote"> & {
    appearance: Pick<ChatPageStateModel["appearance"], "messageHelperId" | "setMessageHelperId" | "messageHelperAnchor" | "desktopMessageHelperRef">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "isCoarsePointer">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "messageHelperAllReactionsOpen" | "setMessageHelperAllReactionsOpen">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryReplyTarget">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "setReplyToMessageId" | "editSaving">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "removingMessageIds">;

  };
  readonly presentation: Pick<ConversationPresentationModel, "helperMessage" | "helperParsed" | "helperIsMine" | "isSecretChat" | "helperReadViewers" | "helperReadPreviewViewers" | "helperCanCopy" | "helperCopyValue" | "helperIsEditable" | "helperEditTargetId" | "helperCanDelete">;
  readonly reactions: Pick<MessageReactionsModel, "reactionHelperWidth" | "hasAllowedReactions" | "reactionGridWidth" | "reactionGridColumns" | "allowedReactionEmojis" | "toggleReaction" | "helperReactionEmojis" | "hasMoreReactions">;
  readonly appearance: Pick<ChatAppearanceModel, "composerInputThemeStyle">;
  readonly callbacks: Pick<ChatPageCallbacks, "copyMessageText" | "beginForwardMessages" | "beginEditMessage" | "deleteMessage">;
  readonly history: Pick<MessageHistoryModel, "messagePins">;
  readonly messageActions: Pick<ConversationActionsModel, "beginSelectionMode">;
  readonly view: Pick<ChatPagePresentationModel, "renderCenteredMessageHelperPreview">;
}

/** Projects only the props this memoized view consumes. */
export function bindRecordingPanels(sources: RecordingPanelsSources): React.ComponentProps<typeof RecordingPanels> {
  const { t, reducedPanelMotion, messageHelperReadListOpen, setMessageHelperReadListOpen, pollResults, handlePollVote } = sources.page;
  const { messageHelperId, setMessageHelperId, messageHelperAnchor, desktopMessageHelperRef } = sources.page.appearance;
  const { isCoarsePointer } = sources.page.mediaAndChannel;
  const { messageHelperAllReactionsOpen, setMessageHelperAllReactionsOpen } = sources.page.profileNavigation;
  const { setStoryReplyTarget } = sources.page.storyDraft;
  const { setReplyToMessageId, editSaving } = sources.page.composerInteraction;
  const { selectedLink } = sources.page.selection;
  const { removingMessageIds } = sources.page.messageInteraction;
  const { helperMessage, helperParsed, helperIsMine, isSecretChat, helperReadViewers, helperReadPreviewViewers, helperCanCopy, helperCopyValue, helperIsEditable, helperEditTargetId, helperCanDelete } = sources.presentation;
  const { reactionHelperWidth, hasAllowedReactions, reactionGridWidth, reactionGridColumns, allowedReactionEmojis, toggleReaction, helperReactionEmojis, hasMoreReactions } = sources.reactions;
  const { composerInputThemeStyle } = sources.appearance;
  const { copyMessageText, beginForwardMessages, beginEditMessage, deleteMessage } = sources.callbacks;
  const { messagePins } = sources.history;
  const { beginSelectionMode } = sources.messageActions;
  const { renderCenteredMessageHelperPreview } = sources.view;
  return {
    "messageHelperId": messageHelperId,
    "helperMessage": helperMessage,
    "helperParsed": helperParsed,
    "setMessageHelperId": setMessageHelperId,
    "isCoarsePointer": isCoarsePointer,
    "t": t,
    "reactionHelperWidth": reactionHelperWidth,
    "messageHelperAnchor": messageHelperAnchor,
    "helperIsMine": helperIsMine,
    "desktopMessageHelperRef": desktopMessageHelperRef,
    "isSecretChat": isSecretChat,
    "hasAllowedReactions": hasAllowedReactions,
    "messageHelperAllReactionsOpen": messageHelperAllReactionsOpen,
    "composerInputThemeStyle": composerInputThemeStyle,
    "reactionGridWidth": reactionGridWidth,
    "reactionGridColumns": reactionGridColumns,
    "allowedReactionEmojis": allowedReactionEmojis,
    "toggleReaction": toggleReaction,
    "setMessageHelperAllReactionsOpen": setMessageHelperAllReactionsOpen,
    "reducedPanelMotion": reducedPanelMotion,
    "helperReactionEmojis": helperReactionEmojis,
    "hasMoreReactions": hasMoreReactions,
    "messageHelperReadListOpen": messageHelperReadListOpen,
    "setMessageHelperReadListOpen": setMessageHelperReadListOpen,
    "helperReadViewers": helperReadViewers,
    "helperReadPreviewViewers": helperReadPreviewViewers,
    "setStoryReplyTarget": setStoryReplyTarget,
    "setReplyToMessageId": setReplyToMessageId,
    "helperCanCopy": helperCanCopy,
    "helperCanRetractVote": Boolean(helperMessage && helperParsed?.kind === "poll" && !helperParsed.quizMode && (!helperParsed.expiresAt || Date.parse(helperParsed.expiresAt) > Date.now()) && pollResults[helperMessage.id]?.userVotedOptionIdx != null),
    "retractPollVote": () => { if (helperMessage) void handlePollVote(helperMessage.id, null).catch(error => console.error("Failed to retract poll vote:", error)); },
    "copyMessageText": copyMessageText,
    "helperCopyValue": helperCopyValue,
    "messagePins": messagePins,
    "selectedLink": selectedLink,
    "beginForwardMessages": beginForwardMessages,
    "helperIsEditable": helperIsEditable,
    "editSaving": editSaving,
    "helperEditTargetId": helperEditTargetId,
    "beginEditMessage": beginEditMessage,
    "beginSelectionMode": beginSelectionMode,
    "removingMessageIds": removingMessageIds,
    "helperCanDelete": helperCanDelete,
    "deleteMessage": deleteMessage,
    "renderCenteredMessageHelperPreview": renderCenteredMessageHelperPreview
  };
}
