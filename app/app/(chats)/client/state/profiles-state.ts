"use client";

import { useRef, useState } from "react";
import { type ChannelModalData, type ChatImageGalleryItem } from "../../types";

export function useProfileNavigationState() {
  const [profileOpenedExternally, setProfileOpenedExternally] = useState(false);
  const [profileMoreOpen, setProfileMoreOpen] = useState(false);
  const [hoverReactionMessageId, setHoverReactionMessageId] = useState<string | null>(null);
  const [hoverReactionExpandedMessageId, setHoverReactionExpandedMessageId] = useState<string | null>(null);
  const [messageHelperAllReactionsOpen, setMessageHelperAllReactionsOpen] = useState(false);
  const hoverReactionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverReactionLeaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [profileSubView, setProfileSubView] = useState<"qrcode" | "contact_editor" | "secret_chat" | null>(null);
  const [qrModalProfile, setQrModalProfile] = useState<{ displayName?: string | null; link?: string | null; avatarUrl?: string | null; id?: string } | null>(null);
  const [linkEditorTarget, setLinkEditorTarget] = useState<{ kind: "group" | "channel"; currentLink: string } | null>(null);
  const [linkEditorValue, setLinkEditorValue] = useState("");
  const [linkEditorStatus, setLinkEditorStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [linkEditorSaving, setLinkEditorSaving] = useState(false);
  return {
    profileOpenedExternally,
    setProfileOpenedExternally,
    profileMoreOpen,
    setProfileMoreOpen,
    hoverReactionMessageId,
    setHoverReactionMessageId,
    hoverReactionExpandedMessageId,
    setHoverReactionExpandedMessageId,
    messageHelperAllReactionsOpen,
    setMessageHelperAllReactionsOpen,
    hoverReactionTimerRef,
    hoverReactionLeaveTimerRef,
    profileSubView,
    setProfileSubView,
    qrModalProfile,
    setQrModalProfile,
    linkEditorTarget,
    setLinkEditorTarget,
    linkEditorValue,
    setLinkEditorValue,
    linkEditorStatus,
    setLinkEditorStatus,
    linkEditorSaving,
    setLinkEditorSaving
  };
}

export function useMediaAndChannelState(groupSubView: "settings" | "type" | "reactions" | "admins" | "members" | "add_members" | "qrcode" | null) {
  const [savingRole, setSavingRole] = useState(false);
  const [groupDangerAction, setGroupDangerAction] = useState<"leave" | "delete" | null>(null);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [channelModalLoading, setChannelModalLoading] = useState(false);
  const [channelModalError, setChannelModalError] = useState<string | null>(null);
  const [channelModalData, setChannelModalData] = useState<ChannelModalData | null>(null);
  const [channelNameDraft, setChannelNameDraft] = useState("");
  const [channelDescriptionDraft, setChannelDescriptionDraft] = useState("");
  const [channelNameEditing, setChannelNameEditing] = useState(false);
  const [channelAvatarDraft, setChannelAvatarDraft] = useState<string | null>(null);
  const [channelSubView, setChannelSubView] = useState<"settings" | "type" | "reactions" | "subscribers" | "admins" | "add_subscribers" | "qrcode" | null>(null);
  const channelMembersReturnViewRef = useRef<"settings" | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [channelIsPublicDraft, setChannelIsPublicDraft] = useState(false);
  const [channelLinkDraft, setChannelLinkDraft] = useState("");
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelLeaving, setChannelLeaving] = useState(false);
  const [channelDeleting, setChannelDeleting] = useState(false);
  const [channelDangerAction, setChannelDangerAction] = useState<"leave" | "delete" | null>(null);
  const [videoViewer, setVideoViewer] = useState<{
    src: string;
    caption: string;
    timeText: string;
    dateText: string;
    messageId: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    authorLink?: string | null;
    canDelete: boolean;
    isMine?: boolean;
  } | null>(null);
  const [videoViewerPlaying, setVideoViewerPlaying] = useState(false);
  const [videoViewerProgress, setVideoViewerProgress] = useState(0);
  const [videoViewerDuration, setVideoViewerDuration] = useState(0);
  const [videoViewerCurrentTime, setVideoViewerCurrentTime] = useState(0);
  const [videoViewerMuted, setVideoViewerMuted] = useState(false);
  const [videoViewerFailed, setVideoViewerFailed] = useState(false);
  const [videoViewerMenuOpen, setVideoViewerMenuOpen] = useState(false);
  const [imageViewer, setImageViewer] = useState<ChatImageGalleryItem | null>(null);
  const [imageViewerIndex, setImageViewerIndex] = useState<number>(-1);
  const [imageViewerDirection, setImageViewerDirection] = useState<-1 | 1>(1);
  const [imageViewerPanelVisible, setImageViewerPanelVisible] = useState(true);
  const [imageViewerMenuOpen, setImageViewerMenuOpen] = useState(false);
  const imageViewerTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [addMembersModalOpen, setAddMembersModalOpen] = useState(false);
  const [addMembersContactQuery, setAddMembersContactQuery] = useState("");
  const [addMembersTargetKind, setAddMembersTargetKind] = useState<"group" | "channel">("group");
  const groupAddMembersReturnViewRef = useRef<typeof groupSubView>(null);
  const channelAddMembersReturnViewRef = useRef<typeof channelSubView>(null);
  const [contactsForAdd, setContactsForAdd] = useState<
    Array<{ id: string; link: string; alias: string; avatarUrl?: string | null; displayName?: string }>
  >([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [addMembersContactsLoading, setAddMembersContactsLoading] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  return {
    savingRole,
    setSavingRole,
    groupDangerAction,
    setGroupDangerAction,
    channelModalOpen,
    setChannelModalOpen,
    channelModalLoading,
    setChannelModalLoading,
    channelModalError,
    setChannelModalError,
    channelModalData,
    setChannelModalData,
    channelNameDraft,
    setChannelNameDraft,
    channelDescriptionDraft,
    setChannelDescriptionDraft,
    channelNameEditing,
    setChannelNameEditing,
    channelAvatarDraft,
    setChannelAvatarDraft,
    channelSubView,
    setChannelSubView,
    channelMembersReturnViewRef,
    memberSearchQuery,
    setMemberSearchQuery,
    channelIsPublicDraft,
    setChannelIsPublicDraft,
    channelLinkDraft,
    setChannelLinkDraft,
    channelSaving,
    setChannelSaving,
    channelLeaving,
    setChannelLeaving,
    channelDeleting,
    setChannelDeleting,
    channelDangerAction,
    setChannelDangerAction,
    videoViewer,
    setVideoViewer,
    videoViewerPlaying,
    setVideoViewerPlaying,
    videoViewerProgress,
    setVideoViewerProgress,
    videoViewerDuration,
    setVideoViewerDuration,
    videoViewerCurrentTime,
    setVideoViewerCurrentTime,
    videoViewerMuted,
    setVideoViewerMuted,
    videoViewerFailed,
    setVideoViewerFailed,
    videoViewerMenuOpen,
    setVideoViewerMenuOpen,
    imageViewer,
    setImageViewer,
    imageViewerIndex,
    setImageViewerIndex,
    imageViewerDirection,
    setImageViewerDirection,
    imageViewerPanelVisible,
    setImageViewerPanelVisible,
    imageViewerMenuOpen,
    setImageViewerMenuOpen,
    imageViewerTouchRef,
    isCoarsePointer,
    setIsCoarsePointer,
    addMembersModalOpen,
    setAddMembersModalOpen,
    addMembersContactQuery,
    setAddMembersContactQuery,
    addMembersTargetKind,
    setAddMembersTargetKind,
    groupAddMembersReturnViewRef,
    channelAddMembersReturnViewRef,
    contactsForAdd,
    setContactsForAdd,
    selectedContactIds,
    setSelectedContactIds,
    addMembersContactsLoading,
    setAddMembersContactsLoading,
    addingMembers,
    setAddingMembers
  };
}

export function useUserDetailsState() {
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileActiveTab, setProfileActiveTab] = useState<"members" | "media" | "files" | "voice" | "links" | "music">("media");
  const [profilePlayingAudioUrl, setProfilePlayingAudioUrl] = useState<string | null>(null);
  const [profileScrollTop, setProfileScrollTop] = useState(0);
  return {
    profileLoading,
    setProfileLoading,
    profileActiveTab,
    setProfileActiveTab,
    profilePlayingAudioUrl,
    setProfilePlayingAudioUrl,
    profileScrollTop,
    setProfileScrollTop
  };
}

export function useContactEditorState() {
  const [collectibleModalUsername, setCollectibleModalUsername] = useState<string | null>(null);
  const [, bumpProfileBatchVersion] = useState(0);
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactExists, setContactExists] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [contactEditorOpen, setContactEditorOpen] = useState(false);
  const [contactEditorTarget, setContactEditorTarget] = useState<{ link: string; displayName: string; avatarUrl?: string | null } | null>(null);
  const [contactEditorInitial, setContactEditorInitial] = useState<{ firstName: string; lastName: string } | null>(null);
  return {
    collectibleModalUsername,
    setCollectibleModalUsername,
    bumpProfileBatchVersion,
    contactFirstName,
    setContactFirstName,
    contactLastName,
    setContactLastName,
    contactExists,
    setContactExists,
    contactSaving,
    setContactSaving,
    contactMessage,
    setContactMessage,
    contactEditorOpen,
    setContactEditorOpen,
    contactEditorTarget,
    setContactEditorTarget,
    contactEditorInitial,
    setContactEditorInitial
  };
}
