"use client";

import { type GroupModalData, type ConversationResponse, type ChannelModalData, type ChatSummary, type ChatSearchChannel, type ConversationChatType, type DecryptedMessage, type ProfilePreview, type GroupMember, type ContactResponse } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ChangeEvent } from "react";
import { apiRequest } from "@/lib/client/http";
import { showAppToast, appToast as toast } from "@/lib/client/app-toast";
import { ECLIPSE_DIALOG_LINK } from "@/lib/eclipse-system";
import { broadcastProfileUpdated } from "@/lib/client/local-updates";
import { splitContactAliasParts } from "../helpers";
import { GROUP_AVATAR_LIMITS, HEIC_IMAGE_TYPES, isGifFile, CHANNEL_AVATAR_LIMITS } from "./media-files";
import { convertHeicToJpeg, getVideoDurationMs } from "./media-recording";
import { isLikelyPublicLink } from "./message-links";
import { decryptedPayloadFailureCache, readProfileDetailsMemoryCache, loadProfilePersistentCache, writeProfileDetailsMemoryCache, saveProfilePersistentCache } from "./chat-cache";
import { GROUP_MODAL_CACHE_TTL_MS, CHANNEL_MODAL_CACHE_TTL_MS } from "./config";
import { contactDisplayName } from "./profile-primitives";

export interface AddMembersToGroupActionContext {
  groupModalData: GroupModalData | null;
  addingMembers: boolean;
  selectedContactIds: string[];
  activeConversation: ConversationResponse | null;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  t: (source: string, values?: TranslationValues | undefined) => string;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setAddingMembers: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorText: (message: string | null) => void;
  ensureSharedKeyForMembers: (chatType: "group" | "channel", link: string, chatId: string, targetUserIds?: string[] | undefined) => Promise<{ version: number; added: number; failedVersions: number[]; } | null>;
  setGroupSubView: React.Dispatch<React.SetStateAction<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>>;
  setAddMembersModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  openGroupModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
}

export async function addMembersToGroupAction({ groupModalData, addingMembers, selectedContactIds, activeConversation, contactsForAdd, t, setGroupModalData, groupModalCacheRef, setActiveConversation, setAddingMembers, setErrorText, ensureSharedKeyForMembers, setGroupSubView, setAddMembersModalOpen, setSelectedContactIds, openGroupModal }: AddMembersToGroupActionContext): Promise<void> {
  if (!groupModalData?.group?.link || addingMembers || selectedContactIds.length === 0) return;
  const groupLink = groupModalData.group.link;
  const prevGroupModal = groupModalData;
  const prevActiveConversation = activeConversation;
  const contactsById = new Map(contactsForAdd.map((contact) => [contact.id, contact]));
  const existingIds = new Set(groupModalData.members.map((member) => member.id));
  const optimisticMembers: GroupMember[] = selectedContactIds
    .filter((id) => !existingIds.has(id))
    .map((id) => {
      const contact = contactsById.get(id);
      const displayName = contact?.alias?.trim() || contact?.displayName?.trim() || contact?.link || t("Участник");
      return {
        id,
        link: contact?.link || "",
        displayName,
        avatarUrl: contact?.avatarUrl ?? null,
        isContact: true,
        contactAlias: displayName,
        contactTag: null,
        contactTagVariant: "outline" as const,
      };
    })
    .filter((member) => member.link);

  if (optimisticMembers.length > 0) {
    setGroupModalData((prev) => {
      if (!prev) return prev;
      const next = { ...prev, members: [...prev.members, ...optimisticMembers] };
      groupModalCacheRef.current.set(prev.group.link, { savedAt: Date.now(), data: next });
      return next;
    });
    setActiveConversation((prev) =>
      prev?.chatType === "group" && prev.group?.link === groupLink
        ? { ...prev, members: [...(prev.members ?? []), ...optimisticMembers] }
        : prev,
    );
  }
  setAddingMembers(true);
  try {
    const result = await apiRequest<{ added: number; skipped: number; inviteSuggestedUserIds?: string[] }>(
      `/api/groups/${encodeURIComponent(groupLink)}/members`,
      {
        method: "POST",
        body: JSON.stringify({ memberIds: selectedContactIds }),
      },
    );
    if (result.inviteSuggestedUserIds?.length) {
      setErrorText(t("Некоторых пользователей нельзя добавить напрямую. Отправьте им ссылку-приглашение."));
    }
    try {
      if (groupModalData?.group?.id && result.added > 0) {
        await ensureSharedKeyForMembers("group", groupLink, groupModalData.group.id, selectedContactIds);
      }
    } catch {
      // ignore key sync failures
    }
    setGroupSubView("members");
    setAddMembersModalOpen(false);
    setSelectedContactIds([]);
    void openGroupModal(groupLink);
  } catch (error) {
    if (prevGroupModal) {
      setGroupModalData(prevGroupModal);
      groupModalCacheRef.current.set(prevGroupModal.group.link, { savedAt: Date.now(), data: prevGroupModal });
    }
    if (prevActiveConversation) {
      setActiveConversation((prev) =>
        prev?.chatType === "group" && prev.group?.link === groupLink ? prevActiveConversation : prev,
      );
    }
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  } finally {
    setAddingMembers(false);
  }
}

export interface AddSubscribersToChannelActionContext {
  channelModalData: ChannelModalData | null;
  addingMembers: boolean;
  selectedContactIds: string[];
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  t: (source: string, values?: TranslationValues | undefined) => string;
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setChannelSubView: React.Dispatch<React.SetStateAction<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>>;
  setAddMembersModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  setAddingMembers: React.Dispatch<React.SetStateAction<boolean>>;
  ensureSharedKeyForMembers: (chatType: "group" | "channel", link: string, chatId: string, targetUserIds?: string[] | undefined) => Promise<{ version: number; added: number; failedVersions: number[]; } | null>;
  openChannelModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
  setErrorText: (message: string | null) => void;
}

export async function addSubscribersToChannelAction({ channelModalData, addingMembers, selectedContactIds, contactsForAdd, t, setChannelModalData, channelModalCacheRef, setChats, setChannelSubView, setAddMembersModalOpen, setSelectedContactIds, setAddingMembers, ensureSharedKeyForMembers, openChannelModal, setErrorText }: AddSubscribersToChannelActionContext): Promise<void> {
  if (!channelModalData?.channel?.link || addingMembers || selectedContactIds.length === 0) return;
  const channelLink = channelModalData.channel.link;
  const prevChannelModal = channelModalData;
  const contactsById = new Map(contactsForAdd.map((contact) => [contact.id, contact]));
  const existingIds = new Set((channelModalData.subscribers ?? channelModalData.members ?? []).map((s: any) => s.id));
  const optimisticSubscribers = selectedContactIds
    .filter((id) => !existingIds.has(id))
    .map((id) => {
      const contact = contactsById.get(id);
      const displayName = contact?.alias?.trim() || contact?.displayName?.trim() || contact?.link || t("Подписчик");
      return {
        id,
        link: contact?.link || "",
        displayName,
        avatarUrl: contact?.avatarUrl ?? null,
        role: "member",
        roleLabel: null,
        canChangeAvatar: false,
        canChangeName: false,
        canChangeReactions: false,
        canPinMessages: false,
        canPostMessages: false,
        canEditForeignMessages: false,
        canDeleteForeignMessages: false,
        canAddMembers: false,
        canGenerateInviteLink: false,
        canManageAdmins: false,
      };
    })
    .filter((sub) => sub.link);

  if (optimisticSubscribers.length > 0) {
    setChannelModalData((prev) => {
      if (!prev) return prev;
      const currentSubs = prev.subscribers ?? prev.members ?? [];
      const nextSubs = [...currentSubs, ...optimisticSubscribers];
      const next = {
        ...prev,
        subscribers: nextSubs,
        members: nextSubs,
        channel: {
          ...prev.channel,
          subscribersCount: String(Number(prev.channel.subscribersCount || 0) + optimisticSubscribers.length),
        },
      };
      channelModalCacheRef.current.set(prev.channel.link, { savedAt: Date.now(), data: next });
      return next;
    });
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatType === "channel" && chat.link === channelLink
          ? { ...chat, subscribersCount: String(Number(chat.subscribersCount || 0) + optimisticSubscribers.length) }
          : chat,
      ),
    );
  }
  setChannelSubView("subscribers");
  setAddMembersModalOpen(false);
  setSelectedContactIds([]);
  setAddingMembers(true);
  try {
    const result = await apiRequest<{ added: number; skipped: number; subscribersCount: string }>(
      `/api/channels/${encodeURIComponent(channelLink)}/subscribers`,
      {
        method: "POST",
        body: JSON.stringify({ memberIds: selectedContactIds }),
      },
    );
    setChannelModalData((prev) =>
      prev
        ? {
          ...prev,
          channel: {
            ...prev.channel,
            subscribersCount: result.subscribersCount,
          },
        }
        : prev,
    );
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatType === "channel" && chat.link === channelLink
          ? { ...chat, subscribersCount: result.subscribersCount }
          : chat,
      ),
    );
    try {
      if (channelModalData?.channel?.id && result.added > 0) {
        await ensureSharedKeyForMembers("channel", channelLink, channelModalData.channel.id, selectedContactIds);
      }
    } catch {
      // shared-key sync is retried by realtime/key recovery paths
    }
    void openChannelModal(channelLink, { forceRefresh: true });
  } catch (error) {
    if (prevChannelModal) {
      setChannelModalData(prevChannelModal);
      channelModalCacheRef.current.set(channelLink, { savedAt: Date.now(), data: prevChannelModal });
    }
    setErrorText(error instanceof Error ? error.message : t("Не удалось добавить подписчиков"));
  } finally {
    setAddingMembers(false);
  }
}

export interface OnGroupAvatarSelectedActionContext {
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  uploadMediaFile: (file: Blob, kind: "image" | "video" | "voice" | "file" | "audio" | "video_note", durationMs?: number | undefined, scope?: { scopeType: string; scopeId: string; bot?: boolean | undefined; } | undefined) => Promise<{ id: string; url: string; expiresAt?: string | null | undefined; }>;
  setGroupAvatarDraft: React.Dispatch<React.SetStateAction<string | null>>;
}

export async function onGroupAvatarSelectedAction({ setErrorText, t, uploadMediaFile, setGroupAvatarDraft }: OnGroupAvatarSelectedActionContext, event: ChangeEvent<HTMLInputElement>): Promise<void> {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const limits = GROUP_AVATAR_LIMITS;
  let uploadFile = file;
  try {
    if (HEIC_IMAGE_TYPES.has(uploadFile.type)) {
      uploadFile = await convertHeicToJpeg(uploadFile);
    }
    const isVideo = uploadFile.type.startsWith("video/");

    if (isVideo) {
      if (uploadFile.size > limits.videoMaxBytes) {
        setErrorText(t("Видео слишком большое. Максимум {0} МБ.", { 0: Math.round(limits.videoMaxBytes / 1024 / 1024) }));
        return;
      }
      const durationMs = await getVideoDurationMs(uploadFile);
      if (durationMs > limits.maxDurationMs) {
        setErrorText(t("Видео слишком длинное. Максимум {0} сек.", { 0: Math.round(limits.maxDurationMs / 1000) }));
        return;
      }
      const uploaded = await uploadMediaFile(uploadFile, "video", durationMs);
      setGroupAvatarDraft(uploaded.url);

      return;
    }

    if (!uploadFile.type.startsWith("image/")) {
      setErrorText(t("Выберите изображение, GIF или видео для аватара группы"));
      return;
    }

    if (uploadFile.size > limits.imageMaxBytes) {
      setErrorText(t("Файл слишком большой. Максимум {0} МБ.", { 0: Math.round(limits.imageMaxBytes / 1024 / 1024) }));
      return;
    }

    const uploaded = await uploadMediaFile(uploadFile, "image");
    setGroupAvatarDraft(uploaded.url);

  } catch {
    setErrorText(isGifFile(file) ? t("Не удалось обработать GIF") : t("Не удалось обработать файл"));
  }
}

export interface OnChannelAvatarSelectedActionContext {
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  uploadMediaFile: (file: Blob, kind: "image" | "video" | "voice" | "file" | "audio" | "video_note", durationMs?: number | undefined, scope?: { scopeType: string; scopeId: string; bot?: boolean | undefined; } | undefined) => Promise<{ id: string; url: string; expiresAt?: string | null | undefined; }>;
  setChannelAvatarDraft: React.Dispatch<React.SetStateAction<string | null>>;
}

export async function onChannelAvatarSelectedAction({ setErrorText, t, uploadMediaFile, setChannelAvatarDraft }: OnChannelAvatarSelectedActionContext, event: ChangeEvent<HTMLInputElement>): Promise<void> {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const limits = CHANNEL_AVATAR_LIMITS;
  let uploadFile = file;
  try {
    if (HEIC_IMAGE_TYPES.has(uploadFile.type)) {
      uploadFile = await convertHeicToJpeg(uploadFile);
    }
    const isVideo = uploadFile.type.startsWith("video/");

    if (isVideo) {
      if (uploadFile.size > limits.videoMaxBytes) {
        setErrorText(t("Видео слишком большое. Максимум {0} МБ.", { 0: Math.round(limits.videoMaxBytes / 1024 / 1024) }));
        return;
      }
      const durationMs = await getVideoDurationMs(uploadFile);
      if (durationMs > limits.maxDurationMs) {
        setErrorText(t("Видео слишком длинное. Максимум {0} сек.", { 0: Math.round(limits.maxDurationMs / 1000) }));
        return;
      }
      const uploaded = await uploadMediaFile(uploadFile, "video", durationMs);
      setChannelAvatarDraft(uploaded.url);

      return;
    }

    if (!uploadFile.type.startsWith("image/")) {
      setErrorText(t("Выберите изображение, GIF или видео для аватара канала"));
      return;
    }

    if (uploadFile.size > limits.imageMaxBytes) {
      setErrorText(t("Файл слишком большой. Максимум {0} МБ.", { 0: Math.round(limits.imageMaxBytes / 1024 / 1024) }));
      return;
    }

    const uploaded = await uploadMediaFile(uploadFile, "image");
    setChannelAvatarDraft(uploaded.url);

  } catch {
    setErrorText(isGifFile(file) ? t("Не удалось обработать GIF") : t("Не удалось обработать файл"));
  }
}

export interface OpenChannelModalActionContext {
  detailsTargetRef: React.RefObject<{ kind: "direct" | "group" | "channel"; link: string; } | null>;
  channelMembersReturnViewRef: React.RefObject<"settings" | null>;
  showDetailsPanel: (kind: "direct" | "group" | "channel", link: string) => void;
  setChannelNameEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setContactEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setChannelModalError: React.Dispatch<React.SetStateAction<string | null>>;
  setChannelSubView: React.Dispatch<React.SetStateAction<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>>;
  setProfileActiveTab: React.Dispatch<React.SetStateAction<"voice" | "music" | "members" | "media" | "files" | "links">>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  activeChannelModalSeed: ChannelModalData | null;
  chats: ChatSummary[];
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  setChannelNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setChannelDescriptionDraft: React.Dispatch<React.SetStateAction<string>>;
  setChannelAvatarDraft: React.Dispatch<React.SetStateAction<string | null>>;
  setChannelIsPublicDraft: React.Dispatch<React.SetStateAction<boolean>>;
  setChannelLinkDraft: React.Dispatch<React.SetStateAction<string>>;
  setChannelModalLoading: React.Dispatch<React.SetStateAction<boolean>>;
  channelDetailsInFlightRef: React.RefObject<Set<string>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setChatSearchChannels: React.Dispatch<React.SetStateAction<ChatSearchChannel[]>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function openChannelModalAction({ detailsTargetRef, channelMembersReturnViewRef, showDetailsPanel, setChannelNameEditing, setContactEditorOpen, setChannelModalError, setChannelSubView, setProfileActiveTab, channelModalCacheRef, activeChannelModalSeed, chats, setChannelModalData, setChannelNameDraft, setChannelDescriptionDraft, setChannelAvatarDraft, setChannelIsPublicDraft, setChannelLinkDraft, setChannelModalLoading, channelDetailsInFlightRef, setActiveConversation, setChatSearchChannels, setChats, t }: OpenChannelModalActionContext, link: string, options?: { forceRefresh?: boolean }): Promise<void> {
  detailsTargetRef.current = { kind: "channel", link };
  const isCurrent = () => detailsTargetRef.current?.kind === "channel" && detailsTargetRef.current.link === link;
  channelMembersReturnViewRef.current = null;
  showDetailsPanel("channel", link);
  setChannelNameEditing(false);
  setContactEditorOpen(false);
  setChannelModalError(null);
  setChannelSubView(null);
  setProfileActiveTab((prev) => (prev === "members" ? "media" : prev));
  const cached = channelModalCacheRef.current.get(link);
  const seeded = activeChannelModalSeed?.channel.link === link ? activeChannelModalSeed : null;
  const fallbackChannelChat = chats.find((c) => c.link === link && c.chatType === "channel");
  const fallbackSeed: ChannelModalData | null = fallbackChannelChat ? {
    channel: {
      id: fallbackChannelChat.peerId || "",
      link: fallbackChannelChat.link,
      name: fallbackChannelChat.displayName,
      avatarUrl: fallbackChannelChat.avatarUrl ?? null,
      ownerId: "",
      isOwner: Boolean((fallbackChannelChat as any).isChannelOwner),
      isSubscribed: false,
      subscribersCount: fallbackChannelChat.subscribersCount ?? "0",
      isPublic: isLikelyPublicLink(fallbackChannelChat.link),
      createdAt: "",
      updatedAt: "",
    },
    subscribers: [],
  } : null;
  const immediate = seeded ?? cached?.data ?? fallbackSeed;
  if (immediate) {
    setChannelModalData(immediate);
    setChannelNameDraft(immediate.channel.name);
    setChannelDescriptionDraft(immediate.channel.description ?? "");
    setChannelAvatarDraft(immediate.channel.avatarUrl ?? null);
    setChannelIsPublicDraft(Boolean(immediate.channel.isPublic));
    setChannelLinkDraft(immediate.channel.link ?? "");
  } else {
    setChannelModalData(null);
    setChannelNameDraft("");
    setChannelDescriptionDraft("");
    setChannelAvatarDraft(null);
    setChannelIsPublicDraft(false);
    setChannelLinkDraft("");
  }
  setChannelModalLoading(!immediate);
  if (channelDetailsInFlightRef.current.has(link) && immediate && !options?.forceRefresh) {
    return;
  }
  channelDetailsInFlightRef.current.add(link);
  try {
    const data = await apiRequest<ChannelModalData>(`/api/channels/${encodeURIComponent(link)}`, { method: "GET", cache: "no-store" });
    channelModalCacheRef.current.set(link, { savedAt: Date.now(), data });
    if (!isCurrent()) return;
    setChannelModalData(data);
    setActiveConversation(prev => prev?.chatType === "channel" && prev.channel?.link === link ? { ...prev, channel: { ...prev.channel, isSubscribed: data.channel.isSubscribed, subscribersCount: data.channel.subscribersCount } } : prev);
    setChatSearchChannels(prev => prev.map(channel => channel.link === link ? { ...channel, subscribersCount: data.channel.subscribersCount } : channel));
    setChats(prev => prev.map(chat => chat.chatType === "channel" && chat.link === link ? { ...chat, subscribersCount: data.channel.subscribersCount } : chat));
    setChannelNameDraft(data.channel.name);
    setChannelDescriptionDraft(data.channel.description ?? "");
    setChannelAvatarDraft(data.channel.avatarUrl ?? null);
    setChannelIsPublicDraft(Boolean(data.channel.isPublic));
    setChannelLinkDraft(data.channel.link ?? "");
  } catch (error) {
    if (isCurrent() && !immediate) {
      setChannelModalData(null);
      setChannelModalError(error instanceof Error ? error.message : t("Не удалось загрузить канал"));
    }
  } finally {
    channelDetailsInFlightRef.current.delete(link);
    if (isCurrent()) setChannelModalLoading(false);
  }
}

export interface SubscribeToActiveChannelActionContext {
  activeConversation: ConversationResponse | null;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setChatSearchChannels: React.Dispatch<React.SetStateAction<ChatSearchChannel[]>>;
  setRecentSearches: React.Dispatch<React.SetStateAction<{ ownerId: string | null; items: ChatSummary[]; }>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  sharedKeyServerCacheRef: React.RefObject<Map<string, { expiresAt: number; value: { version: number; keyBase64: string; createdAt: number; } | null; }>>;
  conversationDecryptRetryRef: React.RefObject<Record<string, { fingerprint: string; attempts: number; lastAttemptAt: number; }>>;
  selectedLinkRef: React.RefObject<string | null>;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function subscribeToActiveChannelAction({ activeConversation, setActiveConversation, setChats, setChatSearchChannels, setRecentSearches, channelModalCacheRef, setChannelModalData, sharedKeyServerCacheRef, conversationDecryptRetryRef, selectedLinkRef, openConversationRef, setErrorText, t }: SubscribeToActiveChannelActionContext): Promise<void> {
  const link = activeConversation?.chatType === "channel" ? activeConversation.channel?.link : null;
  if (!link) return;
  try {
    const data = await apiRequest<{ subscribed: boolean; subscribersCount: string }>(
      `/api/channels/${encodeURIComponent(link)}/subscribe`,
      { method: "POST", body: JSON.stringify({}) },
    );
    setActiveConversation((prev) =>
      prev?.chatType === "channel" && prev.channel
        ? { ...prev, channel: { ...prev.channel, isSubscribed: data.subscribed, subscribersCount: data.subscribersCount } }
        : prev,
    );
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatType === "channel" && chat.link === link
          ? { ...chat, subscribersCount: data.subscribersCount }
          : chat,
      ),
    );
    setChatSearchChannels(prev => prev.map(channel => channel.link === link ? { ...channel, subscribersCount: data.subscribersCount } : channel));
    setRecentSearches(prev => ({ ...prev, items: prev.items.map(chat => chat.chatType === "channel" && chat.link === link ? { ...chat, subscribersCount: data.subscribersCount } : chat) }));
    channelModalCacheRef.current.delete(link);
    setChannelModalData(prev => prev?.channel.link === link ? { ...prev, channel: { ...prev.channel, isSubscribed: data.subscribed, subscribersCount: data.subscribersCount } } : prev);
    decryptedPayloadFailureCache.clear();
    sharedKeyServerCacheRef.current.clear();
    delete conversationDecryptRetryRef.current[link];
    if (selectedLinkRef.current === link) await openConversationRef.current(link, { force: true, chatType: "channel" });
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  }
}

export interface JoinActiveGroupActionContext {
  activeConversation: ConversationResponse | null;
  activeChat: ChatSummary | null;
  joiningGroup: boolean;
  setJoiningGroup: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  sharedKeyServerCacheRef: React.RefObject<Map<string, { expiresAt: number; value: { version: number; keyBase64: string; createdAt: number; } | null; }>>;
  conversationDecryptRetryRef: React.RefObject<Record<string, { fingerprint: string; attempts: number; lastAttemptAt: number; }>>;
  selectedLinkRef: React.RefObject<string | null>;
  openConversationRef: React.RefObject<(link: string, options?: { force?: boolean | undefined; revalidate?: boolean | undefined; chatType?: ConversationChatType | undefined; } | undefined) => Promise<void>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setErrorText: (message: string | null) => void;
}

export async function joinActiveGroupAction({ activeConversation, activeChat, joiningGroup, setJoiningGroup, setActiveConversation, setChats, sharedKeyServerCacheRef, conversationDecryptRetryRef, selectedLinkRef, openConversationRef, t, setErrorText }: JoinActiveGroupActionContext): Promise<void> {
  const link = activeConversation?.chatType === "group" ? activeConversation.group?.link || activeChat?.link : null;
  if (!link || joiningGroup) return;
  setJoiningGroup(true);
  try {
    const data = await apiRequest<{ joined: boolean; membersCount: number; group: any }>(
      `/api/groups/${encodeURIComponent(link)}/join`,
      { method: "POST", body: JSON.stringify({}) },
    );
    setActiveConversation((prev) =>
      prev?.chatType === "group"
        ? {
          ...prev,
          group: {
            ...prev.group,
            ...(data.group ?? {}),
            myRole: "member",
          },
        }
        : prev,
    );
    setChats((prev) =>
      prev.map((chat) =>
        chat.chatType === "group" && chat.link === link
          ? { ...chat, membersCount: String(data.membersCount) }
          : chat,
      ),
    );
    decryptedPayloadFailureCache.clear();
    sharedKeyServerCacheRef.current.clear();
    delete conversationDecryptRetryRef.current[link];
    if (selectedLinkRef.current === link) await openConversationRef.current(link, { force: true, chatType: "group" });
    toast.success(t("Вы вступили в группу"));
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Не удалось вступить в группу"));
  } finally {
    setJoiningGroup(false);
  }
}

export interface LeaveChannelActionContext {
  channelModalData: ChannelModalData | null;
  channelLeaving: boolean;
  setChannelLeaving: React.Dispatch<React.SetStateAction<boolean>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  setChatSearchChannels: React.Dispatch<React.SetStateAction<ChatSearchChannel[]>>;
  setRecentSearches: React.Dispatch<React.SetStateAction<{ ownerId: string | null; items: ChatSummary[]; }>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setChannelModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLink: string | null;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setChannelModalError: React.Dispatch<React.SetStateAction<string | null>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function leaveChannelAction({ channelModalData, channelLeaving, setChannelLeaving, channelModalCacheRef, setChannelModalData, setChatSearchChannels, setRecentSearches, setChats, setChannelModalOpen, selectedLink, setSelectedLink, setActiveConversation, setMessages, setChannelModalError, t }: LeaveChannelActionContext): Promise<void> {
  if (!channelModalData?.channel?.link || channelLeaving || channelModalData.channel.isOwner || !channelModalData.channel.isSubscribed) return;
  setChannelLeaving(true);
  try {
    const data = await apiRequest<{ subscribed: boolean; subscribersCount: string }>(`/api/channels/${encodeURIComponent(channelModalData.channel.link)}/subscribe`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const link = channelModalData.channel.link;
    channelModalCacheRef.current.delete(link);
    setChannelModalData(prev => prev?.channel.link === link ? { ...prev, channel: { ...prev.channel, isSubscribed: false, subscribersCount: data.subscribersCount } } : prev);
    setChatSearchChannels(prev => prev.map(channel => channel.link === link ? { ...channel, subscribersCount: data.subscribersCount } : channel));
    setRecentSearches(prev => ({ ...prev, items: prev.items.map(chat => chat.chatType === "channel" && chat.link === link ? { ...chat, subscribersCount: data.subscribersCount } : chat) }));
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
    setChannelModalError(error instanceof Error ? error.message : t("Не удалось покинуть канал"));
  } finally {
    setChannelLeaving(false);
  }
}

export interface RemoveMemberFromGroupActionContext {
  groupModalData: GroupModalData | null;
  removingMemberId: string | null;
  activeConversation: ConversationResponse | null;
  setRemovingMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  setErrorText: (message: string | null) => void;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  openGroupModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function removeMemberFromGroupAction({ groupModalData, removingMemberId, activeConversation, setRemovingMemberId, setErrorText, setGroupModalData, groupModalCacheRef, setActiveConversation, openGroupModal, t }: RemoveMemberFromGroupActionContext, memberId: string): Promise<void> {
  if (!groupModalData?.group?.link || removingMemberId) return;
  const groupLink = groupModalData.group.link;
  const prevGroupModal = groupModalData;
  const prevActiveConversation = activeConversation;
  setRemovingMemberId(memberId);
  setErrorText(null);
  setGroupModalData((prev) => {
    if (!prev) return prev;
    const next = { ...prev, members: prev.members.filter((member) => member.id !== memberId) };
    groupModalCacheRef.current.set(prev.group.link, { savedAt: Date.now(), data: next });
    return next;
  });
  setActiveConversation((prev) =>
    prev?.chatType === "group" && prev.group?.link === groupLink
      ? { ...prev, members: (prev.members ?? []).filter((member) => member.id !== memberId) }
      : prev,
  );
  try {
    await apiRequest(`/api/groups/${encodeURIComponent(groupLink)}/members`, {
      method: "DELETE",
      body: JSON.stringify({ memberId }),
    });
    await openGroupModal(groupLink);
  } catch (error) {
    if (prevGroupModal) {
      setGroupModalData(prevGroupModal);
      groupModalCacheRef.current.set(prevGroupModal.group.link, { savedAt: Date.now(), data: prevGroupModal });
    }
    if (prevActiveConversation) {
      setActiveConversation((prev) =>
        prev?.chatType === "group" && prev.group?.link === groupLink ? prevActiveConversation : prev,
      );
    }
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  } finally {
    setRemovingMemberId(null);
  }
}

export interface OpenRoleEditorActionContext {
  effectiveDetailsChatType: ConversationChatType | null;
  channelModalOpen: boolean;
  setRoleEditorKind: React.Dispatch<React.SetStateAction<"group" | "channel">>;
  setRoleModalMember: React.Dispatch<React.SetStateAction<GroupMember | null>>;
  setRoleNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setPermChangeAvatar: React.Dispatch<React.SetStateAction<boolean>>;
  setPermChangeName: React.Dispatch<React.SetStateAction<boolean>>;
  setPermChangeReactions: React.Dispatch<React.SetStateAction<boolean>>;
  setPermPinMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setPermStartVideoChat: React.Dispatch<React.SetStateAction<boolean>>;
  setPermDeleteForeign: React.Dispatch<React.SetStateAction<boolean>>;
  setPermAddMembers: React.Dispatch<React.SetStateAction<boolean>>;
  setPermPostMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setPermEditForeignMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setPermDeleteForeignMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setPermGenerateInviteLink: React.Dispatch<React.SetStateAction<boolean>>;
  setPermManageAdmins: React.Dispatch<React.SetStateAction<boolean>>;
  setRoleEditorInitial: React.Dispatch<React.SetStateAction<{ roleName: string; canChangeAvatar: boolean; canChangeName: boolean; canChangeReactions: boolean; canPinMessages: boolean; canStartVideoChat: boolean; canDeleteForeignMessages: boolean; canAddMembers: boolean; canPostMessages: boolean; canGenerateInviteLink: boolean; canManageAdmins: boolean; canEditForeignMessages?: boolean | undefined; canDeleteForeignMessages_channel?: boolean | undefined; } | null>>;
}

export function openRoleEditorAction({ effectiveDetailsChatType, channelModalOpen, setRoleEditorKind, setRoleModalMember, setRoleNameDraft, setPermChangeAvatar, setPermChangeName, setPermChangeReactions, setPermPinMessages, setPermStartVideoChat, setPermDeleteForeign, setPermAddMembers, setPermPostMessages, setPermEditForeignMessages, setPermDeleteForeignMessages, setPermGenerateInviteLink, setPermManageAdmins, setRoleEditorInitial }: OpenRoleEditorActionContext, member: any, kind: "group" | "channel" = effectiveDetailsChatType === "channel" || channelModalOpen ? "channel" : "group"): void {
  setRoleEditorKind(kind);
  setRoleModalMember(member);
  const nextRoleName = member.roleLabel?.trim() || "";
  const nextCanChangeAvatar = Boolean(member.canChangeAvatar);
  const nextCanChangeName = Boolean(member.canChangeName);
  const nextCanChangeReactions = Boolean(member.canChangeReactions);
  const nextCanPinMessages = Boolean(member.canPinMessages);
  const nextCanStartVideoChat = Boolean(member.canStartVideoChat);
  const nextCanDeleteForeignMessages = Boolean(member.canDeleteForeignMessages);
  const nextCanAddMembers = Boolean(member.canAddMembers);
  const nextCanPostMessages = member.canPostMessages !== undefined ? Boolean(member.canPostMessages) : true;
  const nextCanEditForeignMessages = Boolean(member.canEditForeignMessages);
  const nextCanDeleteForeignMessages_chan = Boolean(member.canDeleteForeignMessages);
  const nextCanGenerateInviteLink = Boolean(member.canGenerateInviteLink);
  const nextCanManageAdmins = Boolean(member.canManageAdmins);
  setRoleNameDraft(nextRoleName);
  setPermChangeAvatar(nextCanChangeAvatar);
  setPermChangeName(nextCanChangeName);
  setPermChangeReactions(nextCanChangeReactions);
  setPermPinMessages(nextCanPinMessages);
  setPermStartVideoChat(nextCanStartVideoChat);
  setPermDeleteForeign(nextCanDeleteForeignMessages);
  setPermAddMembers(nextCanAddMembers);
  setPermPostMessages(nextCanPostMessages);
  setPermEditForeignMessages(nextCanEditForeignMessages);
  setPermDeleteForeignMessages(nextCanDeleteForeignMessages_chan);
  setPermGenerateInviteLink(nextCanGenerateInviteLink);
  setPermManageAdmins(nextCanManageAdmins);

  setRoleEditorInitial({
    roleName: nextRoleName,
    canChangeAvatar: nextCanChangeAvatar,
    canChangeName: nextCanChangeName,
    canChangeReactions: nextCanChangeReactions,
    canPinMessages: nextCanPinMessages,
    canStartVideoChat: nextCanStartVideoChat,
    canDeleteForeignMessages: nextCanDeleteForeignMessages,
    canAddMembers: nextCanAddMembers,
    canPostMessages: nextCanPostMessages,
    canGenerateInviteLink: nextCanGenerateInviteLink,
    canManageAdmins: nextCanManageAdmins,
    canEditForeignMessages: nextCanEditForeignMessages,
    canDeleteForeignMessages_channel: nextCanDeleteForeignMessages_chan,
  });
}

export interface SaveMemberRoleActionContext {
  roleModalMember: GroupMember | null;
  savingRole: boolean;
  roleEditorKind: "group" | "channel";
  roleNameDraft: string;
  t: (source: string, values?: TranslationValues | undefined) => string;
  permChangeAvatar: boolean;
  permChangeName: boolean;
  permChangeReactions: boolean;
  permPinMessages: boolean;
  permStartVideoChat: boolean;
  permPostMessages: boolean;
  permEditForeignMessages: boolean;
  permDeleteForeignMessages: boolean;
  permDeleteForeign: boolean;
  permAddMembers: boolean;
  permGenerateInviteLink: boolean;
  permManageAdmins: boolean;
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  setSavingRole: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorText: (message: string | null) => void;
  channelModalData: ChannelModalData | null;
  groupModalData: GroupModalData | null;
  setRoleModalMember: React.Dispatch<React.SetStateAction<GroupMember | null>>;
}

export async function saveMemberRoleAction({ roleModalMember, savingRole, roleEditorKind, roleNameDraft, t, permChangeAvatar, permChangeName, permChangeReactions, permPinMessages, permStartVideoChat, permPostMessages, permEditForeignMessages, permDeleteForeignMessages, permDeleteForeign, permAddMembers, permGenerateInviteLink, permManageAdmins, setChannelModalData, channelModalCacheRef, setGroupModalData, groupModalCacheRef, setSavingRole, setErrorText, channelModalData, groupModalData, setRoleModalMember }: SaveMemberRoleActionContext): Promise<void> {
  if (!roleModalMember || savingRole) return;
  const isChannel = roleEditorKind === "channel";
  const targetMemberId = roleModalMember.id;
  const roleLabel = roleNameDraft.trim() || t("админ");
  const updatedRoleFields = {
    role: "admin",
    roleLabel,
    canChangeAvatar: permChangeAvatar,
    canChangeName: permChangeName,
    canChangeReactions: permChangeReactions,
    canPinMessages: permPinMessages,
    ...(roleEditorKind === "group" ? { canStartVideoChat: permStartVideoChat } : {}),
    canPostMessages: permPostMessages,
    canEditForeignMessages: permEditForeignMessages,
    canDeleteForeignMessages: isChannel ? permDeleteForeignMessages : permDeleteForeign,
    canAddMembers: permAddMembers,
    canGenerateInviteLink: permGenerateInviteLink,
    canManageAdmins: permManageAdmins,
  };

  const applySavedRole = () => {
    if (isChannel) {
      setChannelModalData((prev) => {
        if (!prev) return prev;
        const currentSubs = prev.subscribers ?? prev.members ?? [];
        const nextSubs = currentSubs.map((s: any) =>
          s.id === targetMemberId ? { ...s, ...updatedRoleFields } : s,
        );
        const next = { ...prev, subscribers: nextSubs, members: nextSubs };
        if (prev.channel?.link) {
          channelModalCacheRef.current.set(prev.channel.link, { savedAt: Date.now(), data: next });
        }
        return next;
      });
    } else {
      setGroupModalData((prev) => {
        if (!prev) return prev;
        const nextMembers = (prev.members ?? []).map((m: any) =>
          m.id === targetMemberId ? { ...m, ...updatedRoleFields } : m,
        );
        const next = { ...prev, members: nextMembers };
        if (prev.group?.link) {
          groupModalCacheRef.current.set(prev.group.link, { savedAt: Date.now(), data: next });
        }
        return next;
      });
    }
  };
  setSavingRole(true);
  setErrorText(null);
  try {
    if (isChannel) {
      if (!channelModalData?.channel?.link) return;
      await apiRequest(`/api/channels/${encodeURIComponent(channelModalData.channel.link)}/subscribers`, {
        method: "PATCH",
        body: JSON.stringify({
          memberId: targetMemberId,
          roleLabel,
          canChangeAvatar: permChangeAvatar,
          canChangeName: permChangeName,
          canChangeReactions: permChangeReactions,
          canPinMessages: permPinMessages,
          canPostMessages: permPostMessages,
          canEditForeignMessages: permEditForeignMessages,
          canDeleteForeignMessages: permDeleteForeignMessages,
          canAddMembers: permAddMembers,
          canGenerateInviteLink: permGenerateInviteLink,
          canManageAdmins: permManageAdmins,
        }),
      });
    } else {
      if (!groupModalData?.group?.link) return;
      await apiRequest(`/api/groups/${encodeURIComponent(groupModalData.group.link)}/members`, {
        method: "PATCH",
        body: JSON.stringify({
          memberId: targetMemberId,
          roleLabel,
          canChangeAvatar: permChangeAvatar,
          canChangeName: permChangeName,
          canChangeReactions: permChangeReactions,
          canPinMessages: permPinMessages,
          canStartVideoChat: permStartVideoChat,
          canDeleteForeignMessages: permDeleteForeign,
          canAddMembers: permAddMembers,
          canPostMessages: permPostMessages,
          canGenerateInviteLink: permGenerateInviteLink,
          canManageAdmins: permManageAdmins,
        }),
      });
    }
    applySavedRole();
    setRoleModalMember(null);
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Ошибка сохранения роли"));
    showAppToast({ type: "error", title: error instanceof Error ? error.message : t("Ошибка сохранения роли") });
  } finally {
    setSavingRole(false);
  }
}

export interface LeaveGroupActionContext {
  groupModalData: GroupModalData | null;
  selfId: string | null;
  leavingGroup: boolean;
  setLeavingGroup: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorText: (message: string | null) => void;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setGroupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAddMembersModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLink: string | null;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function leaveGroupAction({ groupModalData, selfId, leavingGroup, setLeavingGroup, setErrorText, setChats, setGroupModalOpen, setAddMembersModalOpen, selectedLink, setSelectedLink, setActiveConversation, setMessages, t }: LeaveGroupActionContext): Promise<void> {
  if (!groupModalData?.group?.link || !selfId || leavingGroup) return;
  setLeavingGroup(true);
  setErrorText(null);
  try {
    await apiRequest(`/api/groups/${encodeURIComponent(groupModalData.group.link)}/members`, {
      method: "DELETE",
      body: JSON.stringify({ memberId: selfId }),
    });

    setChats((prev) => prev.filter((chat) => !(chat.chatType === "group" && chat.link === groupModalData.group.link)));
    setGroupModalOpen(false);
    setAddMembersModalOpen(false);

    if (selectedLink === groupModalData.group.link) {
      setSelectedLink(null);
      setActiveConversation(null);
      setMessages([]);
    }
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  } finally {
    setLeavingGroup(false);
  }
}

export interface DeleteGroupActionContext {
  groupModalData: GroupModalData | null;
  deletingGroup: boolean;
  setDeletingGroup: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorText: (message: string | null) => void;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setGroupModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAddMembersModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLink: string | null;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function deleteGroupAction({ groupModalData, deletingGroup, setDeletingGroup, setErrorText, setChats, setGroupModalOpen, setAddMembersModalOpen, selectedLink, setSelectedLink, setActiveConversation, setMessages, t }: DeleteGroupActionContext): Promise<void> {
  if (!groupModalData?.group?.link || deletingGroup) return;
  setDeletingGroup(true);
  setErrorText(null);
  try {
    await apiRequest(`/api/groups/${encodeURIComponent(groupModalData.group.link)}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });

    setChats((prev) => prev.filter((chat) => !(chat.chatType === "group" && chat.link === groupModalData.group.link)));
    setGroupModalOpen(false);
    setAddMembersModalOpen(false);

    if (selectedLink === groupModalData.group.link) {
      setSelectedLink(null);
      setActiveConversation(null);
      setMessages([]);
    }
  } catch (error) {
    setErrorText(error instanceof Error ? error.message : t("Ошибка инициализации профиля"));
  } finally {
    setDeletingGroup(false);
  }
}

export interface OpenActiveDetailsActionContext {
  activeChat: ChatSummary | null;
  setProfileOpenedExternally: React.Dispatch<React.SetStateAction<boolean>>;
  isEclipseConversation: boolean;
  isSavedConversation: boolean;
  isDesktop: boolean;
  desktopDetailsPanelOpen: boolean;
  profileData: ProfilePreview | null;
  setDesktopDetailsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInspectedDetailsEntity: React.Dispatch<React.SetStateAction<{ type: "direct" | "group" | "channel"; link: string; } | null>>;
  openProfileModal: (link: string, external?: boolean) => Promise<void>;
  activeConversation: ConversationResponse | null;
  canUseDesktopDetailsPanel: boolean;
  openChannelModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
  openGroupModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
}

export function openActiveDetailsAction({ activeChat, setProfileOpenedExternally, isEclipseConversation, isSavedConversation, isDesktop, desktopDetailsPanelOpen, profileData, setDesktopDetailsPanelOpen, setInspectedDetailsEntity, openProfileModal, activeConversation, canUseDesktopDetailsPanel, openChannelModal, openGroupModal }: OpenActiveDetailsActionContext): void {
  if (!activeChat) return;
  setProfileOpenedExternally(false);
  if (isEclipseConversation || isSavedConversation) {
    if (isDesktop && desktopDetailsPanelOpen && profileData?.link === activeChat.link) {
      setDesktopDetailsPanelOpen(false);
      setInspectedDetailsEntity(null);
    } else {
      void openProfileModal(isSavedConversation ? "saved" : ECLIPSE_DIALOG_LINK, false);
    }
    return;
  }
  if (
    activeChat.link.startsWith("secret-") ||
    activeChat.conversationId?.startsWith("secret:") ||
    activeConversation?.conversationId?.startsWith("secret:")
  ) {
    const peerLink = activeConversation?.peer?.link || (activeChat as any)?.peer?.link || "";
    if (peerLink) {
      void openProfileModal(peerLink, false);
    }
    return;
  }
  if (isDesktop && canUseDesktopDetailsPanel) {
    if (desktopDetailsPanelOpen) {
      setDesktopDetailsPanelOpen(false);
      setInspectedDetailsEntity(null);
      return;
    }
  }
  if (activeConversation?.chatType === "channel" || activeChat.chatType === "channel") {
    void openChannelModal(activeChat.link);
    return;
  }
  if (activeConversation?.chatType === "group" || activeChat.chatType === "group") {
    void openGroupModal(activeChat.link);
    return;
  }
  void openProfileModal(activeChat.link, false);
}

export interface OpenChatListDangerActionActionContext {
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  setChannelDangerAction: React.Dispatch<React.SetStateAction<"leave" | "delete" | null>>;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  setGroupDangerAction: React.Dispatch<React.SetStateAction<"leave" | "delete" | null>>;
}

export async function openChatListDangerActionAction({ setChannelModalData, setChannelDangerAction, setGroupModalData, setGroupDangerAction }: OpenChatListDangerActionActionContext, chat: { link: string; chatType: ConversationChatType }): Promise<void> {
  if (chat.chatType === "channel") {
    const data = await apiRequest<ChannelModalData>(`/api/channels/${encodeURIComponent(chat.link)}`, {
      method: "GET",
      cache: "no-store",
    });
    setChannelModalData(data);
    setChannelDangerAction(data.channel.isOwner ? "delete" : "leave");
    return;
  }
  if (chat.chatType === "group") {
    const data = await apiRequest<{
      group: {
        id: string;
        link: string;
        name: string;
        avatarUrl?: string | null;
        ownerId?: string;
        isPublic?: boolean;
        myRole?: string;
        myCanAddMembers?: boolean;
      };
      members: GroupMember[];
    }>(`/api/groups/${encodeURIComponent(chat.link)}/members`, { method: "GET", cache: "no-store" });
    setGroupModalData({ group: data.group, members: data.members });
    setGroupDangerAction(data.group.myRole === "owner" ? "delete" : "leave");
  }
}

export interface ResolveChatListDangerActionActionContext {
  setChatListHelper: React.Dispatch<React.SetStateAction<{ link: string; chatType: ConversationChatType; dangerAction: "leave" | "delete" | null; displayName: string; x: number; y: number; touch: boolean; anchorRect?: { left: number; top: number; width: number; height: number; } | null | undefined; } | null>>;
}

export async function resolveChatListDangerActionAction({ setChatListHelper }: ResolveChatListDangerActionActionContext, chat: { link: string; chatType: ConversationChatType }): Promise<void> {
  if (chat.chatType === "channel") {
    try {
      const data = await apiRequest<ChannelModalData>(`/api/channels/${encodeURIComponent(chat.link)}`, {
        method: "GET",
        cache: "no-store",
      });
      setChatListHelper((prev) =>
        prev && prev.link === chat.link
          ? { ...prev, dangerAction: data.channel.isOwner ? "delete" : "leave" }
          : prev,
      );
    } catch {
      // ignore helper prefetch failures
    }
    return;
  }
  if (chat.chatType === "group") {
    try {
      const data = await apiRequest<{
        group: {
          myRole?: string;
        };
      }>(`/api/groups/${encodeURIComponent(chat.link)}/members`, { method: "GET", cache: "no-store" });
      setChatListHelper((prev) =>
        prev && prev.link === chat.link
          ? { ...prev, dangerAction: data.group.myRole === "owner" ? "delete" : "leave" }
          : prev,
      );
    } catch {
      // ignore helper prefetch failures
    }
  }
}

export interface LoadDesktopDetailsContext {
  isDesktop: boolean;
  desktopDetailsPanelOpen: boolean;
  activeDetailsLink: string | null;
  inspectedDetailsEntity: { type: "direct" | "group" | "channel"; link: string; } | null;
  activeDetailsChatType: ConversationChatType | null;
  setProfileActiveTab: React.Dispatch<React.SetStateAction<"voice" | "music" | "members" | "media" | "files" | "links">>;
  setGroupModalError: React.Dispatch<React.SetStateAction<string | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  activeGroupModalSeed: GroupModalData | null;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  setGroupNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setGroupAvatarDraft: React.Dispatch<React.SetStateAction<string | null>>;
  setGroupModalLoading: React.Dispatch<React.SetStateAction<boolean>>;
  groupDetailsInFlightRef: React.RefObject<Set<string>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setChannelModalError: React.Dispatch<React.SetStateAction<string | null>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  activeChannelModalSeed: ChannelModalData | null;
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  setChannelNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setChannelAvatarDraft: React.Dispatch<React.SetStateAction<string | null>>;
  setChannelModalLoading: React.Dispatch<React.SetStateAction<boolean>>;
  channelDetailsInFlightRef: React.RefObject<Set<string>>;
  selfId: string | null;
  setProfileData: React.Dispatch<React.SetStateAction<ProfilePreview | null>>;
  setContactEditorTarget: React.Dispatch<React.SetStateAction<{ link: string; displayName: string; avatarUrl?: string | null | undefined; } | null>>;
  setContactExists: React.Dispatch<React.SetStateAction<boolean>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setContactFirstName: React.Dispatch<React.SetStateAction<string>>;
  setContactLastName: React.Dispatch<React.SetStateAction<string>>;
  setContactEditorInitial: React.Dispatch<React.SetStateAction<{ firstName: string; lastName: string; } | null>>;
  setProfileLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileError: React.Dispatch<React.SetStateAction<string | null>>;
  setContactMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
}

export function loadDesktopDetails({ isDesktop, desktopDetailsPanelOpen, activeDetailsLink, inspectedDetailsEntity, activeDetailsChatType, setProfileActiveTab, setGroupModalError, groupModalCacheRef, activeGroupModalSeed, setGroupModalData, setGroupNameDraft, setGroupAvatarDraft, setGroupModalLoading, groupDetailsInFlightRef, t, setChannelModalError, channelModalCacheRef, activeChannelModalSeed, setChannelModalData, setChannelNameDraft, setChannelAvatarDraft, setChannelModalLoading, channelDetailsInFlightRef, selfId, setProfileData, setContactEditorTarget, setContactExists, setChats, setContactFirstName, setContactLastName, setContactEditorInitial, setProfileLoading, setProfileError, setContactMessage, setActiveConversation }: LoadDesktopDetailsContext): (() => void) | undefined {
  if (!isDesktop || !desktopDetailsPanelOpen || !activeDetailsLink) return;
  if (
    inspectedDetailsEntity &&
    (inspectedDetailsEntity.link.toLowerCase() !== activeDetailsLink.toLowerCase() ||
      inspectedDetailsEntity.type !== activeDetailsChatType)
  ) {
    return;
  }
  let cancelled = false;

  async function loadDesktopDetails() {
    if (!activeDetailsLink) return;
    if (!activeDetailsChatType) return;
    if (activeDetailsChatType === "saved" || activeDetailsChatType === "eclipse") {
      const saved = activeDetailsChatType === "saved";
      setProfileData({ id: saved ? "saved" : "eclipse-system", link: saved ? "saved" : "eclipse", displayName: saved ? t("Избранное") : "Eclipse", isBot: !saved, avatarUrl: null, usernameHidden: saved, description: null, createdAt: "" });
      setProfileLoading(false);
      setProfileError(null);
      setContactEditorTarget(null);
      setContactExists(false);
      setContactMessage(null);
      return;
    }

    if (activeDetailsChatType === "group") {
      setProfileActiveTab("members");
      const link = activeDetailsLink;
      setGroupModalError(null);
      const cached = groupModalCacheRef.current.get(link);
      const seeded = activeGroupModalSeed?.group.link === link ? activeGroupModalSeed : null;
      const immediate = cached?.data ?? seeded;
      const isFresh = cached ? (Date.now() - cached.savedAt <= GROUP_MODAL_CACHE_TTL_MS && (cached.data.members?.length ?? 0) > 0) : false;
      if (immediate) {
        setGroupModalData(immediate);
        setGroupNameDraft(immediate.group.name ?? "");
        setGroupAvatarDraft(immediate.group.avatarUrl ?? null);
      } else {
        setGroupModalData(null);
        setGroupNameDraft("");
        setGroupAvatarDraft(null);
      }
      setGroupModalLoading(!immediate || !isFresh);
      if (cached && isFresh) return;
      if (groupDetailsInFlightRef.current.has(link) && immediate) return;
      groupDetailsInFlightRef.current.add(link);
      try {
        const data = await apiRequest<GroupModalData>(`/api/groups/${encodeURIComponent(link)}/members`, {
          method: "GET",
          cache: "no-store",
        });
        if (cancelled) return;
        groupModalCacheRef.current.set(link, { savedAt: Date.now(), data });
        setGroupModalData(data);
        setGroupNameDraft(data.group.name ?? "");
        setGroupAvatarDraft(data.group.avatarUrl ?? null);
      } catch (error) {
        if (!cancelled && !immediate) {
          setGroupModalData(null);
          setGroupModalError(error instanceof Error ? error.message : t("Не удалось загрузить группу"));
        }
      } finally {
        groupDetailsInFlightRef.current.delete(link);
        if (!cancelled) setGroupModalLoading(false);
      }
      return;
    }

    if (activeDetailsChatType === "channel") {
      setProfileActiveTab((prev) => (prev === "members" ? "media" : prev));
      const link = activeDetailsLink;
      setChannelModalError(null);
      const cached = channelModalCacheRef.current.get(link);
      const seeded = activeChannelModalSeed?.channel.link === link ? activeChannelModalSeed : null;
      const immediate = cached?.data ?? seeded;
      const isFresh = cached ? (Date.now() - cached.savedAt <= CHANNEL_MODAL_CACHE_TTL_MS && ((cached.data.subscribers?.length ?? cached.data.members?.length ?? 0) > 0)) : false;
      if (immediate) {
        setChannelModalData(immediate);
        setChannelNameDraft(immediate.channel.name);
        setChannelAvatarDraft(immediate.channel.avatarUrl ?? null);
      } else {
        setChannelModalData(null);
        setChannelNameDraft("");
        setChannelAvatarDraft(null);
      }
      setChannelModalLoading(!immediate || !isFresh);
      if (cached && isFresh) return;
      if (channelDetailsInFlightRef.current.has(link) && immediate) return;
      channelDetailsInFlightRef.current.add(link);
      try {
        const data = await apiRequest<ChannelModalData>(`/api/channels/${encodeURIComponent(link)}`, {
          method: "GET",
          cache: "no-store",
        });
        if (cancelled) return;
        channelModalCacheRef.current.set(link, { savedAt: Date.now(), data });
        setChannelModalData(data);
        setChannelNameDraft(data.channel.name);
        setChannelAvatarDraft(data.channel.avatarUrl ?? null);
      } catch (error) {
        if (!cancelled && !immediate) {
          setChannelModalData(null);
          setChannelModalError(error instanceof Error ? error.message : t("Не удалось загрузить канал"));
        }
      } finally {
        channelDetailsInFlightRef.current.delete(link);
        if (!cancelled) setChannelModalLoading(false);
      }
      return;
    }

    const link = activeDetailsLink;
    setProfileActiveTab((prev) => (prev === "members" ? "media" : prev));
    const cachedProfile = selfId
      ? readProfileDetailsMemoryCache(selfId, link) ?? loadProfilePersistentCache(selfId, link)
      : null;
    const isFreshProfile =
      Boolean(cachedProfile) &&
      cachedProfile?.profile?.secondaryLinks !== undefined &&
      Date.now() - (cachedProfile?.savedAt ?? 0) <= 15_000;
    if (cachedProfile) {
      setProfileData(cachedProfile.profile);
      setContactEditorTarget({
        link: cachedProfile.profile.link,
        displayName: cachedProfile.profile.displayName,
        avatarUrl: cachedProfile.profile.avatarUrl ?? null,
      });
      setContactExists(cachedProfile.contact.exists);
      setChats((prev) =>
        prev.map((c) =>
          c.link === cachedProfile.profile.link || (cachedProfile.profile.id && c.peerId === cachedProfile.profile.id)
            ? {
              ...c,
              displayName: cachedProfile.contact.contact?.alias?.trim() || contactDisplayName(c, cachedProfile.profile.displayName),
              avatarUrl: cachedProfile.profile.avatarUrl !== undefined ? cachedProfile.profile.avatarUrl : c.avatarUrl,
            }
            : c
        )
      );
      const draftParts = splitContactAliasParts(cachedProfile.contact.contact?.alias ?? cachedProfile.profile.displayName);
      setContactFirstName(draftParts.firstName);
      setContactLastName(draftParts.lastName);
      setContactEditorInitial({
        firstName: draftParts.firstName.trim(),
        lastName: draftParts.lastName.trim(),
      });
      writeProfileDetailsMemoryCache(selfId, link, cachedProfile);
    } else {
      setProfileData(null);
    }
    setProfileLoading(!cachedProfile);
    setProfileError(null);
    setContactMessage(null);
    if (isFreshProfile) return;
    try {
      const [profile, contact] = await Promise.all([
        apiRequest<ProfilePreview>(`/api/profile/${encodeURIComponent(link)}`, { method: "GET" }),
        apiRequest<ContactResponse>(`/api/contacts/${encodeURIComponent(link)}`, { method: "GET" }),
      ]);
      if (cancelled) return;
      const snapshot = { savedAt: Date.now(), profile, contact };
      writeProfileDetailsMemoryCache(selfId, link, snapshot);
      if (selfId) saveProfilePersistentCache(selfId, link, snapshot);
      setProfileData(profile);
      setContactEditorTarget({ link: profile.link, displayName: profile.displayName, avatarUrl: profile.avatarUrl ?? null });
      setContactExists(contact.exists);
      broadcastProfileUpdated({
        id: profile.id,
        link: profile.link,
        secondaryLinks: profile.secondaryLinks,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl ?? null,
        description: profile.description ?? null,
      });
      setChats((prev) =>
        prev.map((c) =>
          c.link === profile.link || (profile.id && c.peerId === profile.id)
            ? {
              ...c,
              displayName: contact.contact?.alias?.trim() || profile.displayName || c.displayName,
              contactAlias: contact.exists ? contact.contact?.alias ?? null : null,
              avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : c.avatarUrl,
            }
            : c
        )
      );
      setActiveConversation((prev) => {
        if (!prev || !prev.peer) return prev;
        if (prev.peer.link === profile.link || (profile.id && prev.peer.id === profile.id)) {
          return {
            ...prev,
            peer: {
              ...prev.peer,
              displayName: profile.displayName || prev.peer.displayName,
              avatarUrl: profile.avatarUrl !== undefined ? profile.avatarUrl : prev.peer.avatarUrl,
              link: profile.link,
              secondaryLinks: profile.secondaryLinks ?? prev.peer.secondaryLinks,
            },
          };
        }
        return prev;
      });
      const draftParts = splitContactAliasParts(contact.contact?.alias ?? profile.displayName);
      setContactFirstName(draftParts.firstName);
      setContactLastName(draftParts.lastName);
      setContactEditorInitial({
        firstName: draftParts.firstName.trim(),
        lastName: draftParts.lastName.trim(),
      });
    } catch (error) {
      if (!cancelled) {
        setProfileData(null);
        setProfileError(error instanceof Error ? error.message : t("Не удалось загрузить профиль"));
      }
    } finally {
      if (!cancelled) setProfileLoading(false);
    }
  }

  void loadDesktopDetails();
  return () => {
    cancelled = true;
  };
}

export interface SaveCommunityTypeActionContext {
  groupModalData: GroupModalData | null;
  channelModalData: ChannelModalData | null;
  selfId: string | null;
  groupSaving: boolean;
  channelSaving: boolean;
  groupIsPublicDraft: boolean;
  channelIsPublicDraft: boolean;
  groupLinkDraft: string;
  channelLinkDraft: string;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setGroupSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setChannelSaving: React.Dispatch<React.SetStateAction<boolean>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  setGroupModalData: React.Dispatch<React.SetStateAction<GroupModalData | null>>;
  setGroupSubView: React.Dispatch<React.SetStateAction<"type" | "members" | "settings" | "qrcode" | "reactions" | "admins" | "add_members" | null>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  setChannelModalData: React.Dispatch<React.SetStateAction<ChannelModalData | null>>;
  setChannelSubView: React.Dispatch<React.SetStateAction<"type" | "subscribers" | "settings" | "qrcode" | "reactions" | "admins" | "add_subscribers" | null>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setInspectedDetailsEntity: React.Dispatch<React.SetStateAction<{ type: "direct" | "group" | "channel"; link: string; } | null>>;
  selectedLink: string | null;
  chatScrollRef: React.RefObject<{ key: string; link: string; initial: boolean; lastMessageId?: string | undefined; requestedBefore?: string | undefined; } | null>;
  chatReadingPositionsRef: React.RefObject<Map<string, { messageId: string; offset: number; top: number; createdAt: string; }>>;
  currentUserIdRef: React.RefObject<string | null>;
  selectedLinkRef: React.RefObject<string | null>;
  lastHandledSelectedLinkRef: React.RefObject<string | null>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  router: AppRouterInstance;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
}

export async function saveCommunityTypeAction({ groupModalData, channelModalData, selfId, groupSaving, channelSaving, groupIsPublicDraft, channelIsPublicDraft, groupLinkDraft, channelLinkDraft, t, setGroupSaving, setChannelSaving, groupModalCacheRef, setGroupModalData, setGroupSubView, channelModalCacheRef, setChannelModalData, setChannelSubView, setChats, setInspectedDetailsEntity, selectedLink, chatScrollRef, chatReadingPositionsRef, currentUserIdRef, selectedLinkRef, lastHandledSelectedLinkRef, setSelectedLink, router, setActiveConversation }: SaveCommunityTypeActionContext, kind: "group" | "channel"): Promise<void> {
  const group = kind === "group", entity = group ? groupModalData?.group : channelModalData?.channel;
  if (!entity || entity.ownerId !== selfId || groupSaving || channelSaving) return;
  const isPublic = group ? groupIsPublicDraft : channelIsPublicDraft;
  const link = (group ? groupLinkDraft : channelLinkDraft).trim().replace(/^@+/, "").toLowerCase();
  if (isPublic && !/^[a-z][a-z0-9_]{2,30}[a-z0-9]$/.test(link)) { toast.error(t("Укажите корректное уникальное имя: 4–32 символа")); return; }
  const setSaving = group ? setGroupSaving : setChannelSaving;
  setSaving(true);
  try {
    const result = await apiRequest<{ group?: { link: string; isPublic: boolean }; channel?: { link: string; isPublic: boolean } }>("/api/" + kind + "s/" + encodeURIComponent(entity.link), {
      method: "PATCH", body: JSON.stringify({ isPublic, ...(isPublic ? { link } : {}) }),
    });
    const updatedEntity = group ? result.group! : result.channel!;
    if (group && groupModalData) {
      const updated = { ...groupModalData, group: { ...groupModalData.group, ...updatedEntity } };
      groupModalCacheRef.current.delete(entity.link); groupModalCacheRef.current.set(updatedEntity.link, { savedAt: Date.now(), data: updated });
      setGroupModalData(updated); setGroupSubView("settings");
    } else if (channelModalData) {
      const updated = { ...channelModalData, channel: { ...channelModalData.channel, ...updatedEntity } };
      channelModalCacheRef.current.delete(entity.link); channelModalCacheRef.current.set(updatedEntity.link, { savedAt: Date.now(), data: updated });
      setChannelModalData(updated); setChannelSubView("settings");
    }
    if (updatedEntity.link !== entity.link) {
      setChats(prev => prev.map(chat => chat.chatType === kind && chat.link === entity.link ? { ...chat, link: updatedEntity.link } : chat));
      setInspectedDetailsEntity(prev => prev?.type === kind && prev.link === entity.link ? { ...prev, link: updatedEntity.link } : prev);
      if (selectedLink === entity.link) {
        // Renaming the same community is not navigation to another chat.
        const scroll = chatScrollRef.current;
        if (scroll) {
          const position = chatReadingPositionsRef.current.get(scroll.key);
          chatReadingPositionsRef.current.delete(scroll.key);
          scroll.key = `${selfId ?? currentUserIdRef.current ?? ""}:${kind}:${updatedEntity.link}`;
          scroll.link = updatedEntity.link;
          if (position) chatReadingPositionsRef.current.set(scroll.key, position);
        }
        selectedLinkRef.current = updatedEntity.link;
        lastHandledSelectedLinkRef.current = updatedEntity.link;
        setSelectedLink(updatedEntity.link);
        router.replace("/app?chat=" + encodeURIComponent(updatedEntity.link) + "&chatType=" + kind, { scroll: false });
      }
    }
    setActiveConversation(prev => {
      if (prev?.chatType === "group" && kind === "group" && prev.group?.id === entity.id) return { ...prev, group: { ...prev.group, ...updatedEntity } };
      if (prev?.chatType === "channel" && kind === "channel" && prev.channel?.id === entity.id) return { ...prev, channel: { ...prev.channel, ...updatedEntity } };
      return prev;
    });
    toast.success(t("Изменения сохранены"));
  } catch (error) { toast.error(error instanceof Error ? error.message : t("Не удалось сохранить тип")); }
  finally { setSaving(false); }
}
