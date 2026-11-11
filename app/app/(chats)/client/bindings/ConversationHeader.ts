

import { type ConversationHeader } from "../ConversationHeader";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ConversationActionsModel } from "../controllers/useConversationActions";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatDirectoryModel } from "../controllers/useChatDirectory";
import type { ChatStoriesModel } from "../controllers/useChatStories";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface ConversationHeaderSources {
  readonly page: Pick<ChatPageStateModel, "t"> & {
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "selectionMode" | "selectedMessageIds" | "selectionDeleting" | "setSelectionDeleteDialogOpen" | "forwardSending">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "setSelectedLink">;
    conversation: Pick<ChatPageStateModel["conversation"], "setActiveConversation" | "setMessages">;
    account: Pick<ChatPageStateModel["account"], "selfProfile">;

  };
  readonly history: Pick<MessageHistoryModel, "messageSearch">;
  readonly appearance: Pick<ChatAppearanceModel, "composerInputThemeStyle" | "chatHeaderThemeStyle" | "unreadBadgeThemeStyle">;
  readonly presentation: Pick<ConversationPresentationModel, "selectedMessages" | "isEclipseConversation" | "activeTitle" | "isSecretChat" | "isManagedBotConversation" | "activeStatusIndicatorKind" | "activeStatusText" | "activeStatusClass">;
  readonly callbacks: Pick<ChatPageCallbacks, "beginForwardMessages" | "openActiveDetails">;
  readonly messageActions: Pick<ConversationActionsModel, "clearSelectionMode">;
  readonly bootstrap: {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "suppressRequestedChatSyncRef">;

  };
  readonly directory: Pick<ChatDirectoryModel, "otherUnreadNotifications">;
  readonly stories: Pick<ChatStoriesModel, "activeChatStoryEntry" | "openStoryViewer">;
}

/** Projects only the props this memoized view consumes. */
export function bindConversationHeader(sources: ConversationHeaderSources, activeChat: React.ComponentProps<typeof ConversationHeader>["activeChat"]): React.ComponentProps<typeof ConversationHeader> {
  const { t } = sources.page;
  const { isDesktop } = sources.page.panels;
  const { selectionMode, selectedMessageIds, selectionDeleting, setSelectionDeleteDialogOpen, forwardSending } = sources.page.messageInteraction;
  const { selectedLink, setSelectedLink } = sources.page.selection;
  const { setActiveConversation, setMessages } = sources.page.conversation;
  const { selfProfile } = sources.page.account;
  const { messageSearch } = sources.history;
  const { composerInputThemeStyle, chatHeaderThemeStyle, unreadBadgeThemeStyle } = sources.appearance;
  const { selectedMessages, isEclipseConversation, activeTitle, isSecretChat, isManagedBotConversation, activeStatusIndicatorKind, activeStatusText, activeStatusClass } = sources.presentation;
  const { beginForwardMessages, openActiveDetails } = sources.callbacks;
  const { clearSelectionMode } = sources.messageActions;
  const { suppressRequestedChatSyncRef } = sources.bootstrap.accountNavigation;
  const { otherUnreadNotifications } = sources.directory;
  const { activeChatStoryEntry, openStoryViewer } = sources.stories;
  return {
    "isDesktop": isDesktop,
    "messageSearch": messageSearch,
    "composerInputThemeStyle": composerInputThemeStyle,
    "selectionMode": selectionMode,
    "selectedMessageIds": selectedMessageIds,
    "selectionDeleting": selectionDeleting,
    "setSelectionDeleteDialogOpen": setSelectionDeleteDialogOpen,
    "chatHeaderThemeStyle": chatHeaderThemeStyle,
    "t": t,
    "selectedMessages": selectedMessages,
    "forwardSending": forwardSending,
    "selectedLink": selectedLink,
    "beginForwardMessages": beginForwardMessages,
    "clearSelectionMode": clearSelectionMode,
    "suppressRequestedChatSyncRef": suppressRequestedChatSyncRef,
    "setSelectedLink": setSelectedLink,
    "setActiveConversation": setActiveConversation,
    "setMessages": setMessages,
    "otherUnreadNotifications": otherUnreadNotifications,
    "unreadBadgeThemeStyle": unreadBadgeThemeStyle,
    "openActiveDetails": openActiveDetails,
    "isEclipseConversation": isEclipseConversation,
    "activeTitle": activeTitle,
    "isSecretChat": isSecretChat,
    "activeChat": activeChat,
    "isManagedBotConversation": isManagedBotConversation,
    "activeStatusIndicatorKind": activeStatusIndicatorKind,
    "activeStatusText": activeStatusText,
    "activeStatusClass": activeStatusClass,
    "activeChatStoryEntry": activeChatStoryEntry,
    "openStoryViewer": openStoryViewer,
    "selfProfile": selfProfile
  };
}
