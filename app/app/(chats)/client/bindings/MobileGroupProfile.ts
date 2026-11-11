

import { type MobileGroupProfile } from "../MobileGroupProfile";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ProfileDetailsModel } from "../controllers/useProfileDetails";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatAppearanceModel } from "../controllers/useChatAppearance";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface MobileGroupProfileSources {
  readonly page: Pick<ChatPageStateModel, "t" | "detailsPanelMotion" | "groupNavDirection" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs" | "openAvatarViewer"> & {
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "groupModalOpen" | "setGroupModalOpen" | "groupModalLoading" | "groupModalError" | "groupModalData" | "groupSubView" | "setGroupSubView" | "groupMembersReturnViewRef" | "groupSaving" | "groupNameDraft" | "groupAvatarDraft">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "memberSearchQuery" | "setMemberSearchQuery" | "addingMembers" | "selectedContactIds" | "addMembersContactQuery" | "setAddMembersContactQuery" | "addMembersContactsLoading" | "contactsForAdd" | "setSelectedContactIds">;
    account: Pick<ChatPageStateModel["account"], "selfId">;

  };
  readonly active: Pick<ActiveConversationModel, "desktopDetailsPanelThemeStyle">;
  readonly details: Pick<ProfileDetailsModel, "canManageGroup" | "isGroupDirty" | "renderCommunityProfileActions" | "renderCommunitySharedTabs">;
  readonly callbacks: Pick<ChatPageCallbacks, "openAddMembersModal" | "memberLongPress" | "openCommunityProfile" | "renderCommunityReactions" | "renderCommunityType" | "saveGroupSettings" | "renderCommunitySettings" | "closeAddMembersView" | "submitAddCommunityMembers">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache">;
  readonly appearance: Pick<ChatAppearanceModel, "chatProfileSectionThemeStyle">;
}

/** Projects only the props this memoized view consumes. */
export function bindMobileGroupProfile(sources: MobileGroupProfileSources): React.ComponentProps<typeof MobileGroupProfile> {
  const { t, detailsPanelMotion, groupNavDirection, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, openAvatarViewer } = sources.page;
  const { isDesktop } = sources.page.panels;
  const { groupModalOpen, setGroupModalOpen, groupModalLoading, groupModalError, groupModalData, groupSubView, setGroupSubView, groupMembersReturnViewRef, groupSaving, groupNameDraft, groupAvatarDraft } = sources.page.groupDetails;
  const { memberSearchQuery, setMemberSearchQuery, addingMembers, selectedContactIds, addMembersContactQuery, setAddMembersContactQuery, addMembersContactsLoading, contactsForAdd, setSelectedContactIds } = sources.page.mediaAndChannel;
  const { selfId } = sources.page.account;
  const { desktopDetailsPanelThemeStyle } = sources.active;
  const { canManageGroup, isGroupDirty, renderCommunityProfileActions, renderCommunitySharedTabs } = sources.details;
  const { openAddMembersModal, memberLongPress, openCommunityProfile, renderCommunityReactions, renderCommunityType, saveGroupSettings, renderCommunitySettings, closeAddMembersView, submitAddCommunityMembers } = sources.callbacks;
  const { readProfileFromCache } = sources.bootstrap;
  const { chatProfileSectionThemeStyle } = sources.appearance;
  return {
    "isDesktop": isDesktop,
    "groupModalOpen": groupModalOpen,
    "setGroupModalOpen": setGroupModalOpen,
    "t": t,
    "desktopDetailsPanelThemeStyle": desktopDetailsPanelThemeStyle,
    "detailsPanelMotion": detailsPanelMotion,
    "groupModalLoading": groupModalLoading,
    "groupModalError": groupModalError,
    "groupModalData": groupModalData,
    "groupNavDirection": groupNavDirection,
    "groupSubView": groupSubView,
    "setGroupSubView": setGroupSubView,
    "groupMembersReturnViewRef": groupMembersReturnViewRef,
    "canManageGroup": canManageGroup,
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
    "renderCommunityReactions": renderCommunityReactions,
    "renderCommunityType": renderCommunityType,
    "isGroupDirty": isGroupDirty,
    "saveGroupSettings": saveGroupSettings,
    "groupSaving": groupSaving,
    "renderCommunitySettings": renderCommunitySettings,
    "closeAddMembersView": closeAddMembersView,
    "submitAddCommunityMembers": submitAddCommunityMembers,
    "addingMembers": addingMembers,
    "selectedContactIds": selectedContactIds,
    "addMembersContactQuery": addMembersContactQuery,
    "setAddMembersContactQuery": setAddMembersContactQuery,
    "addMembersContactsLoading": addMembersContactsLoading,
    "contactsForAdd": contactsForAdd,
    "setSelectedContactIds": setSelectedContactIds,
    "groupNameDraft": groupNameDraft,
    "groupAvatarDraft": groupAvatarDraft,
    "openAvatarViewer": openAvatarViewer,
    "renderCommunityProfileActions": renderCommunityProfileActions,
    "chatProfileSectionThemeStyle": chatProfileSectionThemeStyle,
    "renderCommunitySharedTabs": renderCommunitySharedTabs
  };
}
