"use client";

import { dateLocale } from "@/lib/i18n/translate";

import { useCallback, useEffect, useMemo } from "react";
import { useStableEvent } from "@/lib/client/use-stable-event";

import { readForwardedContent } from "@/lib/client/message-forwarding";

import { type ConversationChatType, type DecryptedMessage } from "../../types";

import { parseChatTimestamp } from "../../chat-realtime-chatlist";

import { normalizeLastMessagePreviewCached } from "../chat-previews";

import { parseMessageContentCached } from "../message-content";
import { CHAT_ITEM_ESTIMATED_HEIGHT, MESSAGE_ITEM_ESTIMATED_HEIGHT, MESSAGE_ROW_GAP } from "../config";

import { formatMessageDayLabel } from "../message-presentation";

import { clampVirtualRange } from "../virtualization";

import { warmChatDetails, openChatSearchResultAction, searchChatDirectory, virtualChatRowsAction, scrollToMessageByIdAction } from "../chat-list-selectors";

import type { ProfileMediaModel } from "./useProfileMedia";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ChatInteractionModel } from "./useChatInteraction";
import type { MessageReactionsModel } from "./useMessageReactions";

export interface ChatDirectorySources {
  profileMedia: Pick<ProfileMediaModel, "chatUnreadCountByLink">;
  active: Pick<ActiveConversationModel, "activeChat">;
  page: Pick<ChatPageStateModel, "t" | "recentSearches" | "setChatListMenuOpen" | "setChatSearchOpen" | "chatSearchInputRef" | "setRecentSearches" | "router" | "chatSearchOpen" | "deferredChatSearchQuery"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "chats" | "mediaReadyVersion" | "messages" | "activeConversation">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "pinnedChatLinkSet" | "setChatListHelper" | "chatListHelper" | "mutedChatLinkSet">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    directorySearch: Pick<ChatPageStateModel["directorySearch"], "chatSearchQuery" | "chatSearchScope" | "chatSearchSaved" | "chatSearchEclipse" | "chatSearchUsers" | "chatSearchGroups" | "chatSearchChannels" | "setChatSearchScope" | "setChatSearchQuery" | "setChatSearchError" | "setChatSearchLoading" | "setChatSearchSaved" | "setChatSearchEclipse" | "setChatSearchUsers" | "setChatSearchGroups" | "setChatSearchChannels">;
    selection: Pick<ChatPageStateModel["selection"], "selectedSearchTargetRef" | "selectedLinkRef" | "setSelectedLink" | "selectedLink">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "readReceiptsRef" | "readReceiptsVersion">;
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "typingByLink" | "recordingByLink" | "sendingByLink">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "stickerPickerOpen">;

  };
  presentation: Pick<ConversationPresentationModel, "activeTitle">;
  elements: Pick<ChatElementStateModel, "chatOverscan" | "flashMessageHighlight" | "scrollMessagesToBottom"> & {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "profileDetailsInFlightRef" | "groupModalCacheRef" | "groupDetailsInFlightRef" | "channelModalCacheRef" | "channelDetailsInFlightRef" | "chatListViewportRef" | "messagesViewportRef" | "chatScrollRef" | "chatReadingPositionsRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "setStoriesHidden" | "storiesHiddenRef" | "chatListViewportHeight" | "messageMeasureVersion" | "messagesViewportHeight" | "setMessagesScrollTop">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "chatListScrollTop">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "messageHeightsRef">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "programmaticScrollRef" | "bottomScrollAnimationRef" | "messagesAtBottomRef" | "userScrolledUpRef">;

  };
  bootstrap: {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "currentUserIdRef">;

  };
  interaction: Pick<ChatInteractionModel, "interruptMessageAutoScroll" | "saveChatReadingPosition">;
}

export interface ChatDirectoryDeferred {
  readonly reactions: {
    realtimeHandler: Pick<MessageReactionsModel["realtimeHandler"], "readProfileFromCacheRef" | "ensureProfilesBatchRef">;

  };
}
export interface ChatDirectoryModel {
  otherUnreadNotifications: number;
  orderedChats: import("@/app/app/(chats)/types").ChatSummary[];
  chatSearchNormalizedQuery: string;
  chatSearchLocalResults: import("@/app/app/(chats)/types").ChatSummary[];
  showSearchChats: boolean;
  showSearchUsers: boolean;
  showSearchGroups: boolean;
  showSearchChannels: boolean;
  showSearchSaved: boolean;
  showSearchEclipse: boolean;
  visibleChatSearchUsers: import("@/app/app/(chats)/types").ChatSearchUser[];
  visibleChatSearchGroups: import("@/app/app/(chats)/types").ChatSearchGroup[];
  visibleChatSearchChannels: import("@/app/app/(chats)/types").ChatSearchChannel[];
  hasChatSearchResults: boolean;
  toggleStoriesRail: () => void;
  openChatSearchPanel: () => void;
  closeChatSearchPanel: () => void;
  openChatSearchResult: (link: string, chatType: import("@/app/app/(chats)/types").ConversationChatType) => void;
  chatListHelperChat: import("@/app/app/(chats)/types").ChatSummary | null;
  chatListHelperFrame: {
    viewport: {
      left: number;
      top: number;
      width: number;
      height: number;

    };
    panel: {
      left: number;
      top: number;
      width: number;
      opensBelow: boolean;

    };

  } | null;
  activeReadReceiptIso: string | undefined;
  chatListTotalHeight: number;
  shouldVirtualizeChatList: boolean;
  chatListWindow: {
    start: number;
    end: number;

  };
  virtualChatRows: {
    chat: import("@/app/app/(chats)/types").ChatSummary;
    index: number;
    preview: import("@/app/app/(chats)/types").ChatListPreviewMeta;
    isEmptyChat: boolean;
    safePreviewText: string;
    callPreview: import("@/lib/call-history").CallMessageData | null;
    senderPrefix: string;
    timeLabel: string;
    unreadCount: number;
    isChatMuted: boolean;
    isPinned: boolean;
    isLastDirectMessageRead: boolean;
    sendingLabel: string;
    recordingLabel: string;
    isTyping: boolean;

  }[];
  messageSizes: number[];
  messageOffsets: {
    offsets: number[];
    totalHeight: number;

  };
  bannersHeight: number;
  messageVerticalOffset: number;
  scrollToMessageById: (messageId: string, highlightDurationMs?: number) => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatDirectory(sources: ChatDirectorySources, deferred: ChatDirectoryDeferred): ChatDirectoryModel {
  const { chatUnreadCountByLink } = sources.profileMedia;
  const { activeChat } = sources.active;
  const { t, recentSearches, setChatListMenuOpen, setChatSearchOpen, chatSearchInputRef, setRecentSearches, router, chatSearchOpen, deferredChatSearchQuery } = sources.page;
  const { chats, mediaReadyVersion, messages, activeConversation } = sources.page.conversation;
  const { pinnedChatLinkSet, setChatListHelper, chatListHelper, mutedChatLinkSet } = sources.page.notificationAndContacts;
  const { isDesktop } = sources.page.panels;
  const { selfId, selfProfile } = sources.page.account;
  const { chatSearchQuery, chatSearchScope, chatSearchSaved, chatSearchEclipse, chatSearchUsers, chatSearchGroups, chatSearchChannels, setChatSearchScope, setChatSearchQuery, setChatSearchError, setChatSearchLoading, setChatSearchSaved, setChatSearchEclipse, setChatSearchUsers, setChatSearchGroups, setChatSearchChannels } = sources.page.directorySearch;
  const { selectedSearchTargetRef, selectedLinkRef, setSelectedLink, selectedLink } = sources.page.selection;
  const { readReceiptsRef, readReceiptsVersion } = sources.page.messageInteraction;
  const { typingByLink, recordingByLink, sendingByLink } = sources.page.recorderPresentation;
  const { stickerPickerOpen } = sources.page.attachmentDraft;
  const { activeTitle } = sources.presentation;
  const { chatOverscan, flashMessageHighlight, scrollMessagesToBottom } = sources.elements;
  const { profileDetailsInFlightRef, groupModalCacheRef, groupDetailsInFlightRef, channelModalCacheRef, channelDetailsInFlightRef, chatListViewportRef, messagesViewportRef, chatScrollRef, chatReadingPositionsRef } = sources.elements.conversationElement;
  const { setStoriesHidden, storiesHiddenRef, chatListViewportHeight, messageMeasureVersion, messagesViewportHeight, setMessagesScrollTop } = sources.elements.storyAndViewport;
  const { chatListScrollTop } = sources.elements.conversationRequest;
  const { messageHeightsRef } = sources.elements.messageDelivery;
  const { programmaticScrollRef, bottomScrollAnimationRef, messagesAtBottomRef, userScrolledUpRef } = sources.elements.conversationScroll;
  const { currentUserIdRef } = sources.bootstrap.accountNavigation;
  const { interruptMessageAutoScroll, saveChatReadingPosition } = sources.interaction;

  const totalUnreadNotifications = useMemo(() => {
    let total = 0;
    chatUnreadCountByLink.forEach((count) => {
      total += Math.max(0, count);
    });
    return total;
  }, [chatUnreadCountByLink]);

  const otherUnreadNotifications = useMemo(() => {
    let total = 0;
    chatUnreadCountByLink.forEach((count, link) => {
      if (link !== activeChat?.link) {
        total += Math.max(0, count);
      }
    });
    return total;
  }, [chatUnreadCountByLink, activeChat?.link]);

  useEffect(() => {
    const previousTitle = document.title;
    const pluralizeNotifications = (count: number) => {
      if (dateLocale() === "en-US") return count === 1 ? "notification" : "notifications";
      const abs = Math.abs(count) % 100;
      const last = abs % 10;
      if (abs > 10 && abs < 20) return t("уведомлений");
      if (last === 1) return t("уведомление");
      if (last > 1 && last < 5) return t("уведомления");
      return t("уведомлений");
    };
    const nextTitle =
      totalUnreadNotifications > 0
        ? `${totalUnreadNotifications} ${pluralizeNotifications(totalUnreadNotifications)}`
        : activeTitle.trim() || "Eclipse";
    document.title = nextTitle;
    return () => {
      document.title = previousTitle;
    };
  }, [activeTitle, totalUnreadNotifications, t]);

  const orderedChats = useMemo(
    () => {
      const baseSorted = [...chats].sort((a, b) => {
        const pinnedA = pinnedChatLinkSet.has(a.link);
        const pinnedB = pinnedChatLinkSet.has(b.link);
        if (pinnedA !== pinnedB) {
          return pinnedA ? -1 : 1;
        }
        const unreadA = chatUnreadCountByLink.get(a.link) ?? 0;
        const unreadB = chatUnreadCountByLink.get(b.link) ?? 0;
        if (unreadA !== unreadB) {
          return unreadB - unreadA;
        }
        return parseChatTimestamp(b.lastMessageAt) - parseChatTimestamp(a.lastMessageAt);
      });

      return baseSorted;
    },
    [chats, chatUnreadCountByLink, pinnedChatLinkSet],
  );

  useEffect(() => {
    return warmChatDetails({ orderedChats, isDesktop, readProfileFromCacheRef: deferred.reactions.realtimeHandler.readProfileFromCacheRef, selfId, profileDetailsInFlightRef, groupModalCacheRef, groupDetailsInFlightRef, channelModalCacheRef, channelDetailsInFlightRef, ensureProfilesBatchRef: deferred.reactions.realtimeHandler.ensureProfilesBatchRef });
  }, [isDesktop, orderedChats]);

  const chatSearchNormalizedQuery = useMemo(
    () => chatSearchQuery.trim().replace(/^@+/, "").toLowerCase(),
    [chatSearchQuery],
  );

  const chatSearchLocalResults = useMemo(() => {
    const recent = recentSearches.ownerId === selfId ? recentSearches.items : [];
    const combined = [...recent.map(item => orderedChats.find(chat => chat.link === item.link && chat.chatType === item.chatType) ?? item), ...orderedChats];
    const seen = new Set<string>();
    const searchChats = combined.filter(chat => {
      const key = `${chat.chatType ?? "direct"}:${chat.link}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return chatSearchScope === "all" || chatSearchScope === "chats" ||
        (chatSearchScope === "users" && chat.chatType === "direct") ||
        (chatSearchScope === "groups" && chat.chatType === "group") ||
        (chatSearchScope === "channels" && chat.chatType === "channel");
    });
    const source =
      chatSearchNormalizedQuery && (chatSearchSaved.length > 0 || chatSearchEclipse.length > 0)
        ? searchChats.filter((chat) => chat.chatType !== "saved" && chat.chatType !== "eclipse")
        : searchChats;
    if (!chatSearchNormalizedQuery) return source.slice(0, 50);
    return source
      .filter((chat) => {
        const preview = normalizeLastMessagePreviewCached(chat.lastMessage || "");
        return [chat.displayName, chat.link, preview]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(chatSearchNormalizedQuery));
      })
      .slice(0, 24);
  }, [chatSearchEclipse.length, chatSearchNormalizedQuery, chatSearchSaved.length, orderedChats, recentSearches, selfId, chatSearchScope]);

  const showSearchChats = chatSearchScope === "all" || chatSearchScope === "chats";

  const showSearchUsers = chatSearchScope === "all" || chatSearchScope === "users";

  const showSearchGroups = chatSearchScope === "all" || chatSearchScope === "groups";

  const showSearchChannels = chatSearchScope === "all" || chatSearchScope === "channels";

  const showSearchSaved = chatSearchScope === "all" || chatSearchScope === "chats";

  const showSearchEclipse = showSearchSaved || showSearchUsers;

  const localSearchResultKeys = useMemo(
    () =>
      new Set(
        chatSearchLocalResults.map((chat) => `${chat.chatType ?? "direct"}:${chat.link.trim().toLowerCase()}`),
      ),
    [chatSearchLocalResults],
  );

  const localSearchResultIds = useMemo(
    () =>
      new Set(
        chatSearchLocalResults.map((chat) => `${chat.chatType ?? "direct"}:${chat.peerId}`),
      ),
    [chatSearchLocalResults],
  );

  const visibleChatSearchUsers = useMemo(
    () =>
      chatSearchScope === "all"
        ? chatSearchUsers.filter(
          (user) =>
            !localSearchResultIds.has(`direct:${user.id}`) &&
            !localSearchResultKeys.has(`direct:${user.link.trim().toLowerCase()}`),
        )
        : chatSearchUsers,
    [chatSearchScope, chatSearchUsers, localSearchResultIds, localSearchResultKeys],
  );

  const visibleChatSearchGroups = useMemo(
    () =>
      chatSearchScope === "all"
        ? chatSearchGroups.filter(
          (group) =>
            !localSearchResultIds.has(`group:${group.id}`) &&
            !localSearchResultKeys.has(`group:${group.link.trim().toLowerCase()}`),
        )
        : chatSearchGroups,
    [chatSearchGroups, chatSearchScope, localSearchResultIds, localSearchResultKeys],
  );

  const visibleChatSearchChannels = useMemo(
    () =>
      chatSearchScope === "all"
        ? chatSearchChannels.filter(
          (channel) =>
            !localSearchResultIds.has(`channel:${channel.id}`) &&
            !localSearchResultKeys.has(`channel:${channel.link.trim().toLowerCase()}`),
        )
        : chatSearchChannels,
    [chatSearchChannels, chatSearchScope, localSearchResultIds, localSearchResultKeys],
  );

  const hasChatSearchResults =
    (showSearchSaved && chatSearchSaved.length > 0) ||
    (showSearchEclipse && chatSearchEclipse.length > 0) ||
    ((showSearchChats || !chatSearchNormalizedQuery) && chatSearchLocalResults.length > 0) ||
    (showSearchUsers && visibleChatSearchUsers.length > 0) ||
    (showSearchGroups && visibleChatSearchGroups.length > 0) ||
    (showSearchChannels && visibleChatSearchChannels.length > 0);

  const toggleStoriesRail = useCallback(() => {
    setStoriesHidden((prev) => {
      const next = !prev;
      storiesHiddenRef.current = next;
      return next;
    });
  }, []);

  const openChatSearchPanel = useCallback(() => {
    setChatListMenuOpen(false);
    setChatListHelper(null);
    setChatSearchScope("all");
    setChatSearchOpen(true);
    requestAnimationFrame(() => chatSearchInputRef.current?.focus());
  }, []);

  const closeChatSearchPanel = useCallback(() => {
    setChatSearchOpen(false);
    setChatSearchQuery("");
    setChatSearchError(null);
    setChatSearchLoading(false);
    setChatSearchSaved([]);
    setChatSearchEclipse([]);
  }, []);

  const openChatSearchResult = useCallback(
    (link: string, chatType: ConversationChatType) => {
      return openChatSearchResultAction({ isDesktop, setChatSearchOpen, setChatSearchQuery, chats, recentSearches, selfId, chatSearchUsers, chatSearchGroups, chatSearchChannels, setRecentSearches, selectedSearchTargetRef, selectedLinkRef, setSelectedLink, router }, link, chatType);
    },
    [chatSearchChannels, chatSearchGroups, chatSearchUsers, chats, isDesktop, router, recentSearches, selfId],
  );

  useEffect(() => {
    if (!chatSearchOpen) return;
    const frame = requestAnimationFrame(() => chatSearchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [chatSearchOpen]);

  useEffect(() => {
    return searchChatDirectory({ chatSearchOpen, deferredChatSearchQuery, setChatSearchUsers, setChatSearchGroups, setChatSearchChannels, setChatSearchSaved, setChatSearchEclipse, setChatSearchError, setChatSearchLoading, t });
  }, [chatSearchOpen, deferredChatSearchQuery, t]);

  const chatListHelperChat = useMemo(
    () => (chatListHelper ? orderedChats.find((chat) => chat.link === chatListHelper.link) ?? chats.find((chat) => chat.link === chatListHelper.link) ?? null : null),
    [chatListHelper, chats, orderedChats],
  );

  const chatListHelperFrame =
    chatListHelper && chatListViewportRef.current && chatListHelper.anchorRect
      ? (() => {
        const viewportRect = chatListViewportRef.current.getBoundingClientRect();
        const anchorRect = chatListHelper.anchorRect;
        const anchorRight = anchorRect.left + anchorRect.width;
        const panelWidth = Math.min(210, Math.max(185, anchorRect.width - 90));
        const estimatedPanelHeight = chatListHelper.chatType === "direct" ? 152 : 196;
        const left = Math.min(
          viewportRect.right - panelWidth - 10,
          Math.max(viewportRect.left + 10, anchorRight - panelWidth - 12),
        );
        const openBelowTop = anchorRect.top + anchorRect.height + 6;
        const openAboveTop = anchorRect.top - estimatedPanelHeight - 6;
        const opensBelow = openBelowTop + estimatedPanelHeight <= viewportRect.bottom - 8;
        const top = opensBelow
          ? openBelowTop
          : Math.max(viewportRect.top + 8, openAboveTop);

        return {
          viewport: {
            left: viewportRect.left + 8,
            top: viewportRect.top + 8,
            width: Math.max(0, viewportRect.width - 16),
            height: Math.max(0, viewportRect.height - 16),
          },
          panel: {
            left,
            top,
            width: panelWidth,
            opensBelow,
          },
        };
      })()
      : null;

  const readReceiptByLink = useMemo(
    () => new Map<string, string>(Object.entries(readReceiptsRef.current)),
    [readReceiptsVersion],
  );

  const typingActiveByLink = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const [link, byUser] of Object.entries(typingByLink)) {
      map.set(link, Object.keys(byUser).length > 0);
    }
    return map;
  }, [typingByLink]);

  const recordingLabelByLink = useMemo(() => {
    const map = new Map<string, string>();
    for (const [link, byUser] of Object.entries(recordingByLink)) {
      const first = Object.values(byUser)[0];
      if (first) map.set(link, first);
    }
    return map;
  }, [recordingByLink]);

  const sendingLabelByLink = useMemo(() => {
    const map = new Map<string, string>();
    for (const [link, byUser] of Object.entries(sendingByLink)) {
      const first = Object.values(byUser)[0];
      if (first) map.set(link, first);
    }
    return map;
  }, [sendingByLink]);

  const activeReadReceiptIso = activeChat?.link ? readReceiptByLink.get(activeChat.link) : undefined;

  const chatListTotalHeight = orderedChats.length * CHAT_ITEM_ESTIMATED_HEIGHT;

  const shouldVirtualizeChatList = chatListViewportHeight > 0 && orderedChats.length > Math.ceil(chatListViewportHeight / CHAT_ITEM_ESTIMATED_HEIGHT) + chatOverscan * 2;

  const chatListWindow = useMemo(() => {
    if (orderedChats.length === 0 || !shouldVirtualizeChatList) {
      return { start: 0, end: -1 };
    }
    const start = Math.floor(chatListScrollTop / CHAT_ITEM_ESTIMATED_HEIGHT);
    const visibleCount = Math.ceil(chatListViewportHeight / CHAT_ITEM_ESTIMATED_HEIGHT);
    const end = start + visibleCount;
    return clampVirtualRange(orderedChats.length, start, end, chatOverscan);
  }, [orderedChats.length, chatListScrollTop, chatListViewportHeight, chatOverscan, shouldVirtualizeChatList]);

  const virtualChats = useMemo(() => {
    if (!shouldVirtualizeChatList) {
      return orderedChats.map((chat, index) => ({ chat, index }));
    }
    if (chatListWindow.end < chatListWindow.start) return [];
    return orderedChats.slice(chatListWindow.start, chatListWindow.end + 1).map((chat, offset) => ({
      chat,
      index: chatListWindow.start + offset,
    }));
  }, [orderedChats, chatListWindow.end, chatListWindow.start, shouldVirtualizeChatList]);

  const virtualChatRows = useMemo(() => {
    return virtualChatRowsAction({ virtualChats, t, selfId, chatUnreadCountByLink, mutedChatLinkSet, pinnedChatLinkSet, readReceiptByLink, selectedLink, sendingLabelByLink, recordingLabelByLink, typingActiveByLink });
  }, [
    chatUnreadCountByLink,
    mutedChatLinkSet,
    pinnedChatLinkSet,
    readReceiptByLink,
    recordingLabelByLink,
    selectedLink,
    sendingLabelByLink,
    typingActiveByLink,
    selfId,
    mediaReadyVersion,
    virtualChats, t]);

  const estimatedMessageHeights = useMemo(() => new WeakMap<DecryptedMessage, number>(), [selfId, selfProfile?.id]);
  const messageSizes = useMemo(
    () => {
      void messageMeasureVersion;
      return messages.map((message) => {
        {
          const measured =
            messageHeightsRef.current[message.id] ??
            (message.localId ? messageHeightsRef.current[message.localId] : undefined);
          if (measured !== undefined) return measured;
        }

        const cachedEstimate = estimatedMessageHeights.get(message);
        if (cachedEstimate !== undefined) return cachedEstimate;
        const estimate = (() => { try {
          if (message.systemPayload) {
            const eventType = (message.systemPayload as any)?.eventType;
            if (eventType === "call") return 64;
            if (eventType === "wallpaper_change") {
              const currentUserId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? "";
              const senderId = (message.systemPayload as any)?.metadata?.senderId;
              const isSelf = Boolean(message.pending || (currentUserId && (senderId === currentUserId || message.senderId === currentUserId)));
              const hasWallpaper = Boolean((message.systemPayload as any)?.metadata?.wallpaperUrl);
              return !hasWallpaper ? 36 : isSelf ? 116 : 168;
            }
            return 32;
          }
          const layoutText =
            message.text;
          const parsed = parseMessageContentCached(layoutText, false);
          if (parsed.kind === "text") {
            const lines = parsed.text ? parsed.text.split("\n").length : 1;
            const textLen = parsed.text ? parsed.text.length : 0;
            const estimatedLines = Math.max(lines, Math.ceil(textLen / 50));
            const replyOffset = (message.replyToMessageId ? 48 : 0) + (readForwardedContent(message.text) ? 40 : 0);
            return 34 + estimatedLines * 19 + replyOffset;
          } else if (parsed.kind === "sticker") {
            return 135 + (readForwardedContent(message.text) ? 40 : 0);
          } else if (parsed.kind === "image" || parsed.kind === "video") {
            return 275 + (readForwardedContent(message.text) ? 40 : 0);
          } else if (parsed.kind === "voice") {
            return 58 + (readForwardedContent(message.text) ? 40 : 0);
          } else if (parsed.kind === "music") {
            return 70 + (readForwardedContent(message.text) ? 40 : 0);
          } else if (parsed.kind === "file") {
            return 74 + (readForwardedContent(message.text) ? 40 : 0);
          }
        } catch { }

        return MESSAGE_ITEM_ESTIMATED_HEIGHT;
        })();
        estimatedMessageHeights.set(message, estimate);
        return estimate;
      });
    },
    [messages, messageMeasureVersion, estimatedMessageHeights],
  );

  const messageOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < messageSizes.length; i += 1) {
      offsets.push(acc);
      const size = messageSizes[i];
      acc += size + (size > 0 ? MESSAGE_ROW_GAP : 0);
    }
    return { offsets, totalHeight: Math.max(0, acc - MESSAGE_ROW_GAP) };
  }, [messageSizes]);

  const bannersHeight = useMemo(() => {
    if (!activeConversation) return 0;
    const isChannel = activeConversation.chatType === "channel";
    const isGroup = activeConversation.chatType === "group";
    if (!isChannel && !isGroup) return 0;

    const selfIdStr = selfId ?? selfProfile?.id ?? "";
    let linesCount = 0;

    if (isGroup && activeConversation.group) {
      const group = activeConversation.group;
      const isOwner = group.ownerId === selfIdStr;
      const rawDate = isOwner ? group.createdAt : (group.myJoinedAt || group.createdAt);
      const dateLabel = rawDate ? formatMessageDayLabel(rawDate) : "";
      linesCount = dateLabel ? 2 : 1;
    } else if (isChannel && activeConversation.channel) {
      const channel = activeConversation.channel;
      const isOwner = channel.ownerId === selfIdStr;
      const rawDate = isOwner ? channel.createdAt : (channel.myJoinedAt || channel.createdAt);
      const dateLabel = rawDate ? formatMessageDayLabel(rawDate) : "";
      linesCount = dateLabel ? 2 : 1;
    }

    if (linesCount === 0) return 0;
    // Match the rendered 22px pills, 10px gap and 8px/20px padding.
    // Rows are positioned absolutely, so undersizing this block overlaps the next date.
    return linesCount * 22 + (linesCount - 1) * 10 + 28;
  }, [activeConversation, selfId, selfProfile?.id]);

  const messageVerticalOffset = useMemo(
    () => Math.max(0, messagesViewportHeight - (messageOffsets.totalHeight + bannersHeight)),
    [messagesViewportHeight, messageOffsets.totalHeight, bannersHeight],
  );

  const scrollToMessageById = useStableEvent((messageId: string, highlightDurationMs: number = 1800) => {
    return scrollToMessageByIdAction({ messagesViewportRef, messages, messageVerticalOffset, bannersHeight, messageOffsets, messageHeightsRef, messageSizes, interruptMessageAutoScroll, programmaticScrollRef, bottomScrollAnimationRef, setMessagesScrollTop, messagesAtBottomRef, userScrolledUpRef, chatScrollRef, chatReadingPositionsRef, saveChatReadingPosition, flashMessageHighlight }, messageId, highlightDurationMs);
  });

  useEffect(() => {
    if (stickerPickerOpen) {
      requestAnimationFrame(() => {
        scrollMessagesToBottom("smooth");
      });
      const timer = setTimeout(() => {
        scrollMessagesToBottom("smooth");
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [stickerPickerOpen, scrollMessagesToBottom]);

  return {
    otherUnreadNotifications,
    orderedChats,
    chatSearchNormalizedQuery,
    chatSearchLocalResults,
    showSearchChats,
    showSearchUsers,
    showSearchGroups,
    showSearchChannels,
    showSearchSaved,
    showSearchEclipse,
    visibleChatSearchUsers,
    visibleChatSearchGroups,
    visibleChatSearchChannels,
    hasChatSearchResults,
    toggleStoriesRail,
    openChatSearchPanel,
    closeChatSearchPanel,
    openChatSearchResult,
    chatListHelperChat,
    chatListHelperFrame,
    activeReadReceiptIso,
    chatListTotalHeight,
    shouldVirtualizeChatList,
    chatListWindow,
    virtualChatRows,
    messageSizes,
    messageOffsets,
    bannersHeight,
    messageVerticalOffset,
    scrollToMessageById
  };
}
