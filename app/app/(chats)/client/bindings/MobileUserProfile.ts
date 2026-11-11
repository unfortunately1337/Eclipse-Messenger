

import { type MobileUserProfile } from "../MobileUserProfile";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ProfileDetailsModel } from "../controllers/useProfileDetails";
import type { ProfileMediaModel } from "../controllers/useProfileMedia";
import type { ChatStoriesModel } from "../controllers/useChatStories";
import type { ChatInteractionModel } from "../controllers/useChatInteraction";
import type { MessageReactionsModel } from "../controllers/useMessageReactions";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface MobileUserProfileSources {
  readonly page: Pick<ChatPageStateModel, "profileModalOpen" | "setProfileModalOpen" | "t" | "detailsPanelMotion" | "profileError" | "profileData" | "profileNavDirection" | "contactDraftDisplayName" | "profileIsBot" | "profileIsSaved" | "handleProfileScroll" | "openAvatarViewer" | "profileIsEclipse" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs"> & {
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    userDetails: Pick<ChatPageStateModel["userDetails"], "profileLoading" | "profileScrollTop" | "setProfileActiveTab" | "profileActiveTab" | "profilePlayingAudioUrl" | "setProfilePlayingAudioUrl">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "profileSubView" | "setProfileSubView" | "setProfileMoreOpen" | "profileMoreOpen">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "contactExists" | "contactSaving" | "setContactEditorTarget" | "setContactFirstName" | "setContactLastName" | "setCollectibleModalUsername" | "contactMessage">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "wallpaperTargetRef" | "wallpaperFileInputRef" | "uploadingWallpaper">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "mutedChatLinkSet">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "setVideoViewer" | "setImageViewer">;

  };
  readonly active: Pick<ActiveConversationModel, "desktopDetailsPanelThemeStyle">;
  readonly details: Pick<ProfileDetailsModel, "renderProfileDetailsSkeleton" | "renderContactEditorContent" | "renderSecretChatPanelContent" | "renderUserProfileActions">;
  readonly callbacks: Pick<ChatPageCallbacks, "saveContact" | "openSecretChatFromProfile">;
  readonly profileMedia: Pick<ProfileMediaModel, "profileHeaderStatusText" | "profileMediaVisible" | "chatSharedFilesList" | "chatSharedVoiceList" | "chatSharedLinksList" | "chatSharedMusicList" | "chatSharedMediaList">;
  readonly stories: Pick<ChatStoriesModel, "storyGroupByAuthorId" | "openStoryViewerByAuthorId">;
  readonly interaction: Pick<ChatInteractionModel, "toggleChatMutedState">;
  readonly reactions: Pick<MessageReactionsModel, "openExternalLinkPrompt">;
}

/** Projects only the props this memoized view consumes. */
export function bindMobileUserProfile(sources: MobileUserProfileSources): React.ComponentProps<typeof MobileUserProfile> {
  const { profileModalOpen, setProfileModalOpen, t, detailsPanelMotion, profileError, profileData, profileNavDirection, contactDraftDisplayName, profileIsBot, profileIsSaved, handleProfileScroll, openAvatarViewer, profileIsEclipse, onlineUserIds, lastOfflineAtByUserId, presenceNowTs } = sources.page;
  const { isDesktop } = sources.page.panels;
  const { profileLoading, profileScrollTop, setProfileActiveTab, profileActiveTab, profilePlayingAudioUrl, setProfilePlayingAudioUrl } = sources.page.userDetails;
  const { profileSubView, setProfileSubView, setProfileMoreOpen, profileMoreOpen } = sources.page.profileNavigation;
  const { contactExists, contactSaving, setContactEditorTarget, setContactFirstName, setContactLastName, setCollectibleModalUsername, contactMessage } = sources.page.contactEditor;
  const { selfId, selfProfile } = sources.page.account;
  const { wallpaperTargetRef, wallpaperFileInputRef, uploadingWallpaper } = sources.page.wallpaperUpload;
  const { mutedChatLinkSet } = sources.page.notificationAndContacts;
  const { setVideoViewer, setImageViewer } = sources.page.mediaAndChannel;
  const { desktopDetailsPanelThemeStyle } = sources.active;
  const { renderProfileDetailsSkeleton, renderContactEditorContent, renderSecretChatPanelContent, renderUserProfileActions } = sources.details;
  const { saveContact, openSecretChatFromProfile } = sources.callbacks;
  const { profileHeaderStatusText, profileMediaVisible, chatSharedFilesList, chatSharedVoiceList, chatSharedLinksList, chatSharedMusicList, chatSharedMediaList } = sources.profileMedia;
  const { storyGroupByAuthorId, openStoryViewerByAuthorId } = sources.stories;
  const { toggleChatMutedState } = sources.interaction;
  const { openExternalLinkPrompt } = sources.reactions;
  return {
    "isDesktop": isDesktop,
    "profileModalOpen": profileModalOpen,
    "setProfileModalOpen": setProfileModalOpen,
    "t": t,
    "detailsPanelMotion": detailsPanelMotion,
    "desktopDetailsPanelThemeStyle": desktopDetailsPanelThemeStyle,
    "profileLoading": profileLoading,
    "renderProfileDetailsSkeleton": renderProfileDetailsSkeleton,
    "profileError": profileError,
    "profileData": profileData,
    "profileNavDirection": profileNavDirection,
    "profileSubView": profileSubView,
    "contactExists": contactExists,
    "contactDraftDisplayName": contactDraftDisplayName,
    "setProfileSubView": setProfileSubView,
    "saveContact": saveContact,
    "contactSaving": contactSaving,
    "renderContactEditorContent": renderContactEditorContent,
    "renderSecretChatPanelContent": renderSecretChatPanelContent,
    "profileScrollTop": profileScrollTop,
    "profileHeaderStatusText": profileHeaderStatusText,
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
    "contactMessage": contactMessage,
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
    "setImageViewer": setImageViewer
  };
}
