

import { type MessageContextMenu } from "../MessageContextMenu";

import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { MessageReactionsModel } from "../controllers/useMessageReactions";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { ConversationActionsModel } from "../controllers/useConversationActions";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface MessageContextMenuSources {
  readonly presentation: Pick<ConversationPresentationModel, "shouldUseLegacyMessageHelper" | "helperMessage" | "helperParsed" | "isSecretChat" | "helperIsEditable" | "helperEditTargetId" | "helperCanDelete">;
  readonly page: Pick<ChatPageStateModel, "t"> & {
    appearance: Pick<ChatPageStateModel["appearance"], "messageHelperId" | "setMessageHelperId">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "isCoarsePointer">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryReplyTarget">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "setReplyToMessageId" | "editSaving">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "removingMessageIds">;

  };
  readonly appearance: Pick<ChatAppearanceModel, "composerInputThemeStyle">;
  readonly reactions: Pick<MessageReactionsModel, "hasAllowedReactions" | "helperReactionEmojis" | "toggleReaction">;
  readonly history: Pick<MessageHistoryModel, "messagePins">;
  readonly callbacks: Pick<ChatPageCallbacks, "beginForwardMessages" | "beginEditMessage" | "copyMessageText" | "deleteMessage">;
  readonly messageActions: Pick<ConversationActionsModel, "beginSelectionMode">;
}

/** Projects only the props this memoized view consumes. */
export function bindMessageContextMenu(sources: MessageContextMenuSources): React.ComponentProps<typeof MessageContextMenu> {
  const { shouldUseLegacyMessageHelper, helperMessage, helperParsed, isSecretChat, helperIsEditable, helperEditTargetId, helperCanDelete } = sources.presentation;
  const { t } = sources.page;
  const { messageHelperId, setMessageHelperId } = sources.page.appearance;
  const { isCoarsePointer } = sources.page.mediaAndChannel;
  const { setStoryReplyTarget } = sources.page.storyDraft;
  const { setReplyToMessageId, editSaving } = sources.page.composerInteraction;
  const { selectedLink } = sources.page.selection;
  const { removingMessageIds } = sources.page.messageInteraction;
  const { composerInputThemeStyle } = sources.appearance;
  const { hasAllowedReactions, helperReactionEmojis, toggleReaction } = sources.reactions;
  const { messagePins } = sources.history;
  const { beginForwardMessages, beginEditMessage, copyMessageText, deleteMessage } = sources.callbacks;
  const { beginSelectionMode } = sources.messageActions;
  return {
    "shouldUseLegacyMessageHelper": shouldUseLegacyMessageHelper,
    "messageHelperId": messageHelperId,
    "isCoarsePointer": isCoarsePointer,
    "helperMessage": helperMessage,
    "helperParsed": helperParsed,
    "composerInputThemeStyle": composerInputThemeStyle,
    "isSecretChat": isSecretChat,
    "hasAllowedReactions": hasAllowedReactions,
    "helperReactionEmojis": helperReactionEmojis,
    "toggleReaction": toggleReaction,
    "setMessageHelperId": setMessageHelperId,
    "setStoryReplyTarget": setStoryReplyTarget,
    "setReplyToMessageId": setReplyToMessageId,
    "t": t,
    "messagePins": messagePins,
    "selectedLink": selectedLink,
    "beginForwardMessages": beginForwardMessages,
    "helperIsEditable": helperIsEditable,
    "editSaving": editSaving,
    "helperEditTargetId": helperEditTargetId,
    "beginEditMessage": beginEditMessage,
    "copyMessageText": copyMessageText,
    "beginSelectionMode": beginSelectionMode,
    "removingMessageIds": removingMessageIds,
    "helperCanDelete": helperCanDelete,
    "deleteMessage": deleteMessage
  };
}
