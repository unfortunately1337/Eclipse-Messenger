

import { type ConversationVideoViewer } from "../ConversationVideoViewer";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ProfileMediaModel } from "../controllers/useProfileMedia";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface ConversationVideoViewerSources {
  readonly page: Pick<ChatPageStateModel, "t"> & {
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "videoViewer" | "setVideoViewer" | "setVideoViewerFailed" | "setVideoViewerPlaying" | "setVideoViewerProgress" | "setVideoViewerCurrentTime" | "setVideoViewerMenuOpen" | "videoViewerMenuOpen">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "deletingMessageId">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "liveBackgroundPreset">;

  };
  readonly elements: {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "videoViewerRef">;

  };
  readonly profileMedia: Pick<ProfileMediaModel, "handleVideoViewerAuthorClick">;
  readonly callbacks: Pick<ChatPageCallbacks, "deleteMessage">;
}

/** Projects only the props this memoized view consumes. */
export function bindConversationVideoViewer(sources: ConversationVideoViewerSources): React.ComponentProps<typeof ConversationVideoViewer> {
  const { t } = sources.page;
  const { videoViewer, setVideoViewer, setVideoViewerFailed, setVideoViewerPlaying, setVideoViewerProgress, setVideoViewerCurrentTime, setVideoViewerMenuOpen, videoViewerMenuOpen } = sources.page.mediaAndChannel;
  const { activeConversation } = sources.page.conversation;
  const { deletingMessageId } = sources.page.messageInteraction;
  const { liveBackgroundPreset } = sources.page.notificationAndContacts;
  const { videoViewerRef } = sources.elements.conversationElement;
  const { handleVideoViewerAuthorClick } = sources.profileMedia;
  const { deleteMessage } = sources.callbacks;
  return {
    "videoViewer": videoViewer,
    "videoViewerRef": videoViewerRef,
    "setVideoViewer": setVideoViewer,
    "setVideoViewerFailed": setVideoViewerFailed,
    "setVideoViewerPlaying": setVideoViewerPlaying,
    "setVideoViewerProgress": setVideoViewerProgress,
    "setVideoViewerCurrentTime": setVideoViewerCurrentTime,
    "setVideoViewerMenuOpen": setVideoViewerMenuOpen,
    "t": t,
    "activeConversation": activeConversation,
    "handleVideoViewerAuthorClick": handleVideoViewerAuthorClick,
    "videoViewerMenuOpen": videoViewerMenuOpen,
    "deleteMessage": deleteMessage,
    "deletingMessageId": deletingMessageId,
    "liveBackgroundPreset": liveBackgroundPreset
  };
}
