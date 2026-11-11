"use client";

import { type ReactionMode } from "@/lib/reaction-policy";
import { useRef, useState } from "react";
import { type GroupMember, type GroupModalData } from "../../types";

export function useGroupDetailsState() {
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalLoading, setGroupModalLoading] = useState(false);
  const [groupModalError, setGroupModalError] = useState<string | null>(null);
  const [groupModalData, setGroupModalData] = useState<GroupModalData | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState("");
  const [groupNameEditing, setGroupNameEditing] = useState(false);
  const [groupAvatarDraft, setGroupAvatarDraft] = useState<string | null>(null);
  const [groupSubView, setGroupSubView] = useState<"settings" | "type" | "reactions" | "admins" | "members" | "add_members" | "qrcode" | null>(null);
  const groupMembersReturnViewRef = useRef<"settings" | null>(null);
  const [groupIsPublicDraft, setGroupIsPublicDraft] = useState(false);
  const [reactionSettingsDraft, setReactionSettingsDraft] = useState<{ reactionMode: ReactionMode; allowedReactions: string[] }>({ reactionMode: "all", allowedReactions: [] });
  const [groupLinkDraft, setGroupLinkDraft] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalKind, setInviteModalKind] = useState<"group" | "channel" | null>(null);
  const [inviteModalLink, setInviteModalLink] = useState<string | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [groupMemberRemovalTarget, setGroupMemberRemovalTarget] = useState<GroupMember | null>(null);
  const [removingSubscriberId, setRemovingSubscriberId] = useState<string | null>(null);
  const [channelSubscriberRemovalTarget, setChannelSubscriberRemovalTarget] = useState<any | null>(null);
  return {
    groupModalOpen,
    setGroupModalOpen,
    groupModalLoading,
    setGroupModalLoading,
    groupModalError,
    setGroupModalError,
    groupModalData,
    setGroupModalData,
    groupNameDraft,
    setGroupNameDraft,
    groupDescriptionDraft,
    setGroupDescriptionDraft,
    groupNameEditing,
    setGroupNameEditing,
    groupAvatarDraft,
    setGroupAvatarDraft,
    groupSubView,
    setGroupSubView,
    groupMembersReturnViewRef,
    groupIsPublicDraft,
    setGroupIsPublicDraft,
    reactionSettingsDraft,
    setReactionSettingsDraft,
    groupLinkDraft,
    setGroupLinkDraft,
    inviteModalOpen,
    setInviteModalOpen,
    inviteModalKind,
    setInviteModalKind,
    inviteModalLink,
    setInviteModalLink,
    groupSaving,
    setGroupSaving,
    leavingGroup,
    setLeavingGroup,
    deletingGroup,
    setDeletingGroup,
    joiningGroup,
    setJoiningGroup,
    removingMemberId,
    setRemovingMemberId,
    groupMemberRemovalTarget,
    setGroupMemberRemovalTarget,
    removingSubscriberId,
    setRemovingSubscriberId,
    channelSubscriberRemovalTarget,
    setChannelSubscriberRemovalTarget
  };
}

export function useMemberRoleState() {
  const [roleEditorKind, setRoleEditorKind] = useState<"group" | "channel">("group");
  const [roleModalMember, setRoleModalMember] = useState<any | null>(null);
  const [roleNameDraft, setRoleNameDraft] = useState("");
  const [permChangeAvatar, setPermChangeAvatar] = useState(false);
  const [permChangeName, setPermChangeName] = useState(false);
  const [permChangeReactions, setPermChangeReactions] = useState(false);
  const [permPinMessages, setPermPinMessages] = useState(false);
  const [permDeleteForeign, setPermDeleteForeign] = useState(false);
  const [permAddMembers, setPermAddMembers] = useState(false);
  const [permPostMessages, setPermPostMessages] = useState(true);
  const [permEditForeignMessages, setPermEditForeignMessages] = useState(false);
  const [permDeleteForeignMessages, setPermDeleteForeignMessages] = useState(false);
  const [permGenerateInviteLink, setPermGenerateInviteLink] = useState(false);
  const [permManageAdmins, setPermManageAdmins] = useState(false);
  const [roleEditorInitial, setRoleEditorInitial] = useState<{
    roleName: string;
    canChangeAvatar: boolean;
    canChangeName: boolean;
    canChangeReactions: boolean;
    canPinMessages: boolean;
    canDeleteForeignMessages: boolean;
    canAddMembers: boolean;
    canPostMessages: boolean;
    canGenerateInviteLink: boolean;
    canManageAdmins: boolean;
    canEditForeignMessages?: boolean;
    canDeleteForeignMessages_channel?: boolean;
  } | null>(null);
  return {
    roleEditorKind,
    setRoleEditorKind,
    roleModalMember,
    setRoleModalMember,
    roleNameDraft,
    setRoleNameDraft,
    permChangeAvatar,
    setPermChangeAvatar,
    permChangeName,
    setPermChangeName,
    permChangeReactions,
    setPermChangeReactions,
    permPinMessages,
    setPermPinMessages,
    permDeleteForeign,
    setPermDeleteForeign,
    permAddMembers,
    setPermAddMembers,
    permPostMessages,
    setPermPostMessages,
    permEditForeignMessages,
    setPermEditForeignMessages,
    permDeleteForeignMessages,
    setPermDeleteForeignMessages,
    permGenerateInviteLink,
    setPermGenerateInviteLink,
    permManageAdmins,
    setPermManageAdmins,
    roleEditorInitial,
    setRoleEditorInitial
  };
}

export function useSecretChatDraftState() {
  const [secretChatCreateOpen, setSecretChatCreateOpen] = useState(false);
  const [secretChatInfoOpen, setSecretChatInfoOpen] = useState(false);
  const [secretChatCreateStep, setSecretChatCreateStep] = useState<"details" | "members">("details");
  const [secretChatTitle, setSecretChatTitle] = useState("");
  const [secretChatSearchQuery, setSecretChatSearchQuery] = useState("");
  const [secretChatSelectedUserIds, setSecretChatSelectedUserIds] = useState<Set<string>>(new Set());
  const [secretChatLifetimeDays, setSecretChatLifetimeDays] = useState(0);
  const [secretChatLifetimeHours, setSecretChatLifetimeHours] = useState(1);
  const [secretChatLifetimeMinutes, setSecretChatLifetimeMinutes] = useState(0);
  const [secretChatLifetimePreset, setSecretChatLifetimePreset] = useState<'1h' | '1d' | '1w' | '1m' | 'custom'>('1h');
  const [secretChatCodeword, setSecretChatCodeword] = useState("");
  const [secretChatCreating, setSecretChatCreating] = useState(false);
  const [secretChatExpiresAt, setSecretChatExpiresAt] = useState<string | null>(null);
  const [acceptingSecretChat, setAcceptingSecretChat] = useState(false);
  const [globalMusicVisible, setGlobalMusicVisible] = useState(false);
  return {
    secretChatCreateOpen,
    setSecretChatCreateOpen,
    secretChatInfoOpen,
    setSecretChatInfoOpen,
    secretChatCreateStep,
    setSecretChatCreateStep,
    secretChatTitle,
    setSecretChatTitle,
    secretChatSearchQuery,
    setSecretChatSearchQuery,
    secretChatSelectedUserIds,
    setSecretChatSelectedUserIds,
    secretChatLifetimeDays,
    setSecretChatLifetimeDays,
    secretChatLifetimeHours,
    setSecretChatLifetimeHours,
    secretChatLifetimeMinutes,
    setSecretChatLifetimeMinutes,
    secretChatLifetimePreset,
    setSecretChatLifetimePreset,
    secretChatCodeword,
    setSecretChatCodeword,
    secretChatCreating,
    setSecretChatCreating,
    secretChatExpiresAt,
    setSecretChatExpiresAt,
    acceptingSecretChat,
    setAcceptingSecretChat,
    globalMusicVisible,
    setGlobalMusicVisible
  };
}
