

import { type DesktopDetailsPanel } from "../DesktopDetailsPanel";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ProfileMediaModel } from "../controllers/useProfileMedia";
import type { ProfileDetailsModel } from "../controllers/useProfileDetails";
import type { ChatStoriesModel } from "../controllers/useChatStories";
import type { ChatInteractionModel } from "../controllers/useChatInteraction";
import type { MessageReactionsModel } from "../controllers/useMessageReactions";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface DesktopDetailsPanelSources {
  readonly page: Pick<ChatPageStateModel, "detailsPanelMotion" | "t" | "profileData" | "contactDraftDisplayName" | "profileIsBot" | "profileIsSaved" | "handleProfileScroll" | "profileNavDirection" | "openAvatarViewer" | "profileIsEclipse" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs" | "profileError" | "groupNavDirection" | "channelNavDirection"> & {
    panels: Pick<ChatPageStateModel["panels"], "desktopDetailsPanelOpen" | "inspectedDetailsEntity" | "setDesktopDetailsPanelOpen" | "setInspectedDetailsEntity">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "liveBackgroundPreset" | "mutedChatLinkSet">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "profileSubView" | "setProfileSubView" | "setProfileMoreOpen" | "profileMoreOpen">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "groupSubView" | "setGroupSubView" | "groupMembersReturnViewRef" | "groupSaving" | "reactionSettingsDraft" | "groupModalLoading" | "groupModalData" | "groupNameDraft" | "groupAvatarDraft" | "groupModalError">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelSubView" | "setChannelSubView" | "channelMembersReturnViewRef" | "channelSaving" | "channelModalData" | "addingMembers" | "selectedContactIds" | "setVideoViewer" | "setImageViewer" | "memberSearchQuery" | "setMemberSearchQuery" | "addMembersContactQuery" | "setAddMembersContactQuery" | "addMembersContactsLoading" | "contactsForAdd" | "setSelectedContactIds" | "channelModalLoading" | "channelNameDraft" | "channelAvatarDraft" | "channelModalError">;
    userDetails: Pick<ChatPageStateModel["userDetails"], "profileScrollTop" | "profileLoading" | "setProfileActiveTab" | "profileActiveTab" | "profilePlayingAudioUrl" | "setProfilePlayingAudioUrl">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "contactExists" | "contactSaving" | "setContactEditorTarget" | "setContactFirstName" | "setContactLastName" | "setCollectibleModalUsername">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "wallpaperTargetRef" | "wallpaperFileInputRef" | "uploadingWallpaper">;

  };
  readonly active: Pick<ActiveConversationModel, "desktopDetailsPanelThemeStyle" | "activeChat">;
  readonly presentation: Pick<ConversationPresentationModel, "effectiveDetailsChatType">;
  readonly callbacks: Pick<ChatPageCallbacks, "closeAddMembersView" | "saveCommunityReactions" | "saveCommunityType" | "saveGroupSettings" | "saveChannelSettings" | "submitAddCommunityMembers" | "openAddMembersModal" | "saveContact" | "openSecretChatFromProfile" | "renderCommunityReactions" | "renderCommunityType" | "renderCommunitySettings" | "memberLongPress" | "openCommunityProfile">;
  readonly profileMedia: Pick<ProfileMediaModel, "profileHeaderStatusText" | "profileMediaVisible" | "chatSharedFilesList" | "chatSharedVoiceList" | "chatSharedLinksList" | "chatSharedMusicList" | "chatSharedMediaList">;
  readonly details: Pick<ProfileDetailsModel, "canManageGroup" | "isGroupDirty" | "isChannelDirty" | "renderProfileDetailsSkeleton" | "renderContactEditorContent" | "renderSecretChatPanelContent" | "renderUserProfileActions" | "renderCommunityProfileActions" | "renderCommunitySharedTabs">;
  readonly stories: Pick<ChatStoriesModel, "storyGroupByAuthorId" | "openStoryViewerByAuthorId">;
  readonly interaction: Pick<ChatInteractionModel, "toggleChatMutedState">;
  readonly reactions: Pick<MessageReactionsModel, "openExternalLinkPrompt">;
  readonly bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache">;
}

/** Projects only the props this memoized view consumes. */
export function bindDesktopDetailsPanel(sources: DesktopDetailsPanelSources): React.ComponentProps<typeof DesktopDetailsPanel> {
  const { detailsPanelMotion, t, profileData, contactDraftDisplayName, profileIsBot, profileIsSaved, handleProfileScroll, profileNavDirection, openAvatarViewer, profileIsEclipse, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, profileError, groupNavDirection, channelNavDirection } = sources.page;
  const { desktopDetailsPanelOpen, inspectedDetailsEntity, setDesktopDetailsPanelOpen, setInspectedDetailsEntity } = sources.page.panels;
  const { liveBackgroundPreset, mutedChatLinkSet } = sources.page.notificationAndContacts;
  const { profileSubView, setProfileSubView, setProfileMoreOpen, profileMoreOpen } = sources.page.profileNavigation;
  const { groupSubView, setGroupSubView, groupMembersReturnViewRef, groupSaving, reactionSettingsDraft, groupModalLoading, groupModalData, groupNameDraft, groupAvatarDraft, groupModalError } = sources.page.groupDetails;
  const { channelSubView, setChannelSubView, channelMembersReturnViewRef, channelSaving, channelModalData, addingMembers, selectedContactIds, setVideoViewer, setImageViewer, memberSearchQuery, setMemberSearchQuery, addMembersContactQuery, setAddMembersContactQuery, addMembersContactsLoading, contactsForAdd, setSelectedContactIds, channelModalLoading, channelNameDraft, channelAvatarDraft, channelModalError } = sources.page.mediaAndChannel;
  const { profileScrollTop, profileLoading, setProfileActiveTab, profileActiveTab, profilePlayingAudioUrl, setProfilePlayingAudioUrl } = sources.page.userDetails;
  const { contactExists, contactSaving, setContactEditorTarget, setContactFirstName, setContactLastName, setCollectibleModalUsername } = sources.page.contactEditor;
  const { selfId, selfProfile } = sources.page.account;
  const { wallpaperTargetRef, wallpaperFileInputRef, uploadingWallpaper } = sources.page.wallpaperUpload;
  const { desktopDetailsPanelThemeStyle, activeChat } = sources.active;
  const { effectiveDetailsChatType } = sources.presentation;
  const { closeAddMembersView, saveCommunityReactions, saveCommunityType, saveGroupSettings, saveChannelSettings, submitAddCommunityMembers, openAddMembersModal, saveContact, openSecretChatFromProfile, renderCommunityReactions, renderCommunityType, renderCommunitySettings, memberLongPress, openCommunityProfile } = sources.callbacks;
  const { profileHeaderStatusText, profileMediaVisible, chatSharedFilesList, chatSharedVoiceList, chatSharedLinksList, chatSharedMusicList, chatSharedMediaList } = sources.profileMedia;
  const { canManageGroup, isGroupDirty, isChannelDirty, renderProfileDetailsSkeleton, renderContactEditorContent, renderSecretChatPanelContent, renderUserProfileActions, renderCommunityProfileActions, renderCommunitySharedTabs } = sources.details;
  const { storyGroupByAuthorId, openStoryViewerByAuthorId } = sources.stories;
  const { toggleChatMutedState } = sources.interaction;
  const { openExternalLinkPrompt } = sources.reactions;
  const { readProfileFromCache } = sources.bootstrap;
  return {
    "desktopDetailsPanelOpen": desktopDetailsPanelOpen,
    "liveBackgroundPreset": liveBackgroundPreset,
    "desktopDetailsPanelThemeStyle": desktopDetailsPanelThemeStyle,
    "detailsPanelMotion": detailsPanelMotion,
    "profileSubView": profileSubView,
    "groupSubView": groupSubView,
    "channelSubView": channelSubView,
    "effectiveDetailsChatType": effectiveDetailsChatType,
    "profileScrollTop": profileScrollTop,
    "inspectedDetailsEntity": inspectedDetailsEntity,
    "activeChat": activeChat,
    "setProfileSubView": setProfileSubView,
    "setGroupSubView": setGroupSubView,
    "groupMembersReturnViewRef": groupMembersReturnViewRef,
    "closeAddMembersView": closeAddMembersView,
    "setChannelSubView": setChannelSubView,
    "channelMembersReturnViewRef": channelMembersReturnViewRef,
    "t": t,
    "setDesktopDetailsPanelOpen": setDesktopDetailsPanelOpen,
    "setInspectedDetailsEntity": setInspectedDetailsEntity,
    "profileData": profileData,
    "contactExists": contactExists,
    "contactDraftDisplayName": contactDraftDisplayName,
    "profileHeaderStatusText": profileHeaderStatusText,
    "saveCommunityReactions": saveCommunityReactions,
    "groupSaving": groupSaving,
    "channelSaving": channelSaving,
    "reactionSettingsDraft": reactionSettingsDraft,
    "saveCommunityType": saveCommunityType,
    "canManageGroup": canManageGroup,
    "isGroupDirty": isGroupDirty,
    "saveGroupSettings": saveGroupSettings,
    "channelModalData": channelModalData,
    "isChannelDirty": isChannelDirty,
    "saveChannelSettings": saveChannelSettings,
    "submitAddCommunityMembers": submitAddCommunityMembers,
    "addingMembers": addingMembers,
    "selectedContactIds": selectedContactIds,
    "openAddMembersModal": openAddMembersModal,
    "saveContact": saveContact,
    "contactSaving": contactSaving,
    "profileIsBot": profileIsBot,
    "profileIsSaved": profileIsSaved,
    "selfId": selfId,
    "setContactEditorTarget": setContactEditorTarget,
    "setContactFirstName": setContactFirstName,
    "setContactLastName": setContactLastName,
    "setProfileMoreOpen": setProfileMoreOpen,
    "profileMoreOpen": profileMoreOpen,
    "wallpaperTargetRef": wallpaperTargetRef,
    "wallpaperFileInputRef": wallpaperFileInputRef,
    "uploadingWallpaper": uploadingWallpaper,
    "openSecretChatFromProfile": openSecretChatFromProfile,
    "handleProfileScroll": handleProfileScroll,
    "profileLoading": profileLoading,
    "renderProfileDetailsSkeleton": renderProfileDetailsSkeleton,
    "profileNavDirection": profileNavDirection,
    "renderContactEditorContent": renderContactEditorContent,
    "renderSecretChatPanelContent": renderSecretChatPanelContent,
    "storyGroupByAuthorId": storyGroupByAuthorId,
    "openStoryViewerByAuthorId": openStoryViewerByAuthorId,
    "openAvatarViewer": openAvatarViewer,
    "profileIsEclipse": profileIsEclipse,
    "selfProfile": selfProfile,
    "onlineUserIds": onlineUserIds,
    "lastOfflineAtByUserId": lastOfflineAtByUserId,
    "presenceNowTs": presenceNowTs,
    "renderUserProfileActions": renderUserProfileActions,
    "setCollectibleModalUsername": setCollectibleModalUsername,
    "toggleChatMutedState": toggleChatMutedState,
    "mutedChatLinkSet": mutedChatLinkSet,
    "setProfileActiveTab": setProfileActiveTab,
    "profileActiveTab": profileActiveTab,
    "profileMediaVisible": profileMediaVisible,
    "chatSharedFilesList": chatSharedFilesList,
    "chatSharedVoiceList": chatSharedVoiceList,
    "profilePlayingAudioUrl": profilePlayingAudioUrl,
    "setProfilePlayingAudioUrl": setProfilePlayingAudioUrl,
    "chatSharedLinksList": chatSharedLinksList,
    "openExternalLinkPrompt": openExternalLinkPrompt,
    "chatSharedMusicList": chatSharedMusicList,
    "chatSharedMediaList": chatSharedMediaList,
    "setVideoViewer": setVideoViewer,
    "setImageViewer": setImageViewer,
    "profileError": profileError,
    "groupModalLoading": groupModalLoading,
    "groupModalData": groupModalData,
    "groupNavDirection": groupNavDirection,
    "renderCommunityReactions": renderCommunityReactions,
    "renderCommunityType": renderCommunityType,
    "renderCommunitySettings": renderCommunitySettings,
    "memberLongPress": memberLongPress,
    "openCommunityProfile": openCommunityProfile,
    "readProfileFromCache": readProfileFromCache,
    "memberSearchQuery": memberSearchQuery,
    "setMemberSearchQuery": setMemberSearchQuery,
    "addMembersContactQuery": addMembersContactQuery,
    "setAddMembersContactQuery": setAddMembersContactQuery,
    "addMembersContactsLoading": addMembersContactsLoading,
    "contactsForAdd": contactsForAdd,
    "setSelectedContactIds": setSelectedContactIds,
    "groupNameDraft": groupNameDraft,
    "groupAvatarDraft": groupAvatarDraft,
    "renderCommunityProfileActions": renderCommunityProfileActions,
    "renderCommunitySharedTabs": renderCommunitySharedTabs,
    "groupModalError": groupModalError,
    "channelModalLoading": channelModalLoading,
    "channelNavDirection": channelNavDirection,
    "channelNameDraft": channelNameDraft,
    "channelAvatarDraft": channelAvatarDraft,
    "channelModalError": channelModalError
  };
}
