"use client";

import { useCallback, useEffect, useMemo } from "react";

import UserProfileActions from "../../components/common/UserProfileActions";
import CommunityProfileActions from "../../components/common/CommunityProfileActions";

import { apiRequest } from "@/lib/client/http";

import { collectLegacyMediaUrls, markLegacyMediaRestored } from "@/lib/client/media-crypto";

import { type ConversationChatType } from "../../types";

import { legacyMediaGrantAttempts } from "../chat-cache";

import { openChatListDangerActionAction, resolveChatListDangerActionAction, loadDesktopDetails } from "../community-actions";
import { renderCommunitySharedTabsView, renderContactEditorContentView, renderSecretChatTimerControlsView } from "../profile-renderers";
import { renderSecretChatPanelContentView, loadStoriesAction } from "../story-actions";

import type { ChatPageStateModel } from "./useChatPageState";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ProfileMediaModel } from "./useProfileMedia";
import type { MessageReactionsModel } from "./useMessageReactions";
import type { ChatInteractionModel } from "./useChatInteraction";
import type { ConversationActionsModel } from "./useConversationActions";
import type { ChatDirectoryModel } from "./useChatDirectory";
import type { MessageHistoryModel } from "./useMessageHistory";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ProfileDetailsSources {
  page: Pick<ChatPageStateModel, "t" | "setProfileData" | "setProfileError" | "onlineUserIds" | "lastOfflineAtByUserId" | "presenceNowTs" | "setProfileModalOpen" | "transparentVisual" | "profileData" | "profileIsBot" | "profileIsSaved" | "contactDraftDisplayName" | "storyFeed"> & {
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "setChannelModalData" | "setChannelDangerAction" | "setGroupDangerAction" | "setChannelModalError" | "setChannelNameDraft" | "setChannelAvatarDraft" | "setChannelModalLoading" | "memberSearchQuery" | "setMemberSearchQuery" | "setVideoViewer" | "setImageViewer" | "setChannelModalOpen" | "channelModalData" | "setChannelSubView" | "channelNameDraft" | "channelAvatarDraft" | "channelDescriptionDraft">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "setGroupModalData" | "setGroupModalError" | "setGroupNameDraft" | "setGroupAvatarDraft" | "setGroupModalLoading" | "groupModalData" | "groupModalOpen" | "groupModalLoading" | "setGroupModalOpen" | "setGroupSubView" | "groupNameDraft" | "groupAvatarDraft" | "groupDescriptionDraft">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "setChatListHelper" | "mutedChatLinkSet" | "liveBackgroundPreset">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop" | "desktopDetailsPanelOpen" | "inspectedDetailsEntity" | "setDesktopDetailsPanelOpen" | "setInspectedDetailsEntity">;
    userDetails: Pick<ChatPageStateModel["userDetails"], "setProfileActiveTab" | "setProfileLoading" | "profileActiveTab" | "profilePlayingAudioUrl" | "setProfilePlayingAudioUrl">;
    account: Pick<ChatPageStateModel["account"], "selfId">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "setContactEditorTarget" | "setContactExists" | "setContactFirstName" | "setContactLastName" | "setContactEditorInitial" | "setContactMessage" | "contactEditorTarget" | "contactFirstName" | "contactLastName" | "contactExists" | "contactSaving" | "contactMessage">;
    conversation: Pick<ChatPageStateModel["conversation"], "setChats" | "setActiveConversation" | "activeConversation" | "setAttachmentMenuOpen" | "messages">;
    appearance: Pick<ChatPageStateModel["appearance"], "setMessageHelperId">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "setStickerPickerOpen">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "uploadingWallpaper" | "wallpaperTargetRef" | "wallpaperFileInputRef">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "profileOpenedExternally" | "setProfileSubView">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "secretChatLifetimeDays" | "secretChatLifetimeHours" | "secretChatLifetimeMinutes" | "setSecretChatLifetimeDays" | "setSecretChatLifetimeHours" | "setSecretChatLifetimeMinutes" | "secretChatCodeword" | "setSecretChatCodeword" | "secretChatCreating" | "secretChatSelectedUserIds" | "setSecretChatInfoOpen">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryFeed" | "setStoriesLoading" | "storyFeedLoadPromiseRef" | "storyFeedLoadIsForceRef" | "skipNextInitialStoriesReloadRef">;

  };
  active: Pick<ActiveConversationModel, "activeChat" | "calls">;
  presentation: Pick<ConversationPresentationModel, "activeDetailsChatType">;
  elements: {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "groupModalCacheRef" | "groupDetailsInFlightRef" | "channelModalCacheRef" | "channelDetailsInFlightRef">;

  };
  bootstrap: Pick<ChatBootstrapModel, "activeGroupModalSeed" | "activeChannelModalSeed" | "readProfileFromCache">;
  profileMedia: Pick<ProfileMediaModel, "profileMediaVisible" | "chatSharedFilesList" | "chatSharedVoiceList" | "chatSharedLinksList" | "chatSharedMusicList" | "chatSharedMediaList">;
  callbacks: Pick<ChatPageCallbacks, "openAddMembersModal" | "memberLongPress" | "openCommunityProfile" | "openSecretChatFromProfile" | "removeContact" | "submitCreateSecretChat">;
  reactions: Pick<MessageReactionsModel, "openExternalLinkPrompt">;
  interaction: Pick<ChatInteractionModel, "interruptMessageAutoScroll" | "toggleChatMutedState">;
  messageActions: Pick<ConversationActionsModel, "clearSelectionMode">;
  directory: Pick<ChatDirectoryModel, "openChatSearchResult">;
  history: Pick<MessageHistoryModel, "messageSearch">;
}

export interface ProfileDetailsModel {
  openChatListDangerAction: (chat: {
    link: string;
    chatType: import("@/app/app/(chats)/types").ConversationChatType;

  }) => Promise<void>;
  resolveChatListDangerAction: (chat: {
    link: string;
    chatType: import("@/app/app/(chats)/types").ConversationChatType;

  }) => Promise<void>;
  canManageGroup: boolean;
  renderCommunitySharedTabs: (includeVoice?: boolean) => React.JSX.Element;
  renderCommunityProfileActions: (kind: "group" | "channel") => React.JSX.Element | null;
  renderUserProfileActions: () => React.JSX.Element | null;
  renderProfileDetailsSkeleton: () => React.JSX.Element;
  renderContactEditorContent: () => React.JSX.Element | null;
  renderSecretChatPanelContent: () => React.JSX.Element;
  isGroupDirty: boolean;
  isChannelDirty: boolean;
  loadStories: (forceRefresh?: boolean) => Promise<void>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useProfileDetails(sources: ProfileDetailsSources): ProfileDetailsModel {
  const { t, setProfileData, setProfileError, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, setProfileModalOpen, transparentVisual, profileData, profileIsBot, profileIsSaved, contactDraftDisplayName, storyFeed } = sources.page;
  const { setChannelModalData, setChannelDangerAction, setGroupDangerAction, setChannelModalError, setChannelNameDraft, setChannelAvatarDraft, setChannelModalLoading, memberSearchQuery, setMemberSearchQuery, setVideoViewer, setImageViewer, setChannelModalOpen, channelModalData, setChannelSubView, channelNameDraft, channelAvatarDraft, channelDescriptionDraft } = sources.page.mediaAndChannel;
  const { setGroupModalData, setGroupModalError, setGroupNameDraft, setGroupAvatarDraft, setGroupModalLoading, groupModalData, groupModalOpen, groupModalLoading, setGroupModalOpen, setGroupSubView, groupNameDraft, groupAvatarDraft, groupDescriptionDraft } = sources.page.groupDetails;
  const { setChatListHelper, mutedChatLinkSet, liveBackgroundPreset } = sources.page.notificationAndContacts;
  const { isDesktop, desktopDetailsPanelOpen, inspectedDetailsEntity, setDesktopDetailsPanelOpen, setInspectedDetailsEntity } = sources.page.panels;
  const { setProfileActiveTab, setProfileLoading, profileActiveTab, profilePlayingAudioUrl, setProfilePlayingAudioUrl } = sources.page.userDetails;
  const { selfId } = sources.page.account;
  const { setContactEditorTarget, setContactExists, setContactFirstName, setContactLastName, setContactEditorInitial, setContactMessage, contactEditorTarget, contactFirstName, contactLastName, contactExists, contactSaving, contactMessage } = sources.page.contactEditor;
  const { setChats, setActiveConversation, activeConversation, setAttachmentMenuOpen, messages } = sources.page.conversation;
  const { setMessageHelperId } = sources.page.appearance;
  const { setStickerPickerOpen } = sources.page.attachmentDraft;
  const { selectedLink } = sources.page.selection;
  const { uploadingWallpaper, wallpaperTargetRef, wallpaperFileInputRef } = sources.page.wallpaperUpload;
  const { profileOpenedExternally, setProfileSubView } = sources.page.profileNavigation;
  const { secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, setSecretChatLifetimeDays, setSecretChatLifetimeHours, setSecretChatLifetimeMinutes, secretChatCodeword, setSecretChatCodeword, secretChatCreating, secretChatSelectedUserIds, setSecretChatInfoOpen } = sources.page.secretChatDraft;
  const { setStoryFeed, setStoriesLoading, storyFeedLoadPromiseRef, storyFeedLoadIsForceRef, skipNextInitialStoriesReloadRef } = sources.page.storyDraft;
  const { activeChat, calls } = sources.active;
  const { activeDetailsChatType } = sources.presentation;
  const { groupModalCacheRef, groupDetailsInFlightRef, channelModalCacheRef, channelDetailsInFlightRef } = sources.elements.conversationElement;
  const { activeGroupModalSeed, activeChannelModalSeed, readProfileFromCache } = sources.bootstrap;
  const { profileMediaVisible, chatSharedFilesList, chatSharedVoiceList, chatSharedLinksList, chatSharedMusicList, chatSharedMediaList } = sources.profileMedia;
  const { openAddMembersModal, memberLongPress, openCommunityProfile, openSecretChatFromProfile, removeContact, submitCreateSecretChat } = sources.callbacks;
  const { openExternalLinkPrompt } = sources.reactions;
  const { interruptMessageAutoScroll, toggleChatMutedState } = sources.interaction;
  const { clearSelectionMode } = sources.messageActions;
  const { openChatSearchResult } = sources.directory;
  const { messageSearch } = sources.history;

  const openChatListDangerAction = useCallback(async (chat: {
    link: string;
    chatType: ConversationChatType

  }) => {
    return openChatListDangerActionAction({ setChannelModalData, setChannelDangerAction, setGroupModalData, setGroupDangerAction }, chat);
  }, []);

  const resolveChatListDangerAction = useCallback(async (chat: {
    link: string;
    chatType: ConversationChatType

  }) => {
    return resolveChatListDangerActionAction({ setChatListHelper }, chat);
  }, []);

  const activeDetailsLink = activeChat?.link ?? null;

  useEffect(() => {
    return loadDesktopDetails({ isDesktop, desktopDetailsPanelOpen, activeDetailsLink, inspectedDetailsEntity, activeDetailsChatType, setProfileActiveTab, setGroupModalError, groupModalCacheRef, activeGroupModalSeed, setGroupModalData, setGroupNameDraft, setGroupAvatarDraft, setGroupModalLoading, groupDetailsInFlightRef, t, setChannelModalError, channelModalCacheRef, activeChannelModalSeed, setChannelModalData, setChannelNameDraft, setChannelAvatarDraft, setChannelModalLoading, channelDetailsInFlightRef, selfId, setProfileData, setContactEditorTarget, setContactExists, setChats, setContactFirstName, setContactLastName, setContactEditorInitial, setProfileLoading, setProfileError, setContactMessage, setActiveConversation });
  }, [
    activeChannelModalSeed,
    activeDetailsLink,
    activeDetailsChatType,
    activeGroupModalSeed,
    desktopDetailsPanelOpen,
    inspectedDetailsEntity,
    isDesktop,
    selfId, t]);

  const canManageGroup =
    groupModalData?.group?.myRole === "owner" ||
    groupModalData?.group?.myRole === "admin" ||
    Boolean(groupModalData?.group?.myCanAddMembers);

  const renderCommunitySharedTabs = (includeVoice = true) => {
    return renderCommunitySharedTabsView({ activeDetailsChatType, groupModalData, groupModalOpen, activeConversation, activeChat, t, setProfileActiveTab, profileActiveTab, profileMediaVisible, memberSearchQuery, setMemberSearchQuery, canManageGroup, openAddMembersModal, groupModalLoading, readProfileFromCache, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, selfId, memberLongPress, openCommunityProfile, chatSharedFilesList, chatSharedVoiceList, profilePlayingAudioUrl, setProfilePlayingAudioUrl, chatSharedLinksList, openExternalLinkPrompt, chatSharedMusicList, chatSharedMediaList, setVideoViewer, setImageViewer }, includeVoice);
  };

  const openMessageSearchFor = (link: string, kind: ConversationChatType) => {
    interruptMessageAutoScroll();
    setMessageHelperId(null); setStickerPickerOpen(false); setAttachmentMenuOpen(false); clearSelectionMode();
    setProfileModalOpen(false); setChannelModalOpen(false); setGroupModalOpen(false);
    setDesktopDetailsPanelOpen(false); setInspectedDetailsEntity(null);
    if (selectedLink?.toLowerCase() !== link.toLowerCase() || (activeChat?.chatType ?? "direct") !== kind) openChatSearchResult(link, kind);
    messageSearch.begin(`${selfId}:${link.toLowerCase()}:${kind}`);
  };

  const renderCommunityProfileActions = (kind: "group" | "channel") => {
    const entity = kind === "group" ? groupModalData?.group : channelModalData?.channel;
    if (!entity) return null;
    const isOwner = entity.ownerId === selfId || (kind === "group" ? groupModalData?.group.myRole === "owner" : Boolean(channelModalData?.channel.isOwner));
    const canManage = isOwner || entity.myRole === "admin";
    const danger = isOwner ? "delete" : kind === "group" || channelModalData?.channel.isSubscribed ? "leave" : null;
    return <CommunityProfileActions key={kind + ":" + entity.link} kind={kind} muted={mutedChatLinkSet.has(entity.link)} glass={transparentVisual} canManage={canManage} danger={danger}
      onToggleSound={() => toggleChatMutedState(entity.link)}
      onManage={() => { if (canManage) { if (kind === "group") setGroupSubView("settings"); else setChannelSubView("settings"); } }}
      onSearch={kind === "channel" ? () => openMessageSearchFor(entity.link, "channel") : undefined}
      onDanger={() => { if (kind === "group") setGroupDangerAction(isOwner ? "delete" : "leave"); else setChannelDangerAction(isOwner ? "delete" : "leave"); }} />;
  };

  const renderUserProfileActions = () => {
    if (!profileData || profileIsBot || profileIsSaved || profileData.id === selfId) return null;
    return (
      <UserProfileActions
        key={profileData.id}
        muted={mutedChatLinkSet.has(profileData.link)}
        glass={transparentVisual}
        callDisabled={!calls.enabled || calls.busy || Boolean(calls.current)}
        uploadingWallpaper={uploadingWallpaper}
        onCall={() => void calls.start("audio", { kind: "direct", link: profileData.link })}
        onToggleSound={() => toggleChatMutedState(profileData.link)}
        onChat={profileOpenedExternally ? () => {
          setProfileModalOpen(false); setDesktopDetailsPanelOpen(false); setInspectedDetailsEntity(null);
          messageSearch.close();
          openChatSearchResult(profileData.link, "direct");
        } : undefined}
        onSearch={() => openMessageSearchFor(profileData.link, "direct")}
        onWallpaper={() => { wallpaperTargetRef.current = profileData.link; wallpaperFileInputRef.current?.click(); }}
        onSecretChat={() => void openSecretChatFromProfile()}
      />
    );
  };

  const renderProfileDetailsSkeleton = () => (
    <div className="min-h-[320px]" aria-hidden="true" />
  );

  const renderContactEditorContent = () => {
    return renderContactEditorContentView({ contactEditorTarget, profileData, mutedChatLinkSet, t, contactDraftDisplayName, contactFirstName, setContactFirstName, contactLastName, setContactLastName, toggleChatMutedState, liveBackgroundPreset, contactExists, removeContact, setProfileSubView, contactSaving, contactMessage });
  };

  const renderSecretChatTimerControls = (isCompact = false) => {
    return renderSecretChatTimerControlsView({ secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, t, setSecretChatLifetimeDays, setSecretChatLifetimeHours, setSecretChatLifetimeMinutes, secretChatCodeword, setSecretChatCodeword }, isCompact);
  };

  const renderSecretChatPanelContent = () => {
    return renderSecretChatPanelContentView({ secretChatLifetimeDays, secretChatLifetimeHours, secretChatLifetimeMinutes, renderSecretChatTimerControls, submitCreateSecretChat, secretChatCreating, secretChatSelectedUserIds, t, setSecretChatInfoOpen });
  };

  const isGroupDirty = useMemo(() => {
    if (!groupModalData?.group) return false;
    const currentName = (groupModalData.group.name ?? "").trim();
    const currentAvatar = groupModalData.group.avatarUrl ?? null;
    const draftName = groupNameDraft.trim();
    const draftAvatar = groupAvatarDraft ?? null;
    return Boolean(draftName && (draftName !== currentName || draftAvatar !== currentAvatar || groupDescriptionDraft.trim() !== (groupModalData.group.description ?? "")));
  }, [groupModalData?.group, groupNameDraft, groupAvatarDraft, groupDescriptionDraft]);

  const isChannelDirty = useMemo(() => {
    if (!channelModalData?.channel) return false;
    const currentName = (channelModalData.channel.name ?? "").trim();
    const currentAvatar = channelModalData.channel.avatarUrl ?? null;
    const draftName = channelNameDraft.trim();
    const draftAvatar = channelAvatarDraft ?? null;
    return Boolean(draftName && (draftName !== currentName || draftAvatar !== currentAvatar || channelDescriptionDraft.trim() !== (channelModalData.channel.description ?? "")));
  }, [channelAvatarDraft, channelModalData?.channel, channelNameDraft, channelDescriptionDraft]);

  useEffect(() => {
    if (!activeConversation || !selfId) return;
    const conversation = activeConversation;
    const scopeType = selectedLink?.startsWith("secret-") ? "secret"
      : conversation.group ? "group" : conversation.channel ? "channel"
        : conversation.chatType === "saved" ? "saved" : "direct";
    const scopeId = scopeType === "secret" ? selectedLink!.slice(7)
      : conversation.group?.id ?? conversation.channel?.id
      ?? (scopeType === "saved" ? selfId : conversation.peer?.id);
    if (!scopeId) return;
    let cancelled = false;
    const urls = [...new Set(messages.filter(message => message.senderId === selfId).flatMap(message => collectLegacyMediaUrls(message.text)))];
    void (async () => {
      for (const url of urls) {
        if (cancelled) return;
        const key = [selfId, scopeType, scopeId, url].join(":");
        if (Date.now() - (legacyMediaGrantAttempts.get(key) ?? 0) < 60_000) continue;
        legacyMediaGrantAttempts.set(key, Date.now());
        try {
          await apiRequest("/api/media/access", { method: "POST", body: JSON.stringify({ url, scopeType, scopeId }) });
          if (!cancelled) markLegacyMediaRestored(url);
        } catch { /* Only the uploader may grant legacy access; never infer it from a recipient URL. */ }
      }
    })();
    return () => { cancelled = true; };
  }, [messages, activeConversation, selfId, selectedLink]);

  const loadStories = useCallback(async (forceRefresh = false) => {
    return loadStoriesAction({ selfId, storyFeed, setStoryFeed, setStoriesLoading, storyFeedLoadPromiseRef, storyFeedLoadIsForceRef }, forceRefresh);
  }, [selfId, storyFeed.length]);

  useEffect(() => {
    if (!selfId) return;
    if (skipNextInitialStoriesReloadRef.current) {
      skipNextInitialStoriesReloadRef.current = false;
      return;
    }
    void loadStories();
  }, [loadStories, selfId]);

  return {
    openChatListDangerAction,
    resolveChatListDangerAction,
    canManageGroup,
    renderCommunitySharedTabs,
    renderCommunityProfileActions,
    renderUserProfileActions,
    renderProfileDetailsSkeleton,
    renderContactEditorContent,
    renderSecretChatPanelContent,
    isGroupDirty,
    isChannelDirty,
    loadStories
  };
}
