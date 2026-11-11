

import { type ChatSidebar } from "../ChatSidebar";

import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ChatDirectoryModel } from "../controllers/useChatDirectory";
import type { ChatPagePresentationModel } from "../controllers/useChatPagePresentation";
import type { ChatStoriesModel } from "../controllers/useChatStories";
import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { ChatInteractionModel } from "../controllers/useChatInteraction";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ProfileDetailsModel } from "../controllers/useProfileDetails";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";

export interface ChatSidebarSources {
  readonly presentation: Pick<ConversationPresentationModel, "mobileChatOpen">;
  readonly page: Pick<ChatPageStateModel, "reducedPanelMotion" | "settingsPanelOpen" | "settingsPanelCovered" | "chatSearchOpen" | "chatSearchInputRef" | "t" | "otherAccountsUnreadCount" | "chatListMenuOpen" | "setChatListMenuOpen" | "setSettingsPanelOpen" | "router" | "isMobile" | "storyFeed" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs"> & {
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "liveBackgroundPreset" | "chatListHelper" | "setChatListHelper" | "pinnedChatLinkSet" | "mutedChatLinkSet" | "setDirectChatDeleteConfirm">;
    settingsControls: Pick<ChatPageStateModel["settingsControls"], "createChatKind">;
    directorySearch: Pick<ChatPageStateModel["directorySearch"], "chatSearchQuery" | "setChatSearchQuery" | "chatSearchScope" | "setChatSearchScope" | "chatSearchLoading" | "chatSearchError" | "chatSearchSaved" | "chatSearchEclipse" | "chatSearchUsers">;
    directoryMenu: Pick<ChatPageStateModel["directoryMenu"], "chatListMenuPosition" | "chatListMenuOrigin" | "connectedAccounts" | "setIsAccountsExpanded" | "isAccountsExpanded" | "setMenuShowMore" | "menuShowMore">;
    account: Pick<ChatPageStateModel["account"], "selfProfile">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storiesLoading">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "setSelectedLink">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "chatListSuppressClickLinkRef" | "chatListLongPressTimerRef">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "loadingMoreChats" | "hasMoreChats">;

  };
  readonly active: Pick<ActiveConversationModel, "leftSidebarThemeStyle">;
  readonly directory: Pick<ChatDirectoryModel, "closeChatSearchPanel" | "openChatSearchPanel" | "toggleStoriesRail" | "chatSearchNormalizedQuery" | "hasChatSearchResults" | "showSearchSaved" | "openChatSearchResult" | "showSearchEclipse" | "showSearchChats" | "chatSearchLocalResults" | "showSearchUsers" | "visibleChatSearchUsers" | "showSearchGroups" | "visibleChatSearchGroups" | "showSearchChannels" | "visibleChatSearchChannels" | "orderedChats" | "shouldVirtualizeChatList" | "chatListWindow" | "chatListTotalHeight" | "virtualChatRows" | "chatListHelperChat" | "chatListHelperFrame">;
  readonly view: Pick<ChatPagePresentationModel, "sidebarActions" | "showInitialChatListSkeleton">;
  readonly stories: Pick<ChatStoriesModel, "compactStoryGroups" | "selfStoryGroup" | "selfGroupIndex" | "mobileStoryRailGroups" | "openStoryViewer">;
  readonly elements: Pick<ChatElementStateModel, "handleChatListScroll" | "handleChatListWheel" | "handleChatListTouchStart" | "handleChatListTouchMove"> & {
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "storiesHidden" | "storyInputRef">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "chatListViewportRef">;

  };
  readonly interaction: Pick<ChatInteractionModel, "handleChatListTouchEnd" | "clearChatListLongPress" | "toggleChatPinnedState" | "toggleChatMutedState">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache"> & {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "suppressRequestedChatSyncRef">;

  };
  readonly details: Pick<ProfileDetailsModel, "resolveChatListDangerAction" | "openChatListDangerAction">;
  readonly appearance: Pick<ChatAppearanceModel, "unreadBadgeThemeStyle">;
}

/** Projects only the props this memoized view consumes. */
export function bindChatSidebar(sources: ChatSidebarSources): React.ComponentProps<typeof ChatSidebar> {
  const { mobileChatOpen } = sources.presentation;
  const { reducedPanelMotion, settingsPanelOpen, settingsPanelCovered, chatSearchOpen, chatSearchInputRef, t, otherAccountsUnreadCount, chatListMenuOpen, setChatListMenuOpen, setSettingsPanelOpen, router, isMobile, storyFeed, onlineUserIds, lastOfflineAtByUserId, presenceNowTs } = sources.page;
  const { liveBackgroundPreset, chatListHelper, setChatListHelper, pinnedChatLinkSet, mutedChatLinkSet, setDirectChatDeleteConfirm } = sources.page.notificationAndContacts;
  const { createChatKind } = sources.page.settingsControls;
  const { chatSearchQuery, setChatSearchQuery, chatSearchScope, setChatSearchScope, chatSearchLoading, chatSearchError, chatSearchSaved, chatSearchEclipse, chatSearchUsers } = sources.page.directorySearch;
  const { chatListMenuPosition, chatListMenuOrigin, connectedAccounts, setIsAccountsExpanded, isAccountsExpanded, setMenuShowMore, menuShowMore } = sources.page.directoryMenu;
  const { selfProfile } = sources.page.account;
  const { storiesLoading } = sources.page.storyDraft;
  const { selectedLink, setSelectedLink } = sources.page.selection;
  const { chatListSuppressClickLinkRef, chatListLongPressTimerRef } = sources.page.composerInteraction;
  const { loadingMoreChats, hasMoreChats } = sources.page.messageInteraction;
  const { leftSidebarThemeStyle } = sources.active;
  const { closeChatSearchPanel, openChatSearchPanel, toggleStoriesRail, chatSearchNormalizedQuery, hasChatSearchResults, showSearchSaved, openChatSearchResult, showSearchEclipse, showSearchChats, chatSearchLocalResults, showSearchUsers, visibleChatSearchUsers, showSearchGroups, visibleChatSearchGroups, showSearchChannels, visibleChatSearchChannels, orderedChats, shouldVirtualizeChatList, chatListWindow, chatListTotalHeight, virtualChatRows, chatListHelperChat, chatListHelperFrame } = sources.directory;
  const { sidebarActions, showInitialChatListSkeleton } = sources.view;
  const { compactStoryGroups, selfStoryGroup, selfGroupIndex, mobileStoryRailGroups, openStoryViewer } = sources.stories;
  const { handleChatListScroll, handleChatListWheel, handleChatListTouchStart, handleChatListTouchMove } = sources.elements;
  const { storiesHidden, storyInputRef } = sources.elements.storyAndViewport;
  const { chatListViewportRef } = sources.elements.conversationElement;
  const { handleChatListTouchEnd, clearChatListLongPress, toggleChatPinnedState, toggleChatMutedState } = sources.interaction;
  const { readProfileFromCache } = sources.bootstrap;
  const { suppressRequestedChatSyncRef } = sources.bootstrap.accountNavigation;
  const { resolveChatListDangerAction, openChatListDangerAction } = sources.details;
  const { unreadBadgeThemeStyle } = sources.appearance;
  return {
    "mobileChatOpen": mobileChatOpen,
    "reducedPanelMotion": reducedPanelMotion,
    "liveBackgroundPreset": liveBackgroundPreset,
    "chatListHelper": chatListHelper,
    "settingsPanelOpen": settingsPanelOpen,
    "settingsPanelCovered": settingsPanelCovered,
    "createChatKind": createChatKind,
    "leftSidebarThemeStyle": leftSidebarThemeStyle,
    "chatSearchOpen": chatSearchOpen,
    "chatSearchInputRef": chatSearchInputRef,
    "chatSearchQuery": chatSearchQuery,
    "setChatSearchQuery": setChatSearchQuery,
    "t": t,
    "closeChatSearchPanel": closeChatSearchPanel,
    "chatSearchScope": chatSearchScope,
    "setChatSearchScope": setChatSearchScope,
    "toggleChatListMenuFromButton": sidebarActions.toggleChatListMenuFromButton,
    "otherAccountsUnreadCount": otherAccountsUnreadCount,
    "openChatSearchPanel": openChatSearchPanel,
    "compactStoryGroups": compactStoryGroups,
    "toggleStoriesRail": toggleStoriesRail,
    "storiesHidden": storiesHidden,
    "chatListMenuOpen": chatListMenuOpen,
    "setChatListMenuOpen": setChatListMenuOpen,
    "chatListMenuPosition": chatListMenuPosition,
    "chatListMenuOrigin": chatListMenuOrigin,
    "setSettingsPanelOpen": setSettingsPanelOpen,
    "selfProfile": selfProfile,
    "selfStoryGroup": selfStoryGroup,
    "selfGroupIndex": selfGroupIndex,
    "connectedAccounts": connectedAccounts,
    "setIsAccountsExpanded": setIsAccountsExpanded,
    "isAccountsExpanded": isAccountsExpanded,
    "handleSwitchAccount": sidebarActions.handleSwitchAccount,
    "handleAddAccountClick": sidebarActions.handleAddAccountClick,
    "router": router,
    "isMobile": isMobile,
    "storyInputRef": storyInputRef,
    "setMenuShowMore": setMenuShowMore,
    "menuShowMore": menuShowMore,
    "openCreateChat": sidebarActions.openCreateChat,
    "storiesLoading": storiesLoading,
    "storyFeed": storyFeed,
    "mobileStoryRailGroups": mobileStoryRailGroups,
    "openStoryViewer": openStoryViewer,
    "createStoryFromSelection": sidebarActions.createStoryFromSelection,
    "chatListViewportRef": chatListViewportRef,
    "handleChatListScroll": handleChatListScroll,
    "handleChatListWheel": handleChatListWheel,
    "handleChatListTouchStart": handleChatListTouchStart,
    "handleChatListTouchMove": handleChatListTouchMove,
    "handleChatListTouchEnd": handleChatListTouchEnd,
    "chatSearchNormalizedQuery": chatSearchNormalizedQuery,
    "chatSearchLoading": chatSearchLoading,
    "chatSearchError": chatSearchError,
    "hasChatSearchResults": hasChatSearchResults,
    "showSearchSaved": showSearchSaved,
    "chatSearchSaved": chatSearchSaved,
    "openChatSearchResult": openChatSearchResult,
    "selectedLink": selectedLink,
    "showSearchEclipse": showSearchEclipse,
    "chatSearchEclipse": chatSearchEclipse,
    "showSearchChats": showSearchChats,
    "chatSearchLocalResults": chatSearchLocalResults,
    "readProfileFromCache": readProfileFromCache,
    "chatSearchUsers": chatSearchUsers,
    "onlineUserIds": onlineUserIds,
    "lastOfflineAtByUserId": lastOfflineAtByUserId,
    "presenceNowTs": presenceNowTs,
    "showSearchUsers": showSearchUsers,
    "visibleChatSearchUsers": visibleChatSearchUsers,
    "showSearchGroups": showSearchGroups,
    "visibleChatSearchGroups": visibleChatSearchGroups,
    "showSearchChannels": showSearchChannels,
    "visibleChatSearchChannels": visibleChatSearchChannels,
    "showInitialChatListSkeleton": showInitialChatListSkeleton,
    "orderedChats": orderedChats,
    "shouldVirtualizeChatList": shouldVirtualizeChatList,
    "chatListWindow": chatListWindow,
    "chatListTotalHeight": chatListTotalHeight,
    "virtualChatRows": virtualChatRows,
    "chatListSuppressClickLinkRef": chatListSuppressClickLinkRef,
    "suppressRequestedChatSyncRef": suppressRequestedChatSyncRef,
    "setSelectedLink": setSelectedLink,
    "setChatListHelper": setChatListHelper,
    "resolveChatListDangerAction": resolveChatListDangerAction,
    "clearChatListLongPress": clearChatListLongPress,
    "chatListLongPressTimerRef": chatListLongPressTimerRef,
    "unreadBadgeThemeStyle": unreadBadgeThemeStyle,
    "loadingMoreChats": loadingMoreChats,
    "hasMoreChats": hasMoreChats,
    "chatListHelperChat": chatListHelperChat,
    "chatListHelperFrame": chatListHelperFrame,
    "toggleChatPinnedState": toggleChatPinnedState,
    "pinnedChatLinkSet": pinnedChatLinkSet,
    "toggleChatMutedState": toggleChatMutedState,
    "mutedChatLinkSet": mutedChatLinkSet,
    "setDirectChatDeleteConfirm": setDirectChatDeleteConfirm,
    "openChatListDangerAction": openChatListDangerAction
  };
}
