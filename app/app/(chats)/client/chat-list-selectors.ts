"use client";

import { type ConversationResponse, type ChatSummary, type DecryptedMessage, type ProfileBatchItem, type GroupMember, type ChatImageGalleryItem, type GroupModalData, type ChannelModalData, type ChatSearchUser, type ChatSearchGroup, type ChatSearchChannel, type ConversationChatType, type ChatSearchSaved, type ChatSearchEclipse, type ChatListPreviewMeta, type ChatSearchResponse, type ProfilePreview, type ContactResponse } from "../types";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { type TranslationValues, localizeSystemText, translate as t } from "@/lib/i18n/translate";
import { type CallMessageData, readCallMessage, callMessageTitle } from "@/lib/call-history";
import { createChatTargetScroll } from "@/lib/client/chat-bottom-scroll";
import { apiRequest } from "@/lib/client/http";
import { ECLIPSE_LIST_STATUS } from "@/lib/eclipse-system";
import { readConversationMemoryCache, loadConversationSessionCache, scheduleIdleTask, readProfileDetailsMemoryCache, loadProfilePersistentCache, writeProfileDetailsMemoryCache, saveProfilePersistentCache, isMessageReadByMarker } from "./chat-cache";
import { PROFILE_CACHE_TTL_MS, GROUP_MODAL_CACHE_TTL_MS, CHANNEL_MODAL_CACHE_TTL_MS, MESSAGE_ITEM_ESTIMATED_HEIGHT } from "./config";
import { resolveChatListPreviewMetaCached, normalizeLastMessagePreviewCached, fallbackPreviewTextByKind, hasEncryptedPreview } from "./chat-previews";
import { formatChatListTimeLabel } from "./message-presentation";

export interface HandleVideoViewerAuthorClickActionContext {
  videoViewer: { src: string; caption: string; timeText: string; dateText: string; messageId: string; authorName: string; authorAvatarUrl?: string | null | undefined; authorLink?: string | null | undefined; canDelete: boolean; isMine?: boolean | undefined; } | null;
  activeConversation: ConversationResponse | null;
  videoViewerRef: React.RefObject<HTMLVideoElement | null>;
  setVideoViewer: React.Dispatch<React.SetStateAction<{ src: string; caption: string; timeText: string; dateText: string; messageId: string; authorName: string; authorAvatarUrl?: string | null | undefined; authorLink?: string | null | undefined; canDelete: boolean; isMine?: boolean | undefined; } | null>>;
  setVideoViewerFailed: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoViewerPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoViewerProgress: React.Dispatch<React.SetStateAction<number>>;
  setVideoViewerCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setVideoViewerMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeChat: ChatSummary | null;
  openChannelModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
  openProfileModal: (link: string, external?: boolean) => Promise<void>;
  messages: DecryptedMessage[];
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  groupMembersById: Map<string, GroupMember>;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
}

export function handleVideoViewerAuthorClickAction({ videoViewer, activeConversation, videoViewerRef, setVideoViewer, setVideoViewerFailed, setVideoViewerPlaying, setVideoViewerProgress, setVideoViewerCurrentTime, setVideoViewerMenuOpen, activeChat, openChannelModal, openProfileModal, messages, readProfileFromCache, groupMembersById, contactsForAdd }: HandleVideoViewerAuthorClickActionContext): void {
  if (!videoViewer) return;
  if (videoViewer.isMine || activeConversation?.chatType === "saved" || videoViewer.authorName === "Вы") return;

  const video = videoViewerRef.current;
  if (video) video.pause();
  setVideoViewer(null);
  setVideoViewerFailed(false);
  setVideoViewerPlaying(false);
  setVideoViewerProgress(0);
  setVideoViewerCurrentTime(0);
  setVideoViewerMenuOpen(false);

  if (activeConversation?.chatType === "channel") {
    const link = activeConversation.channel?.link ?? activeChat?.link;
    if (link) void openChannelModal(link);
    return;
  }

  if (videoViewer.authorLink) {
    void openProfileModal(videoViewer.authorLink);
    return;
  }

  if (activeConversation?.chatType === "direct") {
    const link = activeConversation.peer?.link || activeChat?.link;
    if (link) {
      void openProfileModal(link);
      return;
    }
  }

  const msg = videoViewer.messageId ? messages.find((m) => m.id === videoViewer.messageId) : null;
  const senderId = msg?.senderId;
  const senderProf = senderId ? readProfileFromCache(senderId) : null;
  const senderMeta = senderId && activeConversation?.chatType === "group" ? groupMembersById.get(senderId) : null;
  const contact = senderId ? contactsForAdd.find((c) => c.id === senderId) : null;
  const link = senderProf?.link || senderMeta?.link || contact?.link;
  if (link) {
    void openProfileModal(link);
  }
}

export interface HandleImageViewerAuthorClickActionContext {
  imageViewer: ChatImageGalleryItem | null;
  activeConversation: ConversationResponse | null;
  setImageViewer: React.Dispatch<React.SetStateAction<ChatImageGalleryItem | null>>;
  setImageViewerIndex: React.Dispatch<React.SetStateAction<number>>;
  setImageViewerPanelVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setImageViewerMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeChat: ChatSummary | null;
  openChannelModal: (link: string, options?: { forceRefresh?: boolean | undefined; } | undefined) => Promise<void>;
  openProfileModal: (link: string, external?: boolean) => Promise<void>;
  messages: DecryptedMessage[];
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  groupMembersById: Map<string, GroupMember>;
  contactsForAdd: { id: string; link: string; alias: string; avatarUrl?: string | null | undefined; displayName?: string | undefined; }[];
}

export function handleImageViewerAuthorClickAction({ imageViewer, activeConversation, setImageViewer, setImageViewerIndex, setImageViewerPanelVisible, setImageViewerMenuOpen, activeChat, openChannelModal, openProfileModal, messages, readProfileFromCache, groupMembersById, contactsForAdd }: HandleImageViewerAuthorClickActionContext): void {
  if (!imageViewer) return;
  if (imageViewer.isMine || activeConversation?.chatType === "saved" || imageViewer.authorName === "Вы") return;

  setImageViewer(null);
  setImageViewerIndex(-1);
  setImageViewerPanelVisible(true);
  setImageViewerMenuOpen(false);

  if (activeConversation?.chatType === "channel") {
    const link = activeConversation.channel?.link ?? activeChat?.link;
    if (link) void openChannelModal(link);
    return;
  }

  if (imageViewer.authorLink) {
    void openProfileModal(imageViewer.authorLink);
    return;
  }

  if (activeConversation?.chatType === "direct") {
    const link = activeConversation.peer?.link || activeChat?.link;
    if (link) {
      void openProfileModal(link);
      return;
    }
  }

  const msg = imageViewer.messageId ? messages.find((m) => m.id === imageViewer.messageId) : null;
  const senderId = msg?.senderId;
  const senderProf = senderId ? readProfileFromCache(senderId) : null;
  const senderMeta = senderId && activeConversation?.chatType === "group" ? groupMembersById.get(senderId) : null;
  const contact = senderId ? contactsForAdd.find((c) => c.id === senderId) : null;
  const link = senderProf?.link || senderMeta?.link || contact?.link;
  if (link) {
    void openProfileModal(link);
  }
}

export interface ResolveUnreadCountActionContext {
  selectedLink: string | null;
  unreadByLink: Record<string, number>;
  readMarkersRef: React.RefObject<Record<string, string>>;
  selfId: string | null;
}

export function resolveUnreadCountAction({ selectedLink, unreadByLink, readMarkersRef, selfId }: ResolveUnreadCountActionContext, chat: ChatSummary): number {
  if (chat.chatType === "saved") return 0;
  if (chat.chatType === "eclipse") {
    if (chat.link === selectedLink) return 0;
    const localUnreadCount = Math.max(0, unreadByLink[chat.link] ?? 0);
    if (localUnreadCount > 0) return Math.min(99, localUnreadCount);
    if (chat.link in unreadByLink) return 0;
    if (typeof chat.unreadCount === "number" && chat.unreadCount > 0) {
      return Math.min(99, chat.unreadCount);
    }
    return 0;
  }
  if (chat.link === selectedLink) return 0;
  const localUnreadCount = Math.max(0, unreadByLink[chat.link] ?? 0);
  if (localUnreadCount > 0) return Math.min(99, localUnreadCount);
  if (chat.lastMessageMine) return 0;
  const marker = readMarkersRef.current[chat.link];
  if (!marker) return localUnreadCount;
  const markerTs = Date.parse(marker);
  const lastTs = Date.parse(chat.lastMessageAt);
  if (!Number.isFinite(markerTs) || !Number.isFinite(lastTs) || lastTs <= markerTs + 1000) {
    return localUnreadCount;
  }
  const cached = selfId
    ? readConversationMemoryCache(selfId, chat.link, chat.chatType ?? "direct") ?? loadConversationSessionCache(selfId, chat.link, chat.chatType ?? "direct")
    : null;
  if (cached?.messages?.length) {
    const count = cached.messages.filter((msg) => {
      if (selfId && msg.senderId === selfId) return false;
      const createdTs = Date.parse(msg.createdAt);
      return Number.isFinite(createdTs) && createdTs > markerTs;
    }).length;
    return count > 0 ? Math.min(99, Math.max(localUnreadCount, count)) : localUnreadCount;
  }
  return localUnreadCount;
}

export interface WarmChatDetailsContext {
  orderedChats: ChatSummary[];
  isDesktop: boolean;
  readProfileFromCacheRef: React.RefObject<(userId: string) => ProfileBatchItem | null>;
  selfId: string | null;
  profileDetailsInFlightRef: React.RefObject<Set<string>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  groupDetailsInFlightRef: React.RefObject<Set<string>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  channelDetailsInFlightRef: React.RefObject<Set<string>>;
  ensureProfilesBatchRef: React.RefObject<(userIds: string[]) => Promise<void>>;
}

export function warmChatDetails({ orderedChats, isDesktop, readProfileFromCacheRef, selfId, profileDetailsInFlightRef, groupModalCacheRef, groupDetailsInFlightRef, channelModalCacheRef, channelDetailsInFlightRef, ensureProfilesBatchRef }: WarmChatDetailsContext): (() => void) | undefined {
  if (orderedChats.length === 0) return;
  const warmupChats = orderedChats.slice(0, isDesktop ? 10 : 6);
  const idleId = scheduleIdleTask(() => {
    const directProfileIds: string[] = [];
    for (const chat of warmupChats) {
      if (chat.chatType === "direct" || !chat.chatType) {
        if (chat.link?.startsWith("secret-")) continue;
        if (chat.peerId && !readProfileFromCacheRef.current(chat.peerId)) {
          directProfileIds.push(chat.peerId);
        }
        const cachedProfile = selfId
          ? readProfileDetailsMemoryCache(selfId, chat.link) ?? loadProfilePersistentCache(selfId, chat.link)
          : null;
        const isFreshProfile =
          Boolean(cachedProfile) && Date.now() - (cachedProfile?.savedAt ?? 0) <= PROFILE_CACHE_TTL_MS;
        if (!isFreshProfile && !profileDetailsInFlightRef.current.has(chat.link)) {
          profileDetailsInFlightRef.current.add(chat.link);
          void Promise.all([
            apiRequest<ProfilePreview>(`/api/profile/${encodeURIComponent(chat.link)}`, { method: "GET" }),
            apiRequest<ContactResponse>(`/api/contacts/${encodeURIComponent(chat.link)}`, { method: "GET" }),
          ])
            .then(([profile, contact]) => {
              const snapshot = { savedAt: Date.now(), profile, contact };
              writeProfileDetailsMemoryCache(selfId, chat.link, snapshot);
              if (selfId) {
                saveProfilePersistentCache(selfId, chat.link, snapshot);
              }
            })
            .catch(() => undefined)
            .finally(() => {
              profileDetailsInFlightRef.current.delete(chat.link);
            });
        }
        continue;
      }

      if (chat.chatType === "group") {
        // Secret chats have chatType "group" but are not real groups — skip groups API
        if (chat.link?.startsWith("secret-")) continue;
        const cached = groupModalCacheRef.current.get(chat.link);
        const isFresh = cached ? Date.now() - cached.savedAt <= GROUP_MODAL_CACHE_TTL_MS : false;
        if (isFresh || groupDetailsInFlightRef.current.has(chat.link)) continue;
        groupDetailsInFlightRef.current.add(chat.link);
        void apiRequest<GroupModalData>(`/api/groups/${encodeURIComponent(chat.link)}/members`, {
          method: "GET",
          cache: "no-store",
        })
          .then((data) => {
            groupModalCacheRef.current.set(chat.link, { savedAt: Date.now(), data });
          })
          .catch(() => undefined)
          .finally(() => {
            groupDetailsInFlightRef.current.delete(chat.link);
          });
        continue;
      }

      if (chat.chatType === "channel") {
        const cached = channelModalCacheRef.current.get(chat.link);
        const isFresh = cached ? Date.now() - cached.savedAt <= CHANNEL_MODAL_CACHE_TTL_MS : false;
        if (isFresh || channelDetailsInFlightRef.current.has(chat.link)) continue;
        channelDetailsInFlightRef.current.add(chat.link);
        void apiRequest<ChannelModalData>(`/api/channels/${encodeURIComponent(chat.link)}`, {
          method: "GET",
          cache: "no-store",
        })
          .then((data) => {
            channelModalCacheRef.current.set(chat.link, { savedAt: Date.now(), data });
          })
          .catch(() => undefined)
          .finally(() => {
            channelDetailsInFlightRef.current.delete(chat.link);
          });
      }
    }
    if (directProfileIds.length > 0) {
      void ensureProfilesBatchRef.current(directProfileIds);
    }
  }, 1200);

  return () => {
    if (typeof window !== "undefined" && typeof idleId === "number") {
      window.clearTimeout(idleId);
    }
  };
}

export interface OpenChatSearchResultActionContext {
  isDesktop: boolean;
  setChatSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setChatSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  chats: ChatSummary[];
  recentSearches: { ownerId: string | null; items: ChatSummary[]; };
  selfId: string | null;
  chatSearchUsers: ChatSearchUser[];
  chatSearchGroups: ChatSearchGroup[];
  chatSearchChannels: ChatSearchChannel[];
  setRecentSearches: React.Dispatch<React.SetStateAction<{ ownerId: string | null; items: ChatSummary[]; }>>;
  selectedSearchTargetRef: React.RefObject<{ link: string; chatType: ConversationChatType; isBot?: boolean | undefined; } | null>;
  selectedLinkRef: React.RefObject<string | null>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  router: AppRouterInstance;
}

export function openChatSearchResultAction({ isDesktop, setChatSearchOpen, setChatSearchQuery, chats, recentSearches, selfId, chatSearchUsers, chatSearchGroups, chatSearchChannels, setRecentSearches, selectedSearchTargetRef, selectedLinkRef, setSelectedLink, router }: OpenChatSearchResultActionContext, link: string, chatType: ConversationChatType): void {
  const normalizedLink = link.trim().toLowerCase();
  if (!normalizedLink) return;

  // On desktop, keep the search panel open so the found user hangs in the search results.
  // On mobile, close search to open the chat screen.
  if (!isDesktop) {
    setChatSearchOpen(false);
    setChatSearchQuery("");
  }

  let targetLink = normalizedLink;
  let displayName = normalizedLink;
  let avatarUrl: string | null = null;
  let peerId = `temp:${normalizedLink}`;
  let isBot = false;
  let membersCount: string | undefined;
  let subscribersCount: string | undefined;
  const known = [...chats, ...(recentSearches.ownerId === selfId ? recentSearches.items : [])].find(chat =>
    (chat.chatType ?? "direct") === chatType && (chat.link.trim().toLowerCase() === normalizedLink || chat.secondaryLinks?.some(link => link.toLowerCase() === normalizedLink)));
  if (known) {
    targetLink = known.link; displayName = known.displayName; avatarUrl = known.avatarUrl ?? null; peerId = known.peerId;
    isBot = Boolean(known.isBot); membersCount = known.membersCount; subscribersCount = known.subscribersCount;
  }

  if (chatType === "direct") {
    const u = chatSearchUsers.find(
      (user) =>
        user.link.trim().toLowerCase() === normalizedLink ||
        user.secondaryLinks?.some((l) => l.trim().toLowerCase() === normalizedLink),
    );
    if (u) {
      displayName = u.displayName;
      avatarUrl = u.avatarUrl ?? null;
      peerId = u.id;
      targetLink = u.link.trim().toLowerCase();
      isBot = Boolean(u.isBot);
    }
  } else if (chatType === "group") {
    const g = chatSearchGroups.find((group) => group.link.trim().toLowerCase() === normalizedLink);
    if (g) {
      displayName = g.name;
      avatarUrl = g.avatarUrl ?? null;
      peerId = g.id;
      membersCount = g.membersCount;
    }
  } else if (chatType === "channel") {
    const c = chatSearchChannels.find((channel) => channel.link.trim().toLowerCase() === normalizedLink);
    if (c) {
      displayName = c.name;
      avatarUrl = c.avatarUrl ?? null;
      peerId = c.id;
      subscribersCount = c.subscribersCount;
    }
  }

  // Viewed results belong to search history, not to the conversation list.
  if (selfId && !targetLink.startsWith("secret-")) {
    const entry: ChatSummary = {
      chatType, conversationId: `search:${peerId}`, peerId, link: targetLink,
      displayName, avatarUrl, isBot, membersCount, subscribersCount, lastMessage: "", lastMessageAt: new Date().toISOString(), lastMessageMine: false
    };
    setRecentSearches(previous => ({ ownerId: selfId, items: [entry, ...(previous.ownerId === selfId ? previous.items : []).filter(item => !(item.chatType === chatType && (item.link === targetLink || item.peerId === peerId)))].slice(0, 50) }));
  }

  selectedSearchTargetRef.current = { link: targetLink, chatType, isBot };
  selectedLinkRef.current = targetLink;
  setSelectedLink(targetLink);
  router.replace(`/app?chat=${encodeURIComponent(targetLink)}&chatType=${chatType}`, { scroll: false });
}

export interface SearchChatDirectoryContext {
  chatSearchOpen: boolean;
  deferredChatSearchQuery: string;
  setChatSearchUsers: React.Dispatch<React.SetStateAction<ChatSearchUser[]>>;
  setChatSearchGroups: React.Dispatch<React.SetStateAction<ChatSearchGroup[]>>;
  setChatSearchChannels: React.Dispatch<React.SetStateAction<ChatSearchChannel[]>>;
  setChatSearchSaved: React.Dispatch<React.SetStateAction<ChatSearchSaved[]>>;
  setChatSearchEclipse: React.Dispatch<React.SetStateAction<ChatSearchEclipse[]>>;
  setChatSearchError: React.Dispatch<React.SetStateAction<string | null>>;
  setChatSearchLoading: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export function searchChatDirectory({ chatSearchOpen, deferredChatSearchQuery, setChatSearchUsers, setChatSearchGroups, setChatSearchChannels, setChatSearchSaved, setChatSearchEclipse, setChatSearchError, setChatSearchLoading, t }: SearchChatDirectoryContext): (() => void) | undefined {
  if (!chatSearchOpen) return;
  const normalized = deferredChatSearchQuery.trim().replace(/^@+/, "").toLowerCase();
  if (normalized.length < 1) {
    setChatSearchUsers([]);
    setChatSearchGroups([]);
    setChatSearchChannels([]);
    setChatSearchSaved([]);
    setChatSearchEclipse([]);
    setChatSearchError(null);
    setChatSearchLoading(false);
    return;
  }

  let cancelled = false;
  const controller = new AbortController();
  const timer = window.setTimeout(async () => {
    setChatSearchLoading(true);
    setChatSearchError(null);
    try {
      const data = await apiRequest<ChatSearchResponse>(
        `/api/users/search?q=${encodeURIComponent(deferredChatSearchQuery.trim())}`,
        { method: "GET", signal: controller.signal, cache: "no-store", timeoutMs: 8_000 },
      );
      if (cancelled) return;
      setChatSearchUsers(data.users ?? []);
      setChatSearchGroups(data.groups ?? []);
      setChatSearchChannels(data.channels ?? []);
      setChatSearchSaved(data.saved ?? []);
      setChatSearchEclipse(data.eclipse ?? []);
    } catch (error) {
      if (cancelled || controller.signal.aborted) return;
      setChatSearchError(error instanceof Error ? error.message : t("Ошибка поиска"));
    } finally {
      if (!cancelled && !controller.signal.aborted) {
        setChatSearchLoading(false);
      }
    }
  }, normalized.length <= 2 ? 180 : 120);

  return () => {
    cancelled = true;
    controller.abort();
    window.clearTimeout(timer);
  };
}

export interface VirtualChatRowsActionContext {
  virtualChats: { chat: ChatSummary; index: number; }[];
  t: (source: string, values?: TranslationValues | undefined) => string;
  selfId: string | null;
  chatUnreadCountByLink: Map<string, number>;
  mutedChatLinkSet: Set<string>;
  pinnedChatLinkSet: Set<string>;
  readReceiptByLink: Map<string, string>;
  selectedLink: string | null;
  sendingLabelByLink: Map<string, string>;
  recordingLabelByLink: Map<string, string>;
  typingActiveByLink: Map<string, boolean>;
}

export function virtualChatRowsAction({ virtualChats, t, selfId, chatUnreadCountByLink, mutedChatLinkSet, pinnedChatLinkSet, readReceiptByLink, selectedLink, sendingLabelByLink, recordingLabelByLink, typingActiveByLink }: VirtualChatRowsActionContext): { chat: ChatSummary; index: number; preview: ChatListPreviewMeta; isEmptyChat: boolean; safePreviewText: string; callPreview: CallMessageData | null; senderPrefix: string; timeLabel: string; unreadCount: number; isChatMuted: boolean; isPinned: boolean; isLastDirectMessageRead: boolean; sendingLabel: string; recordingLabel: string; isTyping: boolean; }[] {
  return virtualChats.map(({ chat, index }) => {
    const preview = resolveChatListPreviewMetaCached(chat.lastMessage);
    const isEmptyChat =
      !chat.lastMessage.trim() &&
      !chat.lastMessageCipherText &&
      !chat.lastMessageIv &&
      !chat.lastMessageEncryptedKey &&
      !chat.systemPayload;
    let senderPrefix = "";
    if (chat.chatType === "group") {
      if (chat.lastMessageSenderAlias) {
        senderPrefix = `${chat.lastMessageSenderAlias}: `;
      } else {
        const match = preview.text.match(/^([^:]{1,48}):\s+/);
        if (match) {
          senderPrefix = `${match[1]}: `;
        }
      }
    }
    const previewText =
      senderPrefix && preview.text.startsWith(senderPrefix)
        ? preview.text.slice(senderPrefix.length)
        : preview.text.replace(/^([^:]{1,48}):\s+/, "");
    const normalizedRawPreview = normalizeLastMessagePreviewCached(chat.lastMessage || "").trim();
    let safePreviewText =
      chat.chatType === "eclipse" && isEmptyChat
        ? chat.statusText ?? ECLIPSE_LIST_STATUS
        : previewText.trim() ||
        (normalizedRawPreview && normalizedRawPreview !== "Сообщение" ? normalizedRawPreview : "") ||
        fallbackPreviewTextByKind(preview.kind);
    if ((chat.lastMessageIsService && !hasEncryptedPreview(chat)) ||
      (chat.systemPayload && chat.systemPayload.botRole !== "user") ||
      (chat.chatType === "saved" && !chat.lastMessageCipherText && chat.lastMessage === "Добро пожаловать в Eclipse") ||
      (chat.lastMessage === "Сообщение" && Boolean(chat.lastMessageCipherText || chat.systemPayload)) ||
      (chat.chatType === "eclipse" && chat.isSystem && chat.systemPayload?.botRole !== "user")) {
      safePreviewText = localizeSystemText(safePreviewText);
    }
    const callPreview = readCallMessage(chat.systemPayload);
    if (callPreview) safePreviewText = t(callMessageTitle(callPreview, selfId ?? ""));
    if (isEmptyChat && chat.chatType !== "eclipse") {
      if (chat.chatType === "group") {
        safePreviewText = t("Группа создана");
      } else if (chat.chatType === "channel") {
        safePreviewText = t("Канал создан");
      } else {
        safePreviewText = t("Напишите первым!");
      }
    }
    return {
      chat,
      index,
      preview,
      isEmptyChat,
      safePreviewText,
      callPreview,
      senderPrefix,
      timeLabel: formatChatListTimeLabel(chat.lastMessageAt),
      unreadCount: chatUnreadCountByLink.get(chat.link) ?? 0,
      isChatMuted: chat.chatType !== "saved" && chat.chatType !== "eclipse" && mutedChatLinkSet.has(chat.link),
      isPinned: pinnedChatLinkSet.has(chat.link),
      isLastDirectMessageRead:
        chat.chatType === "direct" &&
        chat.lastMessageMine &&
        isMessageReadByMarker(readReceiptByLink.get(chat.link), chat.lastMessageAt),
      sendingLabel: selectedLink !== chat.link ? sendingLabelByLink.get(chat.link) ?? "" : "",
      recordingLabel: selectedLink !== chat.link ? recordingLabelByLink.get(chat.link) ?? "" : "",
      isTyping: selectedLink !== chat.link ? typingActiveByLink.get(chat.link) ?? false : false,
    };
  });
}

export interface ScrollToMessageByIdActionContext {
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  messages: DecryptedMessage[];
  messageVerticalOffset: number;
  bannersHeight: number;
  messageOffsets: { offsets: number[]; totalHeight: number; };
  messageHeightsRef: React.RefObject<Record<string, number>>;
  messageSizes: number[];
  interruptMessageAutoScroll: () => void;
  programmaticScrollRef: React.RefObject<boolean>;
  bottomScrollAnimationRef: React.RefObject<{ viewport: HTMLElement; cancel(): void; } | null>;
  setMessagesScrollTop: React.Dispatch<React.SetStateAction<number>>;
  messagesAtBottomRef: React.RefObject<boolean>;
  userScrolledUpRef: React.RefObject<boolean>;
  chatScrollRef: React.RefObject<{ key: string; link: string; initial: boolean; lastMessageId?: string | undefined; requestedBefore?: string | undefined; } | null>;
  chatReadingPositionsRef: React.RefObject<Map<string, { messageId: string; offset: number; top: number; createdAt: string; }>>;
  saveChatReadingPosition: (viewport: HTMLDivElement) => void;
  flashMessageHighlight: (messageId: string, durationMs?: number) => void;
}

export function scrollToMessageByIdAction({ messagesViewportRef, messages, messageVerticalOffset, bannersHeight, messageOffsets, messageHeightsRef, messageSizes, interruptMessageAutoScroll, programmaticScrollRef, bottomScrollAnimationRef, setMessagesScrollTop, messagesAtBottomRef, userScrolledUpRef, chatScrollRef, chatReadingPositionsRef, saveChatReadingPosition, flashMessageHighlight }: ScrollToMessageByIdActionContext, messageId: string, highlightDurationMs = 1800): void {
  const viewport = messagesViewportRef.current;
  if (!viewport) return;
  const targetIndex = messages.findIndex((entry) => entry.id === messageId);
  if (targetIndex < 0) return;

  const targetTop = messageVerticalOffset + bannersHeight + (messageOffsets.offsets[targetIndex] ?? 0);
  const targetHeight = messageHeightsRef.current[messageId] ?? messageSizes[targetIndex] ?? MESSAGE_ITEM_ESTIMATED_HEIGHT;
  const nextTop = Math.max(0, targetTop - Math.max(24, (viewport.clientHeight - targetHeight) / 2));

  interruptMessageAutoScroll();
  programmaticScrollRef.current = true;
  bottomScrollAnimationRef.current = createChatTargetScroll(viewport, () => {
    const row = viewport.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!row) return nextTop;
    return viewport.scrollTop + row.getBoundingClientRect().top - viewport.getBoundingClientRect().top
      - Math.max(24, (viewport.clientHeight - row.offsetHeight) / 2);
  }, () => {
    setMessagesScrollTop(viewport.scrollTop);
    const distanceToBottom = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
    const reachedBottom = distanceToBottom <= 1;
    messagesAtBottomRef.current = reachedBottom;
    userScrolledUpRef.current = !reachedBottom;
    bottomScrollAnimationRef.current = null;
    programmaticScrollRef.current = false;
    if (reachedBottom) {
      const chat = chatScrollRef.current;
      if (chat) chatReadingPositionsRef.current.delete(chat.key);
    } else {
      saveChatReadingPosition(viewport);
    }
    if (highlightDurationMs > 0) flashMessageHighlight(messageId, highlightDurationMs);
  });
}
