

import { type MobileChannelProfile } from "../MobileChannelProfile";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ProfileDetailsModel } from "../controllers/useProfileDetails";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface MobileChannelProfileSources {
  readonly page: Pick<ChatPageStateModel, "t" | "detailsPanelMotion" | "channelNavDirection" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs" | "openAvatarViewer"> & {
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalOpen" | "setChannelModalOpen" | "channelModalLoading" | "channelModalError" | "channelModalData" | "channelSubView" | "setChannelSubView" | "channelSaving" | "channelMembersReturnViewRef" | "memberSearchQuery" | "setMemberSearchQuery" | "addingMembers" | "selectedContactIds" | "addMembersContactQuery" | "setAddMembersContactQuery" | "addMembersContactsLoading" | "contactsForAdd" | "setSelectedContactIds" | "channelNameDraft" | "channelAvatarDraft">;
    account: Pick<ChatPageStateModel["account"], "selfId">;

  };
  readonly active: Pick<ActiveConversationModel, "desktopDetailsPanelThemeStyle">;
  readonly callbacks: Pick<ChatPageCallbacks, "renderCommunityReactions" | "renderCommunityType" | "saveChannelSettings" | "renderCommunitySettings" | "openAddMembersModal" | "memberLongPress" | "openCommunityProfile" | "closeAddMembersView" | "submitAddCommunityMembers">;
  readonly details: Pick<ProfileDetailsModel, "isChannelDirty" | "renderCommunityProfileActions" | "renderCommunitySharedTabs">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache">;
}

/** Projects only the props this memoized view consumes. */
export function bindMobileChannelProfile(sources: MobileChannelProfileSources): React.ComponentProps<typeof MobileChannelProfile> {
  const { t, detailsPanelMotion, channelNavDirection, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, openAvatarViewer } = sources.page;
  const { isDesktop } = sources.page.panels;
  const { channelModalOpen, setChannelModalOpen, channelModalLoading, channelModalError, channelModalData, channelSubView, setChannelSubView, channelSaving, channelMembersReturnViewRef, memberSearchQuery, setMemberSearchQuery, addingMembers, selectedContactIds, addMembersContactQuery, setAddMembersContactQuery, addMembersContactsLoading, contactsForAdd, setSelectedContactIds, channelNameDraft, channelAvatarDraft } = sources.page.mediaAndChannel;
  const { selfId } = sources.page.account;
  const { desktopDetailsPanelThemeStyle } = sources.active;
  const { renderCommunityReactions, renderCommunityType, saveChannelSettings, renderCommunitySettings, openAddMembersModal, memberLongPress, openCommunityProfile, closeAddMembersView, submitAddCommunityMembers } = sources.callbacks;
  const { isChannelDirty, renderCommunityProfileActions, renderCommunitySharedTabs } = sources.details;
  const { readProfileFromCache } = sources.bootstrap;
  return {
    "isDesktop": isDesktop,
    "channelModalOpen": channelModalOpen,
    "setChannelModalOpen": setChannelModalOpen,
    "t": t,
    "desktopDetailsPanelThemeStyle": desktopDetailsPanelThemeStyle,
    "detailsPanelMotion": detailsPanelMotion,
    "channelModalLoading": channelModalLoading,
    "channelModalError": channelModalError,
    "channelModalData": channelModalData,
    "channelNavDirection": channelNavDirection,
    "channelSubView": channelSubView,
    "renderCommunityReactions": renderCommunityReactions,
    "renderCommunityType": renderCommunityType,
    "setChannelSubView": setChannelSubView,
    "isChannelDirty": isChannelDirty,
    "saveChannelSettings": saveChannelSettings,
    "channelSaving": channelSaving,
    "renderCommunitySettings": renderCommunitySettings,
    "channelMembersReturnViewRef": channelMembersReturnViewRef,
    "openAddMembersModal": openAddMembersModal,
    "memberSearchQuery": memberSearchQuery,
    "setMemberSearchQuery": setMemberSearchQuery,
    "memberLongPress": memberLongPress,
    "openCommunityProfile": openCommunityProfile,
    "onlineUserIds": onlineUserIds,
    "lastOfflineAtByUserId": lastOfflineAtByUserId,
    "presenceNowTs": presenceNowTs,
    "selfId": selfId,
    "readProfileFromCache": readProfileFromCache,
    "closeAddMembersView": closeAddMembersView,
    "submitAddCommunityMembers": submitAddCommunityMembers,
    "addingMembers": addingMembers,
    "selectedContactIds": selectedContactIds,
    "addMembersContactQuery": addMembersContactQuery,
    "setAddMembersContactQuery": setAddMembersContactQuery,
    "addMembersContactsLoading": addMembersContactsLoading,
    "contactsForAdd": contactsForAdd,
    "setSelectedContactIds": setSelectedContactIds,
    "channelNameDraft": channelNameDraft,
    "channelAvatarDraft": channelAvatarDraft,
    "openAvatarViewer": openAvatarViewer,
    "renderCommunityProfileActions": renderCommunityProfileActions,
    "renderCommunitySharedTabs": renderCommunitySharedTabs
  };
}
