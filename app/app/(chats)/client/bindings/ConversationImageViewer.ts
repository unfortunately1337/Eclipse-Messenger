

import { type ConversationImageViewer } from "../ConversationImageViewer";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ProfileMediaModel } from "../controllers/useProfileMedia";
import type { MessageReactionsModel } from "../controllers/useMessageReactions";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface ConversationImageViewerSources {
  readonly page: Pick<ChatPageStateModel, "t"> & {
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "imageViewer" | "setImageViewer" | "setImageViewerIndex" | "setImageViewerPanelVisible" | "setImageViewerMenuOpen" | "imageViewerPanelVisible" | "imageViewerIndex" | "imageViewerMenuOpen" | "imageViewerDirection">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "deletingMessageId">;

  };
  readonly profileMedia: Pick<ProfileMediaModel, "chatImageGallery" | "handleImageViewerAuthorClick" | "handleImageViewerTouchStart" | "handleImageViewerTouchEnd" | "stepImageViewer">;
  readonly callbacks: Pick<ChatPageCallbacks, "deleteMessage">;
  readonly reactions: Pick<MessageReactionsModel, "renderLinkifiedText">;
}

/** Projects only the props this memoized view consumes. */
export function bindConversationImageViewer(sources: ConversationImageViewerSources): React.ComponentProps<typeof ConversationImageViewer> {
  const { t } = sources.page;
  const { imageViewer, setImageViewer, setImageViewerIndex, setImageViewerPanelVisible, setImageViewerMenuOpen, imageViewerPanelVisible, imageViewerIndex, imageViewerMenuOpen, imageViewerDirection } = sources.page.mediaAndChannel;
  const { activeConversation } = sources.page.conversation;
  const { deletingMessageId } = sources.page.messageInteraction;
  const { chatImageGallery, handleImageViewerAuthorClick, handleImageViewerTouchStart, handleImageViewerTouchEnd, stepImageViewer } = sources.profileMedia;
  const { deleteMessage } = sources.callbacks;
  const { renderLinkifiedText } = sources.reactions;
  return {
    "imageViewer": imageViewer,
    "setImageViewer": setImageViewer,
    "setImageViewerIndex": setImageViewerIndex,
    "setImageViewerPanelVisible": setImageViewerPanelVisible,
    "setImageViewerMenuOpen": setImageViewerMenuOpen,
    "t": t,
    "imageViewerPanelVisible": imageViewerPanelVisible,
    "chatImageGallery": chatImageGallery,
    "imageViewerIndex": imageViewerIndex,
    "activeConversation": activeConversation,
    "handleImageViewerAuthorClick": handleImageViewerAuthorClick,
    "imageViewerMenuOpen": imageViewerMenuOpen,
    "deleteMessage": deleteMessage,
    "deletingMessageId": deletingMessageId,
    "handleImageViewerTouchStart": handleImageViewerTouchStart,
    "handleImageViewerTouchEnd": handleImageViewerTouchEnd,
    "stepImageViewer": stepImageViewer,
    "imageViewerDirection": imageViewerDirection,
    "renderLinkifiedText": renderLinkifiedText
  };
}
