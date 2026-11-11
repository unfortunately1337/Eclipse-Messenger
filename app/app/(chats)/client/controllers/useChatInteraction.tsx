"use client";

import { type UIEvent, useCallback, useEffect } from "react";

import { apiRequest } from "@/lib/client/http";

import { loadMutedChatIds, saveMutedChatIds } from "@/lib/client/realtime/notifications";

import { type ChatUiSettings } from "../../types";
import { DEFAULT_CHAT_UI_SETTINGS } from "../../constants";

import { loadReadMarkers, loadPinnedChatLinks, savePinnedChatLinks, saveReadMarkers, saveReadReceipts, loadReadReceipts, getChatUiSettingsKey } from "../chat-cache";

import { SCROLL_TO_BOTTOM_BUTTON_THRESHOLD, MESSAGE_HISTORY_LOAD_THRESHOLD, MAX_PINNED_CHATS } from "../config";

import { handleMessagesScrollAction, removeDirectChatLocallyAction } from "../chat-lifecycle";

import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatPageStateModel } from "./useChatPageState";

export interface ChatInteractionSources {
  elements: {
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "chatListTouchStartRef" | "loadOlderMessagesRef" | "messagesScrollRafRef">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "bottomScrollAnimationRef" | "programmaticScrollRef" | "userScrolledUpRef" | "messagesAtBottomRef" | "isScrollingToBottomRef" | "lastObservedMessagesScrollTopRef">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "userSentMessageRef">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "chatScrollRef" | "chatReadingPositionsRef" | "messagesViewportRef" | "videoViewerRef" | "messageLongPressTimerRef" | "messageLongPressStartRef" | "messageLongPressTriggeredRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "showScrollToBottomButton" | "setShowScrollToBottomButton" | "hasMoreMessagesBefore" | "loadingOlderMessages" | "lastCommittedMessagesScrollTopRef" | "setMessagesScrollTop">;

  };
  page: Pick<ChatPageStateModel, "router" | "showChatActionPanel" | "t" | "setErrorText"> & {
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "selectedLink" | "setSelectedLink">;
    account: Pick<ChatPageStateModel["account"], "activeUnreadCount" | "setActiveUnreadCount" | "selfProfile" | "selfId">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "setVideoViewerPlaying" | "videoViewerDuration" | "setVideoViewerCurrentTime" | "setVideoViewerProgress" | "setVideoViewerMuted" | "videoViewer" | "setVideoViewerDuration" | "setVideoViewerMenuOpen" | "setIsCoarsePointer">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "chatListLongPressTimerRef" | "chatListLongPressTriggeredRef">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "readMarkersRef" | "setReadMarkersVersion" | "setUnreadByLink" | "readReceiptsRef" | "setReadReceiptsVersion" | "setReadMessageIds">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "setMutedChatLinkSet" | "setPinnedChatLinkSet" | "setChatListHelper">;
    conversation: Pick<ChatPageStateModel["conversation"], "setChats" | "setActiveConversation" | "setMessages">;
    appearance: Pick<ChatPageStateModel["appearance"], "setChatUiSettings" | "chatUiSettings">;

  };
}

export interface ChatInteractionModel {
  handleChatListTouchEnd: () => void;
  interruptMessageAutoScroll: () => void;
  saveChatReadingPosition: (viewport: HTMLDivElement) => void;
  handleMessagesScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  clearMessageLongPress: () => void;
  clearChatListLongPress: () => void;
  toggleChatMutedState: (link: string) => void;
  toggleChatPinnedState: (link: string) => void;
  removeDirectChatLocally: (link: string) => void;
  deleteDirectChat: (link: string) => Promise<void>;
  setReadMarker: (link: string, isoTime: string) => void;
  setReadReceiptMarker: (link: string, isoTime: string) => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatInteraction(sources: ChatInteractionSources): ChatInteractionModel {
  const { chatListTouchStartRef, loadOlderMessagesRef, messagesScrollRafRef } = sources.elements.conversationRequest;
  const { bottomScrollAnimationRef, programmaticScrollRef, userScrolledUpRef, messagesAtBottomRef, isScrollingToBottomRef, lastObservedMessagesScrollTopRef } = sources.elements.conversationScroll;
  const { userSentMessageRef } = sources.elements.messageDelivery;
  const { chatScrollRef, chatReadingPositionsRef, messagesViewportRef, videoViewerRef, messageLongPressTimerRef, messageLongPressStartRef, messageLongPressTriggeredRef } = sources.elements.conversationElement;
  const { showScrollToBottomButton, setShowScrollToBottomButton, hasMoreMessagesBefore, loadingOlderMessages, lastCommittedMessagesScrollTopRef, setMessagesScrollTop } = sources.elements.storyAndViewport;
  const { router, showChatActionPanel, t, setErrorText } = sources.page;
  const { selectedLinkRef, selectedLink, setSelectedLink } = sources.page.selection;
  const { activeUnreadCount, setActiveUnreadCount, selfProfile, selfId } = sources.page.account;
  const { setVideoViewerPlaying, videoViewerDuration, setVideoViewerCurrentTime, setVideoViewerProgress, setVideoViewerMuted, videoViewer, setVideoViewerDuration, setVideoViewerMenuOpen, setIsCoarsePointer } = sources.page.mediaAndChannel;
  const { chatListLongPressTimerRef, chatListLongPressTriggeredRef } = sources.page.composerInteraction;
  const { readMarkersRef, setReadMarkersVersion, setUnreadByLink, readReceiptsRef, setReadReceiptsVersion, setReadMessageIds } = sources.page.messageInteraction;
  const { setMutedChatLinkSet, setPinnedChatLinkSet, setChatListHelper } = sources.page.notificationAndContacts;
  const { setChats, setActiveConversation, setMessages } = sources.page.conversation;
  const { setChatUiSettings, chatUiSettings } = sources.page.appearance;

  const handleChatListTouchEnd = useCallback(() => {
    chatListTouchStartRef.current = null;
  }, []);

  const interruptMessageAutoScroll = useCallback(() => {
    bottomScrollAnimationRef.current?.cancel();
    bottomScrollAnimationRef.current = null;
    programmaticScrollRef.current = false;
    userScrolledUpRef.current = true;
    messagesAtBottomRef.current = false;
    isScrollingToBottomRef.current = false;
    userSentMessageRef.current = false;
    if (chatScrollRef.current) chatScrollRef.current.initial = false;
  }, []);

  const saveChatReadingPosition = useCallback((viewport: HTMLDivElement) => {
    const chat = chatScrollRef.current;
    if (!chat || chat.initial || chat.link !== selectedLinkRef.current) return;
    const viewportTop = viewport.getBoundingClientRect().top;
    const row = Array.from(viewport.querySelectorAll<HTMLElement>("[data-message-id]")).find(node =>
      node.getBoundingClientRect().bottom > viewportTop + 1,
    );
    if (!row?.dataset.messageId || !row.dataset.messageDate) return;
    const positions = chatReadingPositionsRef.current;
    positions.delete(chat.key);
    positions.set(chat.key, {
      messageId: row.dataset.messageId,
      createdAt: row.dataset.messageDate,
      offset: row.getBoundingClientRect().top - viewportTop,
      top: viewport.scrollTop,
    });
    if (positions.size > 80) {
      const oldest = positions.keys().next().value;
      if (oldest) positions.delete(oldest);
    }
  }, []);

  const handleMessagesScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    return handleMessagesScrollAction({ lastObservedMessagesScrollTopRef, chatScrollRef, selectedLinkRef, programmaticScrollRef, userScrolledUpRef, chatReadingPositionsRef, isScrollingToBottomRef, messagesAtBottomRef, bottomScrollAnimationRef, activeUnreadCount, setActiveUnreadCount, showScrollToBottomButton, setShowScrollToBottomButton, hasMoreMessagesBefore, loadingOlderMessages, loadOlderMessagesRef, messagesScrollRafRef, messagesViewportRef, saveChatReadingPosition, lastCommittedMessagesScrollTopRef, setMessagesScrollTop }, event);
  }, [
    activeUnreadCount,
    showScrollToBottomButton,
    MESSAGE_HISTORY_LOAD_THRESHOLD,
    SCROLL_TO_BOTTOM_BUTTON_THRESHOLD,
    hasMoreMessagesBefore,
    loadingOlderMessages,
    saveChatReadingPosition,
  ]);

  const toggleVideoViewerPlay = useCallback(async () => {
    const video = videoViewerRef.current;
    if (!video) return;
    try {
      if (video.paused) {
        await video.play();
        setVideoViewerPlaying(true);
      } else {
        video.pause();
        setVideoViewerPlaying(false);
      }
    } catch {
      // ignore
    }
  }, []);

  const seekVideoViewer = useCallback((deltaSeconds: number) => {
    const video = videoViewerRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(video.duration || 0, video.currentTime + deltaSeconds));
    video.currentTime = next;
  }, []);

  const seekVideoViewerToPercent = useCallback((nextProgress: number) => {
    const video = videoViewerRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : videoViewerDuration;
    if (!duration || duration <= 0) return;
    const nextTime = Math.max(0, Math.min(duration, (nextProgress / 100) * duration));
    video.currentTime = nextTime;
    setVideoViewerCurrentTime(nextTime);
    setVideoViewerProgress(Math.min(100, Math.max(0, nextProgress)));
  }, [videoViewerDuration]);

  const toggleVideoViewerMuted = useCallback(() => {
    const video = videoViewerRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setVideoViewerMuted(nextMuted);
  }, []);

  const requestVideoViewerFullscreen = useCallback(() => {
    const video = videoViewerRef.current;
    const container = video?.parentElement;
    const target = container ?? video;
    if (!target || typeof target.requestFullscreen !== "function") return;
    void target.requestFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!videoViewer) return;
    const video = videoViewerRef.current;
    if (!video) return;
    setVideoViewerProgress(0);
    setVideoViewerDuration(0);
    setVideoViewerCurrentTime(0);
    setVideoViewerMenuOpen(false);
    const raf = requestAnimationFrame(() => {
      void video.play().then(() => setVideoViewerPlaying(true)).catch(() => undefined);
    });
    return () => cancelAnimationFrame(raf);
  }, [videoViewer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (selfProfile?.link) {
      router.prefetch(`/app/${encodeURIComponent(selfProfile.link)}`);
    }
  }, [router, selfProfile?.link]);

  const clearMessageLongPress = useCallback(() => {
    if (messageLongPressTimerRef.current) {
      window.clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
    messageLongPressStartRef.current = null;
    messageLongPressTriggeredRef.current = false;
  }, []);

  const clearChatListLongPress = useCallback(() => {
    if (chatListLongPressTimerRef.current) {
      window.clearTimeout(chatListLongPressTimerRef.current);
      chatListLongPressTimerRef.current = null;
    }
    chatListLongPressTriggeredRef.current = false;
  }, []);

  useEffect(() => {
    if (!selfId) return;
    readMarkersRef.current = loadReadMarkers(selfId);
    setReadMarkersVersion((prev) => prev + 1);
  }, [selfId]);

  useEffect(() => {
    if (!selfId) return;
    setMutedChatLinkSet(loadMutedChatIds(selfId));
  }, [selfId]);

  useEffect(() => {
    if (!selfId) return;
    setPinnedChatLinkSet(loadPinnedChatLinks(selfId));
  }, [selfId]);

  const toggleChatMutedState = useCallback((link: string) => {
    if (!link) return;
    setMutedChatLinkSet((prev) => {
      const next = new Set(prev);
      if (next.has(link)) {
        next.delete(link);
      } else {
        next.add(link);
      }
      if (selfId) {
        saveMutedChatIds(selfId, next);
      }
      return next;
    });
  }, [selfId]);

  const toggleChatPinnedState = useCallback((link: string) => {
    if (!link) return;
    setPinnedChatLinkSet((prev) => {
      if (!prev.has(link) && prev.size >= MAX_PINNED_CHATS) {
        showChatActionPanel({ icon: "error", message: t("Можно закрепить только {0} чата", { 0: MAX_PINNED_CHATS }) }, 3000);
        return prev;
      }
      const next = new Set(prev);
      if (next.has(link)) {
        next.delete(link);
      } else {
        next.add(link);
      }
      if (selfId) {
        savePinnedChatLinks(selfId, next);
      }
      return next;
    });
  }, [selfId, showChatActionPanel, t]);

  const removeDirectChatLocally = useCallback((link: string) => {
    return removeDirectChatLocallyAction({ setChats, setUnreadByLink, setMutedChatLinkSet, selfId, setPinnedChatLinkSet, setChatListHelper, readMarkersRef, setReadMarkersVersion, readReceiptsRef, setReadReceiptsVersion, selectedLink, setSelectedLink, setActiveConversation, setMessages, setReadMessageIds }, link);
  }, [selectedLink, selfId]);

  const deleteDirectChat = useCallback(async (link: string) => {
    if (!link) return;
    try {
      await apiRequest(`/api/chats/${encodeURIComponent(link)}?chatType=direct&scope=chat`, {
        method: "DELETE",
      });
      removeDirectChatLocally(link);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("Не удалось удалить чат"));
      throw error;
    }
  }, [removeDirectChatLocally, t]);

  const setReadMarker = useCallback((link: string, isoTime: string) => {
    if (!link || !isoTime) return;
    const next = { ...readMarkersRef.current, [link]: isoTime };
    readMarkersRef.current = next;
    if (selfId) {
      saveReadMarkers(selfId, next);
    }
    setReadMarkersVersion((prev) => prev + 1);
  }, [selfId]);

  useEffect(() => {
    if (!selfId) return;
    readReceiptsRef.current = loadReadReceipts(selfId);
    setReadReceiptsVersion((prev) => prev + 1);
  }, [selfId]);

  const setReadReceiptMarker = useCallback((link: string, isoTime: string) => {
    if (!link || !isoTime) return;
    const prev = readReceiptsRef.current[link];
    if (prev && Date.parse(prev) >= Date.parse(isoTime)) {
      return;
    }
    const next = { ...readReceiptsRef.current, [link]: isoTime };
    readReceiptsRef.current = next;
    if (selfId) {
      saveReadReceipts(selfId, next);
    }
    setReadReceiptsVersion((prevVersion) => prevVersion + 1);
  }, [selfId]);

  useEffect(() => {
    if (!selfId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getChatUiSettingsKey(selfId));
      if (!raw) {
        setChatUiSettings(DEFAULT_CHAT_UI_SETTINGS);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<ChatUiSettings>;
      setChatUiSettings({
        animateMessages:
          typeof parsed.animateMessages === "boolean"
            ? parsed.animateMessages
            : DEFAULT_CHAT_UI_SETTINGS.animateMessages,
        sendOnEnter:
          typeof parsed.sendOnEnter === "boolean"
            ? parsed.sendOnEnter
            : DEFAULT_CHAT_UI_SETTINGS.sendOnEnter,
        autoFollowLatest:
          typeof parsed.autoFollowLatest === "boolean"
            ? parsed.autoFollowLatest
            : DEFAULT_CHAT_UI_SETTINGS.autoFollowLatest,
      });
    } catch {
      setChatUiSettings(DEFAULT_CHAT_UI_SETTINGS);
    }
  }, [selfId]);

  useEffect(() => {
    if (!selfId || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(getChatUiSettingsKey(selfId), JSON.stringify(chatUiSettings));
    } catch {
      // ignore storage failures
    }
  }, [chatUiSettings, selfId]);

  return {
    handleChatListTouchEnd,
    interruptMessageAutoScroll,
    saveChatReadingPosition,
    handleMessagesScroll,
    clearMessageLongPress,
    clearChatListLongPress,
    toggleChatMutedState,
    toggleChatPinnedState,
    removeDirectChatLocally,
    deleteDirectChat,
    setReadMarker,
    setReadReceiptMarker
  };
}
