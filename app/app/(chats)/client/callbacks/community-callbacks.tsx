"use client";

import { normalizeAllowedReactions, type ReactionPolicy } from "@/lib/reaction-policy";
import { CommunityReactionsPanel } from "../../components/common/CommunityReactionsPanel";
import { CommunityTypePanel } from "../../components/common/CommunitySettingsPanel";

import { type ChangeEvent } from "react";

import { ArrowLeft, Check } from "lucide-react";

import { motion } from "framer-motion";

import { Spinner } from "@/components/ui/spinner";
import { apiRequest } from "@/lib/client/http";

import { appToast as toast } from "@/lib/client/app-toast";

import { clearConversationCaches } from "../chat-cache";

import { telegramSubViewVariants } from "../config";

import {
  addMembersToGroupAction,
  addSubscribersToChannelAction,
  onGroupAvatarSelectedAction,
  onChannelAvatarSelectedAction,
  openChannelModalAction,
  subscribeToActiveChannelAction,
  joinActiveGroupAction,
  leaveChannelAction,
  removeMemberFromGroupAction,
  openRoleEditorAction,
  saveMemberRoleAction,
  leaveGroupAction,
  deleteGroupAction,
  openActiveDetailsAction,
  saveCommunityTypeAction
} from "../community-actions";

import { renderCommunitySettingsView } from "../story-actions";

import type { ChatPageStateModel } from "../controllers/useChatPageState";
import type { ChatElementStateModel } from "../controllers/useChatElementState";
import type { MessageEncryptionModel } from "../controllers/useMessageEncryption";
import type { ChatBootstrapModel } from "../controllers/useChatBootstrap";
import type { MessageHistoryModel } from "../controllers/useMessageHistory";
import type { ConversationNavigationModel } from "../controllers/useConversationNavigation";
import type { ActiveConversationModel } from "../controllers/useActiveConversation";
import type { ConversationPresentationModel } from "../controllers/useConversationPresentation";
import type { ChatPageCallbacks } from "../controllers/chat-page-callbacks";

export interface CommunityCallbackSources {
  readonly page: Pick<ChatPageStateModel, "t" | "setErrorText" | "detailsTargetRef" | "setRecentSearches" | "profileData" | "memberContextMenu" | "groupNavDirection" | "channelNavDirection" | "router"> & {
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "groupModalData" | "setGroupModalData" | "setGroupSubView" | "setGroupAvatarDraft" | "joiningGroup" | "setJoiningGroup" | "groupSaving" | "groupNameDraft" | "groupDescriptionDraft" | "groupAvatarDraft" | "setGroupSaving" | "setGroupNameDraft" | "setGroupDescriptionDraft" | "removingMemberId" | "setRemovingMemberId" | "removingSubscriberId" | "setRemovingSubscriberId" | "leavingGroup" | "setLeavingGroup" | "setGroupModalOpen" | "deletingGroup" | "setDeletingGroup" | "setGroupMemberRemovalTarget" | "setChannelSubscriberRemovalTarget" | "groupMembersReturnViewRef" | "setReactionSettingsDraft" | "reactionSettingsDraft" | "groupIsPublicDraft" | "groupLinkDraft" | "setGroupIsPublicDraft" | "setGroupLinkDraft">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "addingMembers" | "selectedContactIds" | "contactsForAdd" | "setAddingMembers" | "setAddMembersModalOpen" | "setSelectedContactIds" | "channelModalData" | "setChannelModalData" | "setChannelSubView" | "addMembersTargetKind" | "setChannelAvatarDraft" | "channelMembersReturnViewRef" | "setChannelNameEditing" | "setChannelModalError" | "setChannelNameDraft" | "setChannelDescriptionDraft" | "setChannelIsPublicDraft" | "setChannelLinkDraft" | "setChannelModalLoading" | "channelSaving" | "channelNameDraft" | "channelDescriptionDraft" | "channelAvatarDraft" | "setChannelSaving" | "channelLeaving" | "setChannelLeaving" | "setChannelModalOpen" | "channelDeleting" | "setChannelDeleting" | "channelDangerAction" | "setChannelDangerAction" | "channelModalOpen" | "savingRole" | "setSavingRole" | "groupDangerAction" | "setGroupDangerAction" | "channelIsPublicDraft" | "channelLinkDraft">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation" | "setActiveConversation" | "setChats" | "chats" | "setMessages">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "setContactEditorOpen">;
    userDetails: Pick<ChatPageStateModel["userDetails"], "setProfileActiveTab">;
    directorySearch: Pick<ChatPageStateModel["directorySearch"], "setChatSearchChannels">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "selectedLink" | "setSelectedLink">;
    memberRole: Pick<ChatPageStateModel["memberRole"], "setRoleEditorKind" | "setRoleModalMember" | "setRoleNameDraft" | "setPermChangeAvatar" | "setPermChangeName" | "setPermChangeReactions" | "setPermPinMessages" | "setPermStartVideoChat" | "setPermDeleteForeign" | "setPermAddMembers" | "setPermPostMessages" | "setPermEditForeignMessages" | "setPermDeleteForeignMessages" | "setPermGenerateInviteLink" | "setPermManageAdmins" | "setRoleEditorInitial" | "roleModalMember" | "roleEditorKind" | "roleNameDraft" | "permChangeAvatar" | "permChangeName" | "permChangeReactions" | "permPinMessages" | "permStartVideoChat" | "permPostMessages" | "permEditForeignMessages" | "permDeleteForeignMessages" | "permDeleteForeign" | "permAddMembers" | "permGenerateInviteLink" | "permManageAdmins">;
    account: Pick<ChatPageStateModel["account"], "selfId">;
    profileNavigation: Pick<ChatPageStateModel["profileNavigation"], "setProfileOpenedExternally">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop" | "desktopDetailsPanelOpen" | "setDesktopDetailsPanelOpen" | "setInspectedDetailsEntity">;

  };
  readonly elements: {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "groupModalCacheRef" | "channelModalCacheRef" | "channelDetailsInFlightRef" | "groupAvatarInputRef" | "channelAvatarInputRef" | "chatScrollRef" | "chatReadingPositionsRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "openConversationRef" | "lastHandledSelectedLinkRef">;

  };
  readonly encryption: Pick<MessageEncryptionModel, "ensureSharedKeyForMembers">;
  readonly callbacks: Pick<ChatPageCallbacks, "openGroupModal" | "uploadMediaFile" | "showDetailsPanel" | "openProfileModal" | "openInviteModal">;
  readonly bootstrap: Pick<ChatBootstrapModel, "activeChannelModalSeed"> & {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "currentUserIdRef">;

  };
  readonly history: Pick<MessageHistoryModel, "sharedKeyServerCacheRef">;
  readonly navigation: Pick<ConversationNavigationModel, "conversationDecryptRetryRef">;
  readonly active: Pick<ActiveConversationModel, "activeChat">;
  readonly presentation: Pick<ConversationPresentationModel, "effectiveDetailsChatType" | "isEclipseConversation" | "isSavedConversation" | "canUseDesktopDetailsPanel">;
}

/** Creates render-snapshot callbacks without reading models during construction. */
export function createCommunityCallbacks(sources: CommunityCallbackSources): Pick<ChatPageCallbacks, "addMembersToGroup" | "addSubscribersToChannel" | "submitAddCommunityMembers" | "onGroupAvatarSelected" | "onChannelAvatarSelected" | "openChannelModal" | "subscribeToActiveChannel" | "joinActiveGroup" | "saveChannelSettings" | "leaveChannel" | "deleteChannel" | "confirmChannelDangerAction" | "saveGroupSettings" | "removeMemberFromGroup" | "removeSubscriberFromChannel" | "openRoleEditor" | "saveMemberRole" | "leaveGroup" | "deleteGroup" | "confirmGroupDangerAction" | "openActiveDetails" | "memberLongPress" | "renderCommunitySettings" | "openCommunityReactions" | "saveCommunityReactions" | "renderCommunityReactions" | "renderCommunityType" | "openCommunityType" | "saveCommunityType"> {
  async function addMembersToGroup(): ReturnType<ChatPageCallbacks["addMembersToGroup"]> {
    const { t, setErrorText } = sources.page;
    const { groupModalData, setGroupModalData, setGroupSubView } = sources.page.groupDetails;
    const { addingMembers, selectedContactIds, contactsForAdd, setAddingMembers, setAddMembersModalOpen, setSelectedContactIds } = sources.page.mediaAndChannel;
    const { activeConversation, setActiveConversation } = sources.page.conversation;
    const { groupModalCacheRef } = sources.elements.conversationElement;
    const { ensureSharedKeyForMembers } = sources.encryption;
    const { openGroupModal } = sources.callbacks;

    return addMembersToGroupAction({ groupModalData, addingMembers, selectedContactIds, activeConversation, contactsForAdd, t, setGroupModalData, groupModalCacheRef, setActiveConversation, setAddingMembers, setErrorText, ensureSharedKeyForMembers, setGroupSubView, setAddMembersModalOpen, setSelectedContactIds, openGroupModal });
  }

  async function addSubscribersToChannel(): ReturnType<ChatPageCallbacks["addSubscribersToChannel"]> {
    const { t, setErrorText } = sources.page;
    const { channelModalData, addingMembers, selectedContactIds, contactsForAdd, setChannelModalData, setChannelSubView, setAddMembersModalOpen, setSelectedContactIds, setAddingMembers } = sources.page.mediaAndChannel;
    const { setChats } = sources.page.conversation;
    const { channelModalCacheRef } = sources.elements.conversationElement;
    const { ensureSharedKeyForMembers } = sources.encryption;

    return addSubscribersToChannelAction({ channelModalData, addingMembers, selectedContactIds, contactsForAdd, t, setChannelModalData, channelModalCacheRef, setChats, setChannelSubView, setAddMembersModalOpen, setSelectedContactIds, setAddingMembers, ensureSharedKeyForMembers, openChannelModal, setErrorText });
  }

  function submitAddCommunityMembers(): ReturnType<ChatPageCallbacks["submitAddCommunityMembers"]> {
    const { addMembersTargetKind } = sources.page.mediaAndChannel;

    if (addMembersTargetKind === "channel") {
      void addSubscribersToChannel();
      return;
    }
    void addMembersToGroup();
  }

  async function onGroupAvatarSelected(event: ChangeEvent<HTMLInputElement>): ReturnType<ChatPageCallbacks["onGroupAvatarSelected"]> {
    const { setErrorText, t } = sources.page;
    const { setGroupAvatarDraft } = sources.page.groupDetails;
    const { uploadMediaFile } = sources.callbacks;

    return onGroupAvatarSelectedAction({ setErrorText, t, uploadMediaFile, setGroupAvatarDraft }, event);
  }

  async function onChannelAvatarSelected(event: ChangeEvent<HTMLInputElement>): ReturnType<ChatPageCallbacks["onChannelAvatarSelected"]> {
    const { setErrorText, t } = sources.page;
    const { setChannelAvatarDraft } = sources.page.mediaAndChannel;
    const { uploadMediaFile } = sources.callbacks;

    return onChannelAvatarSelectedAction({ setErrorText, t, uploadMediaFile, setChannelAvatarDraft }, event);
  }

  async function openChannelModal(link: string, options?: { forceRefresh?: boolean }): ReturnType<ChatPageCallbacks["openChannelModal"]> {
    const { detailsTargetRef, t } = sources.page;
    const { channelMembersReturnViewRef, setChannelNameEditing, setChannelModalError, setChannelSubView, setChannelModalData, setChannelNameDraft, setChannelDescriptionDraft, setChannelAvatarDraft, setChannelIsPublicDraft, setChannelLinkDraft, setChannelModalLoading } = sources.page.mediaAndChannel;
    const { setContactEditorOpen } = sources.page.contactEditor;
    const { setProfileActiveTab } = sources.page.userDetails;
    const { chats, setActiveConversation, setChats } = sources.page.conversation;
    const { setChatSearchChannels } = sources.page.directorySearch;
    const { showDetailsPanel } = sources.callbacks;
    const { channelModalCacheRef, channelDetailsInFlightRef } = sources.elements.conversationElement;
    const { activeChannelModalSeed } = sources.bootstrap;

    return openChannelModalAction({ detailsTargetRef, channelMembersReturnViewRef, showDetailsPanel, setChannelNameEditing, setContactEditorOpen, setChannelModalError, setChannelSubView, setProfileActiveTab, channelModalCacheRef, activeChannelModalSeed, chats, setChannelModalData, setChannelNameDraft, setChannelDescriptionDraft, setChannelAvatarDraft, setChannelIsPublicDraft, setChannelLinkDraft, setChannelModalLoading, channelDetailsInFlightRef, setActiveConversation, setChatSearchChannels, setChats, t }, link, options);
  }

  async function subscribeToActiveChannel(): ReturnType<ChatPageCallbacks["subscribeToActiveChannel"]> {
    const { setRecentSearches, setErrorText, t } = sources.page;
    const { activeConversation, setActiveConversation, setChats } = sources.page.conversation;
    const { setChatSearchChannels } = sources.page.directorySearch;
    const { setChannelModalData } = sources.page.mediaAndChannel;
    const { selectedLinkRef } = sources.page.selection;
    const { channelModalCacheRef } = sources.elements.conversationElement;
    const { openConversationRef } = sources.elements.conversationRequest;
    const { sharedKeyServerCacheRef } = sources.history;
    const { conversationDecryptRetryRef } = sources.navigation;

    return subscribeToActiveChannelAction({ activeConversation, setActiveConversation, setChats, setChatSearchChannels, setRecentSearches, channelModalCacheRef, setChannelModalData, sharedKeyServerCacheRef, conversationDecryptRetryRef, selectedLinkRef, openConversationRef, setErrorText, t });
  }

  async function joinActiveGroup(): ReturnType<ChatPageCallbacks["joinActiveGroup"]> {
    const { t, setErrorText } = sources.page;
    const { activeConversation, setActiveConversation, setChats } = sources.page.conversation;
    const { joiningGroup, setJoiningGroup } = sources.page.groupDetails;
    const { selectedLinkRef } = sources.page.selection;
    const { activeChat } = sources.active;
    const { sharedKeyServerCacheRef } = sources.history;
    const { conversationDecryptRetryRef } = sources.navigation;
    const { openConversationRef } = sources.elements.conversationRequest;

    return joinActiveGroupAction({ activeConversation, activeChat, joiningGroup, setJoiningGroup, setActiveConversation, setChats, sharedKeyServerCacheRef, conversationDecryptRetryRef, selectedLinkRef, openConversationRef, t, setErrorText });
  }

  async function saveChannelSettings(): ReturnType<ChatPageCallbacks["saveChannelSettings"]> {
    const { t } = sources.page;
    const { channelModalData, channelSaving, channelNameDraft, channelDescriptionDraft, channelAvatarDraft, setChannelSaving, setChannelModalData, setChannelNameDraft, setChannelDescriptionDraft, setChannelAvatarDraft } = sources.page.mediaAndChannel;
    const { setChats, setActiveConversation } = sources.page.conversation;
    const { channelModalCacheRef } = sources.elements.conversationElement;

    const entity = channelModalData?.channel;
    if (!entity || channelSaving) return;
    const name = channelNameDraft.trim();
    if (name.length < 2) { toast.error(t("Название должно содержать не менее 2 символов")); return; }
    const payload: {
      name?: string;
      description?: string | null;
      avatarUrl?: string | null

    } = {};
    if (name !== entity.name) payload.name = name;
    if (channelDescriptionDraft.trim() !== (entity.description ?? "")) payload.description = channelDescriptionDraft.trim() || null;
    if ((channelAvatarDraft ?? null) !== (entity.avatarUrl ?? null)) payload.avatarUrl = channelAvatarDraft ?? null;
    if (!Object.keys(payload).length) return;
    setChannelSaving(true);
    try {
      const result = await apiRequest<{
        channel: {
          name: string;
          description: string | null;
          avatarUrl: string | null

        }

      }>("/api/channels/" + encodeURIComponent(entity.link), { method: "PATCH", body: JSON.stringify(payload) });
      const updated = { ...channelModalData!, channel: { ...entity, ...result.channel } };
      setChannelModalData(updated);
      channelModalCacheRef.current.set(entity.link, { savedAt: Date.now(), data: updated });
      setChannelNameDraft(result.channel.name); setChannelDescriptionDraft(result.channel.description ?? ""); setChannelAvatarDraft(result.channel.avatarUrl);
      setChats(prev => prev.map(chat => chat.chatType === "channel" && chat.link === entity.link ? { ...chat, displayName: result.channel.name, avatarUrl: result.channel.avatarUrl } : chat));
      setActiveConversation(prev => prev?.chatType === "channel" && prev.channel?.id === entity.id ? { ...prev, channel: { ...prev.channel, ...result.channel } } : prev);
      toast.success(t("Изменения сохранены"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("Не удалось сохранить настройки")); }
    finally { setChannelSaving(false); }
  }

  async function leaveChannel(): ReturnType<ChatPageCallbacks["leaveChannel"]> {
    const { setRecentSearches, t } = sources.page;
    const { channelModalData, channelLeaving, setChannelLeaving, setChannelModalData, setChannelModalOpen, setChannelModalError } = sources.page.mediaAndChannel;
    const { setChatSearchChannels } = sources.page.directorySearch;
    const { setChats, setActiveConversation, setMessages } = sources.page.conversation;
    const { selectedLink, setSelectedLink } = sources.page.selection;
    const { channelModalCacheRef } = sources.elements.conversationElement;

    return leaveChannelAction({ channelModalData, channelLeaving, setChannelLeaving, channelModalCacheRef, setChannelModalData, setChatSearchChannels, setRecentSearches, setChats, setChannelModalOpen, selectedLink, setSelectedLink, setActiveConversation, setMessages, setChannelModalError, t });
  }

  async function deleteChannel(): ReturnType<ChatPageCallbacks["deleteChannel"]> {
    const { t } = sources.page;
    const { channelModalData, channelDeleting, setChannelDeleting, setChannelModalOpen, setChannelModalError } = sources.page.mediaAndChannel;
    const { setChats, setActiveConversation, setMessages } = sources.page.conversation;
    const { selectedLink, setSelectedLink } = sources.page.selection;

    if (!channelModalData?.channel?.link || channelDeleting || !channelModalData.channel.isOwner) return;
    setChannelDeleting(true);
    try {
      await apiRequest(`/api/channels/${encodeURIComponent(channelModalData.channel.link)}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      setChats((prev) =>
        prev.filter((chat) => !(chat.chatType === "channel" && chat.link === channelModalData.channel.link)),
      );
      setChannelModalOpen(false);
      if (selectedLink === channelModalData.channel.link) {
        setSelectedLink(null);
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (error) {
      setChannelModalError(error instanceof Error ? error.message : t("Не удалось удалить канал"));
    } finally {
      setChannelDeleting(false);
    }
  }

  async function confirmChannelDangerAction(): ReturnType<ChatPageCallbacks["confirmChannelDangerAction"]> {
    const { channelDangerAction, setChannelDangerAction } = sources.page.mediaAndChannel;

    if (channelDangerAction === "leave") {
      await leaveChannel();
    } else if (channelDangerAction === "delete") {
      await deleteChannel();
    }
    setChannelDangerAction(null);
  }

  async function saveGroupSettings(): ReturnType<ChatPageCallbacks["saveGroupSettings"]> {
    const { t } = sources.page;
    const { groupModalData, groupSaving, groupNameDraft, groupDescriptionDraft, groupAvatarDraft, setGroupSaving, setGroupModalData, setGroupNameDraft, setGroupDescriptionDraft, setGroupAvatarDraft } = sources.page.groupDetails;
    const { setChats, setActiveConversation } = sources.page.conversation;
    const { groupModalCacheRef } = sources.elements.conversationElement;

    const entity = groupModalData?.group;
    if (!entity || groupSaving) return;
    const name = groupNameDraft.trim();
    if (name.length < 2) { toast.error(t("Название должно содержать не менее 2 символов")); return; }
    const payload: {
      name?: string;
      description?: string | null;
      avatarUrl?: string | null

    } = {};
    if (name !== entity.name) payload.name = name;
    if (groupDescriptionDraft.trim() !== (entity.description ?? "")) payload.description = groupDescriptionDraft.trim() || null;
    if ((groupAvatarDraft ?? null) !== (entity.avatarUrl ?? null)) payload.avatarUrl = groupAvatarDraft ?? null;
    if (!Object.keys(payload).length) return;
    setGroupSaving(true);
    try {
      const result = await apiRequest<{
        group: {
          name: string;
          description: string | null;
          avatarUrl: string | null

        }

      }>("/api/groups/" + encodeURIComponent(entity.link), { method: "PATCH", body: JSON.stringify(payload) });
      const updated = { ...groupModalData!, group: { ...entity, ...result.group } };
      setGroupModalData(updated);
      groupModalCacheRef.current.set(entity.link, { savedAt: Date.now(), data: updated });
      setGroupNameDraft(result.group.name); setGroupDescriptionDraft(result.group.description ?? ""); setGroupAvatarDraft(result.group.avatarUrl);
      setChats(prev => prev.map(chat => chat.chatType === "group" && chat.link === entity.link ? { ...chat, displayName: result.group.name, avatarUrl: result.group.avatarUrl } : chat));
      setActiveConversation(prev => prev?.chatType === "group" && prev.group?.id === entity.id ? { ...prev, group: { ...prev.group, ...result.group } } : prev);
      toast.success(t("Изменения сохранены"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("Не удалось сохранить настройки")); }
    finally { setGroupSaving(false); }
  }

  async function removeMemberFromGroup(memberId: string): ReturnType<ChatPageCallbacks["removeMemberFromGroup"]> {
    const { setErrorText, t } = sources.page;
    const { groupModalData, removingMemberId, setRemovingMemberId, setGroupModalData } = sources.page.groupDetails;
    const { activeConversation, setActiveConversation } = sources.page.conversation;
    const { groupModalCacheRef } = sources.elements.conversationElement;
    const { openGroupModal } = sources.callbacks;

    return removeMemberFromGroupAction({ groupModalData, removingMemberId, activeConversation, setRemovingMemberId, setErrorText, setGroupModalData, groupModalCacheRef, setActiveConversation, openGroupModal, t }, memberId);
  }

  async function removeSubscriberFromChannel(memberId: string): ReturnType<ChatPageCallbacks["removeSubscriberFromChannel"]> {
    const { setErrorText, t } = sources.page;
    const { channelModalData, setChannelModalData } = sources.page.mediaAndChannel;
    const { removingSubscriberId, setRemovingSubscriberId } = sources.page.groupDetails;

    if (!channelModalData?.channel?.link || removingSubscriberId) return;
    const channelLink = channelModalData.channel.link;
    setRemovingSubscriberId(memberId);
    setErrorText(null);
    setChannelModalData((prev) => {
      if (!prev) return prev;
      return { ...prev, members: (prev.members ?? []).filter((m) => m.id !== memberId) };
    });
    try {
      await apiRequest(`/api/channels/${encodeURIComponent(channelLink)}/subscribers`, {
        method: "DELETE",
        body: JSON.stringify({ memberId }),
      });
      await openChannelModal(channelLink);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("Ошибка удаления подписчика"));
      await openChannelModal(channelLink);
    } finally {
      setRemovingSubscriberId(null);
    }
  }

  function openRoleEditor(member: any, kind: "group" | "channel" = sources.presentation.effectiveDetailsChatType === "channel" || sources.page.mediaAndChannel.channelModalOpen ? "channel" : "group"): ReturnType<ChatPageCallbacks["openRoleEditor"]> {
    const { effectiveDetailsChatType } = sources.presentation;
    const { channelModalOpen } = sources.page.mediaAndChannel;
    const { setRoleEditorKind, setRoleModalMember, setRoleNameDraft, setPermChangeAvatar, setPermChangeName, setPermChangeReactions, setPermPinMessages, setPermStartVideoChat, setPermDeleteForeign, setPermAddMembers, setPermPostMessages, setPermEditForeignMessages, setPermDeleteForeignMessages, setPermGenerateInviteLink, setPermManageAdmins, setRoleEditorInitial } = sources.page.memberRole;

    return openRoleEditorAction({ effectiveDetailsChatType, channelModalOpen, setRoleEditorKind, setRoleModalMember, setRoleNameDraft, setPermChangeAvatar, setPermChangeName, setPermChangeReactions, setPermPinMessages, setPermStartVideoChat, setPermDeleteForeign, setPermAddMembers, setPermPostMessages, setPermEditForeignMessages, setPermDeleteForeignMessages, setPermGenerateInviteLink, setPermManageAdmins, setRoleEditorInitial }, member, kind);
  }

  async function saveMemberRole(): ReturnType<ChatPageCallbacks["saveMemberRole"]> {
    const { t, setErrorText } = sources.page;
    const { roleModalMember, roleEditorKind, roleNameDraft, permChangeAvatar, permChangeName, permChangeReactions, permPinMessages, permStartVideoChat, permPostMessages, permEditForeignMessages, permDeleteForeignMessages, permDeleteForeign, permAddMembers, permGenerateInviteLink, permManageAdmins, setRoleModalMember } = sources.page.memberRole;
    const { savingRole, setChannelModalData, setSavingRole, channelModalData } = sources.page.mediaAndChannel;
    const { setGroupModalData, groupModalData } = sources.page.groupDetails;
    const { channelModalCacheRef, groupModalCacheRef } = sources.elements.conversationElement;

    return saveMemberRoleAction({ roleModalMember, savingRole, roleEditorKind, roleNameDraft, t, permChangeAvatar, permChangeName, permChangeReactions, permPinMessages, permStartVideoChat, permPostMessages, permEditForeignMessages, permDeleteForeignMessages, permDeleteForeign, permAddMembers, permGenerateInviteLink, permManageAdmins, setChannelModalData, channelModalCacheRef, setGroupModalData, groupModalCacheRef, setSavingRole, setErrorText, channelModalData, groupModalData, setRoleModalMember });
  }

  async function leaveGroup(): ReturnType<ChatPageCallbacks["leaveGroup"]> {
    const { setErrorText, t } = sources.page;
    const { groupModalData, leavingGroup, setLeavingGroup, setGroupModalOpen } = sources.page.groupDetails;
    const { selfId } = sources.page.account;
    const { setChats, setActiveConversation, setMessages } = sources.page.conversation;
    const { setAddMembersModalOpen } = sources.page.mediaAndChannel;
    const { selectedLink, setSelectedLink } = sources.page.selection;

    return leaveGroupAction({ groupModalData, selfId, leavingGroup, setLeavingGroup, setErrorText, setChats, setGroupModalOpen, setAddMembersModalOpen, selectedLink, setSelectedLink, setActiveConversation, setMessages, t });
  }

  async function deleteGroup(): ReturnType<ChatPageCallbacks["deleteGroup"]> {
    const { setErrorText, t } = sources.page;
    const { groupModalData, deletingGroup, setDeletingGroup, setGroupModalOpen } = sources.page.groupDetails;
    const { setChats, setActiveConversation, setMessages } = sources.page.conversation;
    const { setAddMembersModalOpen } = sources.page.mediaAndChannel;
    const { selectedLink, setSelectedLink } = sources.page.selection;

    return deleteGroupAction({ groupModalData, deletingGroup, setDeletingGroup, setErrorText, setChats, setGroupModalOpen, setAddMembersModalOpen, selectedLink, setSelectedLink, setActiveConversation, setMessages, t });
  }

  async function confirmGroupDangerAction(): ReturnType<ChatPageCallbacks["confirmGroupDangerAction"]> {
    const { groupDangerAction, setGroupDangerAction } = sources.page.mediaAndChannel;

    if (groupDangerAction === "leave") {
      await leaveGroup();
    } else if (groupDangerAction === "delete") {
      await deleteGroup();
    }
    setGroupDangerAction(null);
  }

  function openActiveDetails(): ReturnType<ChatPageCallbacks["openActiveDetails"]> {
    const { activeChat } = sources.active;
    const { profileData } = sources.page;
    const { setProfileOpenedExternally } = sources.page.profileNavigation;
    const { isDesktop, desktopDetailsPanelOpen, setDesktopDetailsPanelOpen, setInspectedDetailsEntity } = sources.page.panels;
    const { activeConversation } = sources.page.conversation;
    const { isEclipseConversation, isSavedConversation, canUseDesktopDetailsPanel } = sources.presentation;
    const { openProfileModal, openGroupModal } = sources.callbacks;

    return openActiveDetailsAction({ activeChat, setProfileOpenedExternally, isEclipseConversation, isSavedConversation, isDesktop, desktopDetailsPanelOpen, profileData, setDesktopDetailsPanelOpen, setInspectedDetailsEntity, openProfileModal, activeConversation, canUseDesktopDetailsPanel, openChannelModal, openGroupModal });
  }

  function memberLongPress(member: any, kind: "group" | "channel"): ReturnType<ChatPageCallbacks["memberLongPress"]> {
    const { memberContextMenu } = sources.page;
    const { groupModalData, setGroupMemberRemovalTarget, setChannelSubscriberRemovalTarget } = sources.page.groupDetails;
    const { channelModalData } = sources.page.mediaAndChannel;
    const { selfId } = sources.page.account;

    const entity = kind === "group" ? groupModalData?.group : channelModalData?.channel;
    const owner = entity?.ownerId === selfId;
    if (!entity || member.id === entity.ownerId || member.id === selfId) return {};
    const role = owner || (entity.myRole === "admin" && entity.myCanManageAdmins);
    const remove = owner || (kind === "group" ? entity.myRole === "admin" : entity.myRole === "admin" && entity.myCanAddMembers);
    return memberContextMenu.bind({ role: role ? () => openRoleEditor(member, kind) : undefined, remove: remove ? () => kind === "group" ? setGroupMemberRemovalTarget(member) : setChannelSubscriberRemovalTarget(member) : undefined });
  }

  function renderCommunitySettings(kind: "group" | "channel"): ReturnType<ChatPageCallbacks["renderCommunitySettings"]> {
    const { t } = sources.page;
    const { groupModalData, groupNameDraft, groupDescriptionDraft, groupAvatarDraft, setGroupNameDraft, setGroupDescriptionDraft, groupMembersReturnViewRef, setGroupSubView } = sources.page.groupDetails;
    const { channelModalData, channelNameDraft, channelDescriptionDraft, channelAvatarDraft, setChannelNameDraft, setChannelDescriptionDraft, channelMembersReturnViewRef, setChannelSubView } = sources.page.mediaAndChannel;
    const { selfId } = sources.page.account;
    const { openInviteModal } = sources.callbacks;
    const { groupAvatarInputRef, channelAvatarInputRef } = sources.elements.conversationElement;

    return renderCommunitySettingsView({ groupModalData, channelModalData, selfId, openInviteModal, t, groupNameDraft, channelNameDraft, groupDescriptionDraft, channelDescriptionDraft, groupAvatarDraft, channelAvatarDraft, openCommunityReactions, setGroupNameDraft, setChannelNameDraft, setGroupDescriptionDraft, setChannelDescriptionDraft, groupAvatarInputRef, channelAvatarInputRef, openCommunityType, groupMembersReturnViewRef, setGroupSubView, channelMembersReturnViewRef, setChannelSubView, onGroupAvatarSelected, onChannelAvatarSelected }, kind);
  }

  function openCommunityReactions(kind: "group" | "channel"): ReturnType<ChatPageCallbacks["openCommunityReactions"]> {
    const { groupModalData, setReactionSettingsDraft, setGroupSubView } = sources.page.groupDetails;
    const { channelModalData, setChannelSubView } = sources.page.mediaAndChannel;

    const entity = kind === "group" ? groupModalData?.group : channelModalData?.channel;
    if (!entity) return;
    setReactionSettingsDraft({ reactionMode: entity.reactionMode === "some" || entity.reactionMode === "none" ? entity.reactionMode : "all", allowedReactions: normalizeAllowedReactions(entity.allowedReactions ?? []) });
    if (kind === "group") setGroupSubView("reactions"); else setChannelSubView("reactions");
  }

  async function saveCommunityReactions(kind: "group" | "channel"): ReturnType<ChatPageCallbacks["saveCommunityReactions"]> {
    const { t } = sources.page;
    const { groupModalData, groupSaving, reactionSettingsDraft, setGroupSaving, setGroupModalData, setGroupSubView } = sources.page.groupDetails;
    const { channelModalData, channelSaving, setChannelSaving, setChannelModalData, setChannelSubView } = sources.page.mediaAndChannel;
    const { selfId } = sources.page.account;
    const { setActiveConversation } = sources.page.conversation;
    const { groupModalCacheRef, channelModalCacheRef } = sources.elements.conversationElement;

    const entity = kind === "group" ? groupModalData?.group : channelModalData?.channel;
    if (!entity || groupSaving || channelSaving || (entity.ownerId !== selfId && !(entity.myRole === "admin" && entity.myCanChangeReactions))) return;
    if (reactionSettingsDraft.reactionMode === "some" && !reactionSettingsDraft.allowedReactions.length) return;
    const setSaving = kind === "group" ? setGroupSaving : setChannelSaving;
    setSaving(true);
    try {
      const result = await apiRequest<{
        group?: ReactionPolicy;
        channel?: ReactionPolicy

      }>(`/api/${kind}s/${encodeURIComponent(entity.link)}`, { method: "PATCH", body: JSON.stringify(reactionSettingsDraft) });
      const updated = (kind === "group" ? result.group : result.channel)!;
      if (kind === "group") {
        setGroupModalData(previous => { if (!previous || previous.group.id !== entity.id) return previous; const next = { ...previous, group: { ...previous.group, ...updated } }; groupModalCacheRef.current.set(entity.link, { savedAt: Date.now(), data: next }); return next; });
        setGroupSubView("settings");
      } else {
        setChannelModalData(previous => { if (!previous || previous.channel.id !== entity.id) return previous; const next = { ...previous, channel: { ...previous.channel, ...updated } }; channelModalCacheRef.current.set(entity.link, { savedAt: Date.now(), data: next }); return next; });
        setChannelSubView("settings");
      }
      clearConversationCaches(selfId, entity.link, kind);
      setActiveConversation(previous => previous?.chatType === "group" && previous.group?.id === entity.id ? { ...previous, group: { ...previous.group, ...updated } } : previous?.chatType === "channel" && previous.channel?.id === entity.id ? { ...previous, channel: { ...previous.channel, ...updated } } : previous);
      toast.success(t("Реакции обновлены"));
    } catch (reason) { toast.error(t(reason instanceof Error ? reason.message : "Не удалось сохранить реакции")); }
    finally { setSaving(false); }
  }

  function renderCommunityReactions(kind: "group" | "channel", mobile: boolean): ReturnType<ChatPageCallbacks["renderCommunityReactions"]> {
    const { groupNavDirection, channelNavDirection, t } = sources.page;
    const { groupSaving, setGroupSubView, reactionSettingsDraft, setReactionSettingsDraft } = sources.page.groupDetails;
    const { channelSaving, setChannelSubView } = sources.page.mediaAndChannel;

    const saving = groupSaving || channelSaving;
    return <motion.div key={kind + "-reactions"} custom={kind === "group" ? groupNavDirection : channelNavDirection} variants={telegramSubViewVariants} initial="initial" animate="animate" exit="exit" className="flex min-h-0 flex-1 flex-col">
      {mobile && <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button type="button" disabled={saving} onClick={() => kind === "group" ? setGroupSubView("settings") : setChannelSubView("settings")} aria-label={t("Назад")} className="grid size-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:bg-white/8"><ArrowLeft size={24} /></button>
        <h2 className="min-w-0 flex-1 truncate text-[21px] font-semibold text-zinc-100">{t("Реакции")}</h2>
        <button type="button" onClick={() => void saveCommunityReactions(kind)} disabled={saving || (reactionSettingsDraft.reactionMode === "some" && !reactionSettingsDraft.allowedReactions.length)} aria-label={t("Сохранить реакции")} className="grid size-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:bg-white/8 disabled:opacity-40">{saving ? <Spinner className="size-5" /> : <Check size={22} />}</button>
      </div>}
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar"><CommunityReactionsPanel mode={reactionSettingsDraft.reactionMode} selected={reactionSettingsDraft.allowedReactions} disabled={saving} onModeChange={reactionMode => setReactionSettingsDraft(previous => ({ ...previous, reactionMode }))} onSelectionChange={allowedReactions => setReactionSettingsDraft(previous => ({ ...previous, allowedReactions }))} /></div>
    </motion.div>;
  }

  function renderCommunityType(kind: "group" | "channel", mobile: boolean): ReturnType<ChatPageCallbacks["renderCommunityType"]> {
    const { groupNavDirection, channelNavDirection, t } = sources.page;
    const { groupSaving, setGroupSubView, groupIsPublicDraft, groupLinkDraft, setGroupIsPublicDraft, setGroupLinkDraft } = sources.page.groupDetails;
    const { channelSaving, setChannelSubView, channelIsPublicDraft, channelLinkDraft, setChannelIsPublicDraft, setChannelLinkDraft } = sources.page.mediaAndChannel;

    const group = kind === "group", saving = group ? groupSaving : channelSaving;
    const back = () => group ? setGroupSubView("settings") : setChannelSubView("settings");
    return <motion.div key={kind + "-type"} custom={group ? groupNavDirection : channelNavDirection}
      variants={telegramSubViewVariants} initial="initial" animate="animate" exit="exit" className="flex min-h-0 flex-1 flex-col">
      {mobile && <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button type="button" onClick={back} disabled={saving} aria-label={t("Назад")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:bg-white/8"><ArrowLeft size={24} /></button>
        <h2 className="min-w-0 flex-1 truncate text-[21px] font-semibold text-zinc-100">{group ? t("Тип группы") : t("Тип канала")}</h2>
        <button type="button" onClick={() => void saveCommunityType(kind)} disabled={saving} aria-label={group ? t("Сохранить тип группы") : t("Сохранить тип канала")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 hover:bg-white/8 disabled:opacity-50">{saving ? <Spinner className="h-5 w-5 animate-spin" /> : <Check size={22} />}</button>
      </div>}
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar"><CommunityTypePanel kind={kind} isPublic={group ? groupIsPublicDraft : channelIsPublicDraft} link={group ? groupLinkDraft : channelLinkDraft} saving={saving}
        onPublicChange={group ? setGroupIsPublicDraft : setChannelIsPublicDraft} onLinkChange={group ? setGroupLinkDraft : setChannelLinkDraft} /></div>
    </motion.div>;
  }

  function openCommunityType(kind: "group" | "channel"): ReturnType<ChatPageCallbacks["openCommunityType"]> {
    const { groupModalData, setGroupIsPublicDraft, setGroupLinkDraft, setGroupSubView } = sources.page.groupDetails;
    const { channelModalData, setChannelIsPublicDraft, setChannelLinkDraft, setChannelSubView } = sources.page.mediaAndChannel;

    if (kind === "group" && groupModalData) {
      setGroupIsPublicDraft(Boolean(groupModalData.group.isPublic));
      setGroupLinkDraft(groupModalData.group.isPublic ? groupModalData.group.link : "");
      setGroupSubView("type");
    } else if (kind === "channel" && channelModalData) {
      setChannelIsPublicDraft(Boolean(channelModalData.channel.isPublic));
      setChannelLinkDraft(channelModalData.channel.isPublic ? channelModalData.channel.link : "");
      setChannelSubView("type");
    }
  }

  async function saveCommunityType(kind: "group" | "channel"): ReturnType<ChatPageCallbacks["saveCommunityType"]> {
    const { t, router } = sources.page;
    const { groupModalData, groupSaving, groupIsPublicDraft, groupLinkDraft, setGroupSaving, setGroupModalData, setGroupSubView } = sources.page.groupDetails;
    const { channelModalData, channelSaving, channelIsPublicDraft, channelLinkDraft, setChannelSaving, setChannelModalData, setChannelSubView } = sources.page.mediaAndChannel;
    const { selfId } = sources.page.account;
    const { setChats, setActiveConversation } = sources.page.conversation;
    const { setInspectedDetailsEntity } = sources.page.panels;
    const { selectedLink, selectedLinkRef, setSelectedLink } = sources.page.selection;
    const { groupModalCacheRef, channelModalCacheRef, chatScrollRef, chatReadingPositionsRef } = sources.elements.conversationElement;
    const { lastHandledSelectedLinkRef } = sources.elements.conversationRequest;
    const { currentUserIdRef } = sources.bootstrap.accountNavigation;

    return saveCommunityTypeAction({ groupModalData, channelModalData, selfId, groupSaving, channelSaving, groupIsPublicDraft, channelIsPublicDraft, groupLinkDraft, channelLinkDraft, t, setGroupSaving, setChannelSaving, groupModalCacheRef, setGroupModalData, setGroupSubView, channelModalCacheRef, setChannelModalData, setChannelSubView, setChats, setInspectedDetailsEntity, selectedLink, chatScrollRef, chatReadingPositionsRef, currentUserIdRef, selectedLinkRef, lastHandledSelectedLinkRef, setSelectedLink, router, setActiveConversation }, kind);
  }

  return { addMembersToGroup, addSubscribersToChannel, submitAddCommunityMembers, onGroupAvatarSelected, onChannelAvatarSelected, openChannelModal, subscribeToActiveChannel, joinActiveGroup, saveChannelSettings, leaveChannel, deleteChannel, confirmChannelDangerAction, saveGroupSettings, removeMemberFromGroup, removeSubscriberFromChannel, openRoleEditor, saveMemberRole, leaveGroup, deleteGroup, confirmGroupDangerAction, openActiveDetails, memberLongPress, renderCommunitySettings, openCommunityReactions, saveCommunityReactions, renderCommunityReactions, renderCommunityType, openCommunityType, saveCommunityType };
}
