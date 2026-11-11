"use client";

import { type TranslationValues, plural, translate as t } from "@/lib/i18n/translate";
import { type ConversationResponse, type ChatSummary, type SelfProfile, type DecryptedMessage, type GroupMember, type ProfileBatchItem, type ChatImageGalleryItem } from "../types";
import { getPresenceStatusText } from "@/lib/client/presence-status";
import { resolveMessageMedia } from "@/lib/client/media-crypto";
import { formatSearchCount } from "./virtualization";
import { parseMessageContentCached } from "./message-content";
import { formatMessageTimeLabel } from "./message-presentation";
import { formatMediaViewerDate } from "./media-recording";

export interface ActiveStatusTextActionContext {
  isSavedConversation: boolean;
  t: (source: string, values?: TranslationValues | undefined) => string;
  isEclipseConversation: boolean;
  isSecretChat: boolean;
  isSecretChatApproved: boolean;
  isSecretChatCreator: boolean;
  activeTitle: string;
  activeIsSending: boolean;
  activeSendingStatusText: string;
  activeIsRecording: boolean;
  activeRecordingStatusText: string;
  activeIsTyping: boolean;
  activePeerId: string | null;
  onlineUserIds: Set<string>;
  lastOfflineAtByUserId: Record<string, number>;
  presenceNowTs: number;
  activePeerCanDisplayPresence: boolean;
  activePeerCanDisplayLastSeen: boolean;
  isGroupConversation: boolean;
  activeTypingMembers: string[];
  activeGroupTypingText: string;
  activeConversation: ConversationResponse | null;
  activeChat: ChatSummary | null;
  activeGroupOnlineCount: number;
  isChannelConversation: boolean;
}

export function activeStatusTextAction({ isSavedConversation, t, isEclipseConversation, isSecretChat, isSecretChatApproved, isSecretChatCreator, activeTitle, activeIsSending, activeSendingStatusText, activeIsRecording, activeRecordingStatusText, activeIsTyping, activePeerId, onlineUserIds, lastOfflineAtByUserId, presenceNowTs, activePeerCanDisplayPresence, activePeerCanDisplayLastSeen, isGroupConversation, activeTypingMembers, activeGroupTypingText, activeConversation, activeChat, activeGroupOnlineCount, isChannelConversation }: ActiveStatusTextActionContext): string {

  if (isSavedConversation) {
    return t("ваше облачное хранилище");
  }
  if (isEclipseConversation) {
    return t("бот");
  }
  if (isSecretChat) {
    if (!isSecretChatApproved) {
      return isSecretChatCreator
        ? t("ожидание ответа от {0}", { 0: activeTitle })
        : t("приглашение в секретный чат");
    }
    if (activeIsSending) return activeSendingStatusText;
    if (activeIsRecording) return activeRecordingStatusText;
    if (activeIsTyping) return t("печатает");
    return t(getPresenceStatusText(
      activePeerId,
      onlineUserIds,
      lastOfflineAtByUserId,
      presenceNowTs,
      activePeerCanDisplayPresence,
      activePeerCanDisplayLastSeen,
    ));
  }
  if (isGroupConversation) {
    if (activeIsSending) return activeSendingStatusText;
    if (activeIsRecording) return activeRecordingStatusText;
    if (activeTypingMembers.length > 0) return activeGroupTypingText;
    const count = activeConversation?.members?.length ?? Number(activeChat?.membersCount || 0);
    if (count > 0) {
      return `${plural(count, ["участник", "участника", "участников"], "member")}${activeGroupOnlineCount > 0 ? t(", {0} в сети", { 0: activeGroupOnlineCount }) : ""}`;
    }
    return t("группа");
  }
  if (isChannelConversation) {
    if (activeIsSending) return activeSendingStatusText || t("публикация");
    if (activeIsRecording) return activeRecordingStatusText || t("идет запись");
    const subs = activeConversation?.channel?.subscribersCount ?? activeChat?.subscribersCount;
    if (subs !== undefined && subs !== null && subs !== "") {
      return formatSearchCount(String(subs), t("подписчик"), t("подписчика"), t("подписчиков"));
    }
    return t("канал");
  }
  // Direct chat
  if (activeChat?.isBot || (activeConversation?.peer?.isBot && activeConversation.peer.link === activeChat?.link)) return t("бот");
  if (activeIsSending) return activeSendingStatusText;
  if (activeIsRecording) return activeRecordingStatusText;
  if (activeIsTyping) return t("печатает");
  return t(getPresenceStatusText(
    activePeerId,
    onlineUserIds,
    lastOfflineAtByUserId,
    presenceNowTs,
    activePeerCanDisplayPresence,
    activePeerCanDisplayLastSeen,
  ));
}

export interface ChatSharedMediaListActionContext {
  profileMediaVisible: boolean;
  profileActiveTab: "voice" | "music" | "members" | "media" | "files" | "links";
  selfId: string | null;
  selfProfile: SelfProfile | null;
  messages: DecryptedMessage[];
  activeConversation: ConversationResponse | null;
  groupMembersById: Map<string, GroupMember>;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  activeChat: ChatSummary | null;
  selectedLink: string | null;
  activeTitle: string;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export function chatSharedMediaListAction({ profileMediaVisible, profileActiveTab, selfId, selfProfile, messages, activeConversation, groupMembersById, readProfileFromCache, contactsForAdd, activeChat, selectedLink, activeTitle, t }: ChatSharedMediaListActionContext): { id: string; messageId: string; kind: "image" | "video"; src: string; caption?: string | undefined; preview?: string; durationMs?: number | undefined; mode?: "note" | "file" | undefined; timeText: string; dateText: string; authorName: string; authorAvatarUrl: string | null; authorLink: string | null; canDelete: boolean; isMine: boolean; }[] {
  if (!profileMediaVisible || profileActiveTab !== "media") return [];
  const list: Array<{
    id: string;
    messageId: string;
    kind: "image" | "video";
    src: string;
    caption?: string; preview?: string;
    durationMs?: number;
    mode?: "note" | "file";
    timeText: string;
    dateText: string;
    authorName: string;
    authorAvatarUrl: string | null;
    authorLink: string | null;
    canDelete: boolean;
    isMine: boolean;
  }> = [];

  const effectiveSelfId = selfId ?? selfProfile?.id ?? null;
  for (const message of messages) {
    const raw = parseMessageContentCached(message.text, false);
    if (!["image", "video", "album"].includes(raw.kind)) continue;
    const parsed = raw;
    const isMine = activeConversation?.chatType === "saved" || (effectiveSelfId ? message.senderId === effectiveSelfId : false);
    const isChannelMedia = activeConversation?.chatType === "channel";
    const senderMeta = activeConversation?.chatType === "group" ? groupMembersById.get(message.senderId) ?? null : null;
    const senderProfile = readProfileFromCache(message.senderId);
    const contactMatch = !isMine ? contactsForAdd.find((c) => {
      if (message.senderId && c.id === message.senderId) return true;
      if (senderProfile?.link && c.link && c.link.toLowerCase() === senderProfile.link.toLowerCase()) return true;
      if (activeConversation?.chatType === "direct") {
        if (activeConversation.peer?.id && c.id === activeConversation.peer.id) return true;
        if (activeChat?.peerId && c.id === activeChat.peerId) return true;
        if (activeConversation.peer?.link && c.link && c.link.toLowerCase() === activeConversation.peer.link.toLowerCase()) return true;
        if (selectedLink && c.link && c.link.toLowerCase() === selectedLink.toLowerCase()) return true;
      }
      return false;
    }) : null;
    const contactName = contactMatch?.alias?.trim();
    const authorName = isChannelMedia
      ? activeTitle || activeChat?.displayName || t("Канал")
      : isMine
        ? t("Вы")
        : contactName
          ? contactName
          : activeConversation?.chatType === "direct"
            ? activeConversation.peer?.displayName || senderProfile?.displayName || activeTitle || activeChat?.displayName || t("Пользователь")
            : senderProfile?.displayName || message.senderDisplayName || senderMeta?.displayName || t("Пользователь");
    const authorAvatarUrl = isChannelMedia
      ? activeChat?.avatarUrl ?? null
      : isMine
        ? selfProfile?.avatarUrl ?? null
        : activeConversation?.chatType === "direct"
          ? activeChat?.avatarUrl ?? null
          : senderMeta?.avatarUrl ?? senderProfile?.avatarUrl ?? activeChat?.avatarUrl ?? null;
    const authorLink = isChannelMedia
      ? null
      : isMine
        ? null
        : activeConversation?.chatType === "direct"
          ? activeConversation?.peer?.link || activeChat?.link || null
          : senderProfile?.link || senderMeta?.link || contactMatch?.link || null;
    const canDelete = isMine;
    const meta = {
      timeText: formatMessageTimeLabel(message.createdAt),
      dateText: formatMediaViewerDate(message.createdAt),
      authorName,
      authorAvatarUrl,
      authorLink,
      canDelete,
      isMine,
    };

    if (parsed.kind === "image" && parsed.src) {
      list.push({
        id: `${message.id}-img`,
        messageId: message.id,
        kind: "image",
        src: parsed.src, preview: parsed.preview,
        caption: parsed.caption || "",
        ...meta,
      });
    } else if (parsed.kind === "video" && parsed.src) {
      if (parsed.mode !== "note") {
        list.push({
          id: `${message.id}-vid`,
          messageId: message.id,
          kind: "video",
          src: parsed.src, preview: parsed.preview,
          caption: parsed.caption || "",
          durationMs: parsed.durationMs,
          mode: parsed.mode,
          ...meta,
        });
      }
    } else if (parsed.kind === "album") {
      parsed.items.forEach((item, itemIdx) => {
        if (item.src) {
          if (item.kind === "video" && (item as any).mode === "note") return;
          list.push({
            id: `${message.id}-alb-${itemIdx}`,
            messageId: message.id,
            kind: item.kind === "video" ? "video" : "image",
            src: item.src, preview: item.preview,
            caption: parsed.caption || "",
            durationMs: item.durationMs,
            ...meta,
          });
        }
      });
    }
  }
  return list;
}

export interface ChatSharedVoiceListActionContext {
  profileMediaVisible: boolean;
  profileActiveTab: "voice" | "music" | "members" | "media" | "files" | "links";
  selfId: string | null;
  selfProfile: SelfProfile | null;
  messages: DecryptedMessage[];
  activeConversation: ConversationResponse | null;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  activeChat: ChatSummary | null;
  selectedLink: string | null;
  activeTitle: string;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export function chatSharedVoiceListAction({ profileMediaVisible, profileActiveTab, selfId, selfProfile, messages, activeConversation, readProfileFromCache, contactsForAdd, activeChat, selectedLink, activeTitle, t }: ChatSharedVoiceListActionContext): { id: string; messageId: string; src: string; durationMs?: number | undefined; dateText: string; timeText: string; authorName: string; authorAvatarUrl: string | null; isMine: boolean; }[] {
  if (!profileMediaVisible || profileActiveTab !== "voice") return [];
  const list: Array<{
    id: string;
    messageId: string;
    src: string;
    durationMs?: number;
    dateText: string;
    timeText: string;
    authorName: string;
    authorAvatarUrl: string | null;
    isMine: boolean;
  }> = [];

  const effectiveSelfId = selfId ?? selfProfile?.id ?? null;
  for (const message of messages) {
    const raw = parseMessageContentCached(message.text, false);
    if (!["voice"].includes(raw.kind)) continue;
    const parsed = resolveMessageMedia(raw);
    if (parsed.kind === "voice" && raw.kind === "voice" && raw.src) {
      const isChannel = activeConversation?.chatType === "channel";
      const isMine = activeConversation?.chatType === "saved" || (effectiveSelfId ? message.senderId === effectiveSelfId : false);
      const senderProfile = readProfileFromCache(message.senderId);
      const contactMatch = !isMine ? contactsForAdd.find((c) => {
        if (message.senderId && c.id === message.senderId) return true;
        if (senderProfile?.link && c.link && c.link.toLowerCase() === senderProfile.link.toLowerCase()) return true;
        if (activeConversation?.chatType === "direct") {
          if (activeConversation.peer?.id && c.id === activeConversation.peer.id) return true;
          if (activeChat?.peerId && c.id === activeChat.peerId) return true;
          if (activeConversation.peer?.link && c.link && c.link.toLowerCase() === activeConversation.peer.link.toLowerCase()) return true;
          if (selectedLink && c.link && c.link.toLowerCase() === selectedLink.toLowerCase()) return true;
        }
        return false;
      }) : null;
      const contactName = contactMatch?.alias?.trim();
      const authorName = isChannel
        ? (activeTitle || activeChat?.displayName || t("Канал"))
        : isMine
          ? t("Вы")
          : contactName || activeConversation?.peer?.displayName || senderProfile?.displayName || activeTitle || activeChat?.displayName || t("Пользователь");
      const authorAvatarUrl = isChannel
        ? activeChat?.avatarUrl ?? null
        : isMine
          ? selfProfile?.avatarUrl ?? null
          : activeChat?.avatarUrl ?? null;
      list.push({
        id: `${message.id}-voice`,
        messageId: message.id,
        src: parsed.src,
        durationMs: parsed.durationMs,
        dateText: formatMediaViewerDate(message.createdAt),
        timeText: formatMessageTimeLabel(message.createdAt),
        authorName,
        authorAvatarUrl,
        isMine,
      });
    }
  }
  return list;
}

export interface ChatImageGalleryActionContext {
  selfId: string | null;
  selfProfile: SelfProfile | null;
  messages: DecryptedMessage[];
  activeConversation: ConversationResponse | null;
  groupMembersById: Map<string, GroupMember>;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
  activeChat: ChatSummary | null;
  selectedLink: string | null;
  activeTitle: string;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export function chatImageGalleryAction({ selfId, selfProfile, messages, activeConversation, groupMembersById, readProfileFromCache, contactsForAdd, activeChat, selectedLink, activeTitle, t }: ChatImageGalleryActionContext): ChatImageGalleryItem[] {
  const gallery: ChatImageGalleryItem[] = [];
  const effectiveSelfId = selfId ?? selfProfile?.id ?? null;
  for (const message of messages) {
    const parsed = parseMessageContentCached(message.text, false);
    if (parsed.kind !== "image" && (parsed.kind !== "album" || !parsed.items.some(item => item.kind === "image"))) continue;
    const senderMeta = activeConversation?.chatType === "group" ? groupMembersById.get(message.senderId) ?? null : null;
    const senderProfile = readProfileFromCache(message.senderId);
    const isMine = activeConversation?.chatType === "saved" || (effectiveSelfId ? message.senderId === effectiveSelfId : false);
    const isChannelMedia = activeConversation?.chatType === "channel";
    const contactMatch = !isMine ? contactsForAdd.find((c) => {
      if (message.senderId && c.id === message.senderId) return true;
      if (senderProfile?.link && c.link && c.link.toLowerCase() === senderProfile.link.toLowerCase()) return true;
      if (activeConversation?.chatType === "direct") {
        if (activeConversation.peer?.id && c.id === activeConversation.peer.id) return true;
        if (activeChat?.peerId && c.id === activeChat.peerId) return true;
        if (activeConversation.peer?.link && c.link && c.link.toLowerCase() === activeConversation.peer.link.toLowerCase()) return true;
        if (selectedLink && c.link && c.link.toLowerCase() === selectedLink.toLowerCase()) return true;
      }
      return false;
    }) : null;
    const contactName = contactMatch?.alias?.trim();
    const authorName = isChannelMedia
      ? activeTitle || activeChat?.displayName || t("Канал")
      : isMine
        ? t("Вы")
        : contactName
          ? contactName
          : activeConversation?.chatType === "direct"
            ? activeConversation?.peer?.displayName || senderProfile?.displayName || activeTitle || activeChat?.displayName || t("Пользователь")
            : senderProfile?.displayName || message.senderDisplayName || senderMeta?.displayName || t("Пользователь");
    const authorAvatarUrl = isChannelMedia
      ? activeChat?.avatarUrl ?? null
      : isMine
        ? selfProfile?.avatarUrl ?? null
        : activeConversation?.chatType === "direct"
          ? activeChat?.avatarUrl ?? null
          : senderMeta?.avatarUrl ?? senderProfile?.avatarUrl ?? activeChat?.avatarUrl ?? null;
    const authorLink = isChannelMedia
      ? null
      : isMine
        ? null
        : activeConversation?.chatType === "direct"
          ? activeConversation?.peer?.link || activeChat?.link || null
          : senderProfile?.link || senderMeta?.link || contactMatch?.link || null;
    const canDelete =
      isMine ||
      (activeConversation?.chatType === "group" &&
        (activeConversation.group?.myRole === "owner" || activeConversation.group?.myRole === "admin"));
    const galleryMeta = {
      timeText: formatMessageTimeLabel(message.createdAt),
      dateText: formatMediaViewerDate(message.createdAt),
      authorName,
      authorAvatarUrl,
      authorLink,
      canDelete,
      isMine,
    };
    if (parsed.kind === "image") {
      gallery.push({
        src: parsed.src,
        caption: parsed.caption || "",
        messageId: message.id,
        ...galleryMeta,
      });
      continue;
    }
    if (parsed.kind === "album") {
      const albumCaption = parsed.caption || "";
      parsed.items.forEach((item) => {
        if (item.kind !== "image") return;
        gallery.push({
          src: item.src,
          caption: albumCaption,
          messageId: message.id,
          ...galleryMeta,
        });
      });
    }
  }
  return gallery;
}
