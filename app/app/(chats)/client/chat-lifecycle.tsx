"use client";
import type { GroupMember } from "../types";
import { watchPresenceExpiry } from "@/lib/client/presence-expiry";

import { type ProfilePreview, type ConversationResponse, type GroupModalData, type ChannelModalData, type ChatSummary, type SelfProfile, type StoryDraft, type ConversationChatType, type DecryptedMessage, type ChatImageGalleryItem, type EditTarget, type StoryFeedGroup, type ContactResponse } from "../types";
import { type CustomChatTheme } from "@/lib/client/custom-chat-theme";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { type ReadonlyURLSearchParams } from "next/dist/client/components/readonly-url-search-params";
import { createChatBottomScroll } from "@/lib/client/chat-bottom-scroll";
import { deleteSecretDeviceKeys } from "@/lib/client/secret-device-keys";
import { CSSProperties, UIEvent } from "react";
import { apiRequest } from "@/lib/client/http";
import { ECLIPSE_DIALOG_LINK } from "@/lib/eclipse-system";
import { saveMutedChatIds } from "@/lib/client/realtime/notifications";
import { LIVE_BACKGROUND_STORAGE_KEY, LIVE_BACKGROUND_UPDATED_EVENT, type LiveBackgroundNeatPreset, loadLiveBackgroundSettings } from "@/lib/client/live-background";
import { broadcastProfileUpdated } from "@/lib/client/local-updates";
import { clearEncryptedMedia } from "@/lib/client/media-crypto";
import { loadSharedChatKeys } from "@/lib/client/e2e";
import { mergeSecretChatSummaries } from "../chat-realtime-chatlist";
import { profileByIdInMemoryCache, savePinnedChatLinks, clearConversationCaches, removeChatFromListCaches, saveReadMarkers, saveReadReceipts, chatMemory, decryptedPayloadTextCache, decryptedPayloadFailureCache, readProfileDetailsMemoryCache, loadProfilePersistentCache, writeProfileDetailsMemoryCache, saveProfilePersistentCache, canDecryptSharedPayload, loadLatestSelfProfilePersistentCache, loadInitialStoryFeedSnapshot, loadInitialChatListSnapshot, normalizeCachedChatsForSelf } from "./chat-cache";
import { formatMessageDayLabel } from "./message-presentation";
import { isLikelyPublicLink } from "./message-links";
import { MOBILE_CHAT_HEADER_HIDE_DISTANCE, CHAT_LIST_SCROLL_STATE_STEP, CHAT_ITEM_ESTIMATED_HEIGHT, SCROLL_TO_BOTTOM_BUTTON_THRESHOLD, MESSAGE_HISTORY_LOAD_THRESHOLD, MESSAGE_SCROLL_STATE_STEP, GROUP_MODAL_CACHE_TTL_MS, CHANNEL_MODAL_CACHE_TTL_MS, SHARED_KEY_WARMUP_COOLDOWN_MS, CHAT_PREVIEW_SHARED_KEY_WARMUP_LIMIT } from "./config";
import { contactDisplayName } from "./profile-primitives";
import { parsedMessageCache } from "./message-content";
import { isSharedChat, resolveSharedChatIdFromSummary } from "./chat-previews";

export interface ObservePeerPresenceContext {
  selfId: string | null;
  profileData: ProfilePreview | null;
  roleModalMember: GroupMember | null;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  groupModalData: GroupModalData | null;
  channelModalData: ChannelModalData | null;
  chatsRef: React.RefObject<ChatSummary[]>;
  setPresenceNowTs: React.Dispatch<React.SetStateAction<number>>;
  setOnlineUserIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLastOfflineAtByUserId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export function observePeerPresence({ selfId, profileData, roleModalMember, activeConversationRef, groupModalData, channelModalData, chatsRef, setPresenceNowTs, setOnlineUserIds, setLastOfflineAtByUserId }: ObservePeerPresenceContext): (() => void) | undefined {
  if (!selfId) return;
  const controller = new AbortController();
  let pending = false;
  let requestedAgain = false;
  let queuedRefresh: number | undefined;
  let lastPollAt = 0;
  const expiryById = new Map<string, number>();
  let cancelExpiry = () => {};
  const requestRefresh = () => {
    if (controller.signal.aborted) return;
    if (pending) { requestedAgain = true; return; }
    if (queuedRefresh === undefined) queuedRefresh = window.setTimeout(() => { queuedRefresh = undefined; void refresh(); }, Math.max(250, 1200 - (Date.now() - lastPollAt)));
  };
  const refresh = async () => {
    if (pending || controller.signal.aborted || document.visibilityState === "hidden") return;
    if (Date.now() - lastPollAt < 1200) { requestRefresh(); return; }
    lastPollAt = Date.now();
    pending = true;
    const ids = new Set<string>([selfId]);
    if (profileData?.id) ids.add(profileData.id);
    if (roleModalMember?.id) ids.add(roleModalMember.id);
    if (activeConversationRef.current?.peer?.id) ids.add(activeConversationRef.current.peer.id);
    (groupModalData?.members ?? []).forEach(member => ids.add(member.id));
    (channelModalData?.subscribers ?? channelModalData?.members ?? []).forEach(member => ids.add(member.id));
    (activeConversationRef.current?.members ?? []).forEach(member => ids.add(member.id));
    chatsRef.current.forEach(chat => { if (chat.peerId) ids.add(chat.peerId); });
    profileByIdInMemoryCache.forEach((_, id) => ids.add(id));
    try {
      const startedAt = Date.now();
      const data = await apiRequest<{ onlineUserIds: string[]; onlineExpiresInMsByUserId: Record<string, number>; lastSeenAtByUserId: Record<string, number>; hiddenLastSeenUserIds: string[] }>("/api/realtime/presence", {
        method: "POST", body: JSON.stringify({ userIds: [...ids].slice(0, 200) }), signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      expiryById.clear();
      data.onlineUserIds.forEach(id => {
        const remaining = data.onlineExpiresInMsByUserId?.[id];
        if (remaining > 0 && remaining <= 30_000) expiryById.set(id, startedAt + remaining);
      });
      const next = new Set([...expiryById].filter(([, expiry]) => expiry > Date.now()).map(([id]) => id));
      cancelExpiry();
      cancelExpiry = watchPresenceExpiry(expiryById, expired => {
        setOnlineUserIds(current => {
          if (!expired.some(id => current.has(id))) return current;
          const next = new Set(current);
          expired.forEach(id => next.delete(id));
          return next;
        });
      });
      setPresenceNowTs(Date.now());
      setOnlineUserIds(current => current.size === next.size && [...next].every(id => current.has(id)) ? current : next);
      setLastOfflineAtByUserId(current => {
        const copy = { ...current };
        [...ids].slice(0, 200).forEach(id => { delete copy[id]; });
        Object.assign(copy, data.lastSeenAtByUserId ?? {});
        (data.hiddenLastSeenUserIds ?? []).forEach(id => { copy[id] = -1; });
        return Object.keys(current).length === Object.keys(copy).length && Object.keys(copy).every(id => current[id] === copy[id]) ? current : copy;
      });
    } catch {
      if (!controller.signal.aborted) setOnlineUserIds(new Set());
    } finally {
      pending = false;
      if (requestedAgain) { requestedAgain = false; requestRefresh(); }
    }
  };
  void refresh();
  const timer = window.setInterval(refresh, 15_000);
  window.addEventListener("eclipse:presence-refresh", requestRefresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  return () => { controller.abort(); cancelExpiry(); window.clearTimeout(queuedRefresh); window.clearInterval(timer); window.removeEventListener("eclipse:presence-refresh", requestRefresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
}

export interface ObserveChatAppearanceContext {
  setLiveBackgroundPreset: React.Dispatch<React.SetStateAction<LiveBackgroundNeatPreset>>;
  setLiveBackgroundOpacity: React.Dispatch<React.SetStateAction<number>>;
  setLiveBackgroundMotionSpeed: React.Dispatch<React.SetStateAction<number>>;
  setMessageThemeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setTransparentVisual: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomTheme: React.Dispatch<React.SetStateAction<CustomChatTheme | null | undefined>>;
  setCustomThemeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

export function observeChatAppearance({ setLiveBackgroundPreset, setLiveBackgroundOpacity, setLiveBackgroundMotionSpeed, setMessageThemeEnabled, setTransparentVisual, setCustomTheme, setCustomThemeEnabled }: ObserveChatAppearanceContext): () => void {
  function syncLivePreset() {
    const nextSettings = loadLiveBackgroundSettings();
    setLiveBackgroundPreset(nextSettings.neatPreset);
    setLiveBackgroundOpacity(nextSettings.opacity);
    setLiveBackgroundMotionSpeed(nextSettings.motionSpeed);
    setMessageThemeEnabled(nextSettings.messageThemeEnabled);
    setTransparentVisual(nextSettings.transparentVisual ?? true);
    setCustomTheme(nextSettings.customTheme ?? null);
    setCustomThemeEnabled(Boolean(nextSettings.customThemeEnabled));
  }

  syncLivePreset();

  function onStorage(event: StorageEvent) {
    if (event.key && event.key !== LIVE_BACKGROUND_STORAGE_KEY) return;
    syncLivePreset();
  }

  function onLiveUpdated() {
    syncLivePreset();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(LIVE_BACKGROUND_UPDATED_EVENT, onLiveUpdated);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LIVE_BACKGROUND_UPDATED_EVENT, onLiveUpdated);
  };
}

export interface RenderCommunityBannersViewContext {
  activeConversation: ConversationResponse | null;
  selfId: string | null;
  selfProfile: SelfProfile | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  dateSeparatorThemeStyle: React.CSSProperties;
}

export function renderCommunityBannersView({ activeConversation, selfId, selfProfile, t, dateSeparatorThemeStyle }: RenderCommunityBannersViewContext): React.JSX.Element | null {
  if (!activeConversation) return null;
  const isChannel = activeConversation.chatType === "channel";
  const isGroup = activeConversation.chatType === "group";
  if (!isChannel && !isGroup) return null;

  const selfIdStr = selfId ?? selfProfile?.id ?? "";

  if (isGroup && activeConversation.group) {
    const group = activeConversation.group;
    const isOwner = group.ownerId === selfIdStr;
    const rawDate = isOwner ? group.createdAt : (group.myJoinedAt || group.createdAt);
    const dateLabel = rawDate ? formatMessageDayLabel(rawDate) : "";
    const actionText = isOwner ? t("Вы создали группу") : t("Вас добавили в группу");

    return (
      <div className="flex flex-col items-center gap-2.5 pt-2 pb-5 select-none">
        {dateLabel && (
          <div className="flex justify-center">
            <span className="chat-service-pill" style={dateSeparatorThemeStyle}>
              {dateLabel}
            </span>
          </div>
        )}
        <div className="flex justify-center">
          <span className="chat-service-pill" style={dateSeparatorThemeStyle}>
            {actionText}
          </span>
        </div>
      </div>
    );
  }

  if (isChannel && activeConversation.channel) {
    const channel = activeConversation.channel;
    const isOwner = channel.ownerId === selfIdStr;
    const rawDate = isOwner ? channel.createdAt : (channel.myJoinedAt || channel.createdAt);
    const dateLabel = rawDate ? formatMessageDayLabel(rawDate) : "";
    const actionText = isOwner
      ? t("Вы создали канал")
      : isLikelyPublicLink(channel.link)
        ? t("Вы подписались на канал")
        : t("Вас добавили в канал");

    return (
      <div className="flex flex-col items-center gap-2.5 pt-2 pb-5 select-none">
        {dateLabel && (
          <div className="flex justify-center">
            <span className="chat-service-pill" style={dateSeparatorThemeStyle}>
              {dateLabel}
            </span>
          </div>
        )}
        <div className="flex justify-center">
          <span className="chat-service-pill" style={dateSeparatorThemeStyle}>
            {actionText}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export interface ScrollMessagesToBottomActionContext {
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  userScrolledUpRef: React.RefObject<boolean>;
  userSentMessageRef: React.RefObject<boolean>;
  bottomScrollAnimationRef: React.RefObject<{ viewport: HTMLElement; cancel(): void; } | null>;
  isScrollingToBottomRef: React.RefObject<boolean>;
  programmaticScrollRef: React.RefObject<boolean>;
  messagesAtBottomRef: React.RefObject<boolean>;
  lastObservedMessagesScrollTopRef: React.RefObject<number>;
  lastCommittedMessagesScrollTopRef: React.RefObject<number>;
  setMessagesScrollTop: React.Dispatch<React.SetStateAction<number>>;
}

export function scrollMessagesToBottomAction({ messagesViewportRef, userScrolledUpRef, userSentMessageRef, bottomScrollAnimationRef, isScrollingToBottomRef, programmaticScrollRef, messagesAtBottomRef, lastObservedMessagesScrollTopRef, lastCommittedMessagesScrollTopRef, setMessagesScrollTop }: ScrollMessagesToBottomActionContext, behavior: ScrollBehavior = "auto"): void {
  const viewport = messagesViewportRef.current;
  if (!viewport || (userScrolledUpRef.current && !userSentMessageRef.current)) return;
  if (userSentMessageRef.current) userScrolledUpRef.current = false;
  const running = bottomScrollAnimationRef.current;
  if (running?.viewport === viewport) return;
  running?.cancel();
  bottomScrollAnimationRef.current = null;
  const complete = () => {
    bottomScrollAnimationRef.current = null;
    isScrollingToBottomRef.current = false;
    programmaticScrollRef.current = false;
    messagesAtBottomRef.current = !userScrolledUpRef.current;
    lastObservedMessagesScrollTopRef.current = viewport.scrollTop;
    lastCommittedMessagesScrollTopRef.current = viewport.scrollTop;
    setMessagesScrollTop(viewport.scrollTop);
  };
  if (behavior === "smooth" && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1) {
    isScrollingToBottomRef.current = true;
    programmaticScrollRef.current = true;
    messagesAtBottomRef.current = true;
    bottomScrollAnimationRef.current = createChatBottomScroll(viewport, complete);
  } else {
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    complete();
  }
}

export interface ObserveStoryKeyboardContext {
  storyDraft: StoryDraft | null;
  setStoryDraftKeyboardInset: React.Dispatch<React.SetStateAction<number>>;
}

export function observeStoryKeyboard({ storyDraft, setStoryDraftKeyboardInset }: ObserveStoryKeyboardContext): (() => void) | undefined {
  if (!storyDraft) {
    setStoryDraftKeyboardInset(0);
    return;
  }

  const preventPinch = (event: Event) => {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 1) {
      event.preventDefault();
    }
  };
  const preventGesture = (event: Event) => {
    event.preventDefault();
  };
  const preventCtrlZoom = (event: WheelEvent) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  };

  const previousOverscroll = document.body.style.overscrollBehavior;
  const previousTouchAction = document.body.style.touchAction;
  const previousOverflow = document.body.style.overflow;
  const previousHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overscrollBehavior = "none";
  document.body.style.touchAction = "none";
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  const syncStoryDraftViewport = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      setStoryDraftKeyboardInset(0);
      return;
    }
    const keyboardInset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    setStoryDraftKeyboardInset(keyboardInset > 60 ? keyboardInset : 0);
  };

  syncStoryDraftViewport();
  document.addEventListener("touchmove", preventPinch, { passive: false });
  document.addEventListener("gesturestart", preventGesture, { passive: false } as AddEventListenerOptions);
  document.addEventListener("gesturechange", preventGesture, { passive: false } as AddEventListenerOptions);
  document.addEventListener("gestureend", preventGesture, { passive: false } as AddEventListenerOptions);
  document.addEventListener("wheel", preventCtrlZoom, { passive: false });
  window.visualViewport?.addEventListener("resize", syncStoryDraftViewport);
  window.visualViewport?.addEventListener("scroll", syncStoryDraftViewport);

  return () => {
    document.body.style.overscrollBehavior = previousOverscroll;
    document.body.style.touchAction = previousTouchAction;
    document.body.style.overflow = previousOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.removeEventListener("touchmove", preventPinch);
    document.removeEventListener("gesturestart", preventGesture as EventListener);
    document.removeEventListener("gesturechange", preventGesture as EventListener);
    document.removeEventListener("gestureend", preventGesture as EventListener);
    document.removeEventListener("wheel", preventCtrlZoom as EventListener);
    window.visualViewport?.removeEventListener("resize", syncStoryDraftViewport);
    window.visualViewport?.removeEventListener("scroll", syncStoryDraftViewport);
    setStoryDraftKeyboardInset(0);
  };
}

export interface ObserveMobileChatViewportContext {
  isDesktop: boolean;
  selectedLink: string | null;
  setMobileChatViewportHeight: React.Dispatch<React.SetStateAction<number | null>>;
  messagesAtBottomRef: React.RefObject<boolean>;
  scrollMessagesToBottom: (behavior?: ScrollBehavior) => void;
}

export function observeMobileChatViewport({ isDesktop, selectedLink, setMobileChatViewportHeight, messagesAtBottomRef, scrollMessagesToBottom }: ObserveMobileChatViewportContext): (() => void) | undefined {
  if (isDesktop || !selectedLink) {
    setMobileChatViewportHeight(null);
    return;
  }

  const syncMobileChatViewport = () => {
    if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0 || (document.body && document.body.scrollTop !== 0)) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
    const viewport = window.visualViewport;
    if (!viewport) {
      setMobileChatViewportHeight(window.innerHeight);
      return;
    }
    setMobileChatViewportHeight(Math.max(0, Math.round(viewport.height + viewport.offsetTop)));
    if (messagesAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollMessagesToBottom("auto");
      });
    }
  };

  syncMobileChatViewport();
  window.visualViewport?.addEventListener("resize", syncMobileChatViewport);
  window.visualViewport?.addEventListener("scroll", syncMobileChatViewport);
  window.addEventListener("orientationchange", syncMobileChatViewport);

  return () => {
    window.visualViewport?.removeEventListener("resize", syncMobileChatViewport);
    window.visualViewport?.removeEventListener("scroll", syncMobileChatViewport);
    window.removeEventListener("orientationchange", syncMobileChatViewport);
    setMobileChatViewportHeight(null);
  };
}

export interface HandleChatListScrollActionContext {
  lastChatListScrollTopRef: React.RefObject<number>;
  pendingChatListScrollTopRef: React.RefObject<number>;
  isDesktop: boolean;
  lastChatListScrollIntentRef: React.RefObject<{ dir: 1 | -1; at: number; } | null>;
  mobileHeaderOffsetRef: React.RefObject<number>;
  pendingMobileHeaderOffsetRef: React.RefObject<number>;
  storiesHiddenRef: React.RefObject<boolean>;
  setStoriesHidden: React.Dispatch<React.SetStateAction<boolean>>;
  chatListScrollRafRef: React.RefObject<number | null>;
  lastCommittedChatListScrollTopRef: React.RefObject<number>;
  setChatListScrollTop: React.Dispatch<React.SetStateAction<number>>;
}

export function handleChatListScrollAction({ lastChatListScrollTopRef, pendingChatListScrollTopRef, isDesktop, lastChatListScrollIntentRef, mobileHeaderOffsetRef, pendingMobileHeaderOffsetRef, storiesHiddenRef, setStoriesHidden, chatListScrollRafRef, lastCommittedChatListScrollTopRef, setChatListScrollTop }: HandleChatListScrollActionContext, event: UIEvent<HTMLDivElement>): void {
  const viewport = event.currentTarget;
  const nextTop = Math.max(0, viewport.scrollTop);
  const prevTop = lastChatListScrollTopRef.current;
  lastChatListScrollTopRef.current = nextTop;
  pendingChatListScrollTopRef.current = nextTop;

  const delta = nextTop - prevTop;
  if (!isDesktop) {
    const intent = lastChatListScrollIntentRef.current;
    const intentFresh = intent ? Date.now() - intent.at < 350 : false;
    const intentDir = intentFresh ? intent?.dir ?? 0 : 0;
    let nextOffset = mobileHeaderOffsetRef.current + delta;
    if (nextTop <= 2) {
      nextOffset = 0;
    }
    nextOffset = Math.min(MOBILE_CHAT_HEADER_HIDE_DISTANCE, Math.max(0, nextOffset));
    mobileHeaderOffsetRef.current = nextOffset;
    pendingMobileHeaderOffsetRef.current = nextOffset;

    if ((delta > 0 || intentDir > 0) && !storiesHiddenRef.current) {
      storiesHiddenRef.current = true;
      setStoriesHidden(true);
    }
  } else if (delta > 0 && !storiesHiddenRef.current) {
    storiesHiddenRef.current = true;
    setStoriesHidden(true);
  }

  if (chatListScrollRafRef.current !== null) {
    return;
  }
  chatListScrollRafRef.current = window.requestAnimationFrame(() => {
    chatListScrollRafRef.current = null;
    const committedTop = lastCommittedChatListScrollTopRef.current;
    const nextCommittedTop = pendingChatListScrollTopRef.current;
    const shouldCommitChatTop =
      Math.abs(nextCommittedTop - committedTop) >= CHAT_LIST_SCROLL_STATE_STEP ||
      nextCommittedTop <= 4 ||
      viewport.scrollHeight - (nextCommittedTop + viewport.clientHeight) <= CHAT_ITEM_ESTIMATED_HEIGHT;
    if (shouldCommitChatTop) {
      lastCommittedChatListScrollTopRef.current = nextCommittedTop;
      setChatListScrollTop(nextCommittedTop);
    }
  });
}

export interface HandleMessagesScrollActionContext {
  lastObservedMessagesScrollTopRef: React.RefObject<number>;
  chatScrollRef: React.RefObject<{ key: string; link: string; initial: boolean; lastMessageId?: string | undefined; requestedBefore?: string | undefined; } | null>;
  selectedLinkRef: React.RefObject<string | null>;
  programmaticScrollRef: React.RefObject<boolean>;
  userScrolledUpRef: React.RefObject<boolean>;
  chatReadingPositionsRef: React.RefObject<Map<string, { messageId: string; offset: number; top: number; createdAt: string; }>>;
  isScrollingToBottomRef: React.RefObject<boolean>;
  messagesAtBottomRef: React.RefObject<boolean>;
  bottomScrollAnimationRef: React.RefObject<{ viewport: HTMLElement; cancel(): void; } | null>;
  activeUnreadCount: number;
  setActiveUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  showScrollToBottomButton: boolean;
  setShowScrollToBottomButton: React.Dispatch<React.SetStateAction<boolean>>;
  hasMoreMessagesBefore: boolean;
  loadingOlderMessages: boolean;
  loadOlderMessagesRef: React.RefObject<(() => Promise<void>) | null>;
  messagesScrollRafRef: React.RefObject<number | null>;
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  saveChatReadingPosition: (viewport: HTMLDivElement) => void;
  lastCommittedMessagesScrollTopRef: React.RefObject<number>;
  setMessagesScrollTop: React.Dispatch<React.SetStateAction<number>>;
}

export function handleMessagesScrollAction({ lastObservedMessagesScrollTopRef, chatScrollRef, selectedLinkRef, programmaticScrollRef, userScrolledUpRef, chatReadingPositionsRef, isScrollingToBottomRef, messagesAtBottomRef, bottomScrollAnimationRef, activeUnreadCount, setActiveUnreadCount, showScrollToBottomButton, setShowScrollToBottomButton, hasMoreMessagesBefore, loadingOlderMessages, loadOlderMessagesRef, messagesScrollRafRef, messagesViewportRef, saveChatReadingPosition, lastCommittedMessagesScrollTopRef, setMessagesScrollTop }: HandleMessagesScrollActionContext, event: UIEvent<HTMLDivElement>): void {
  const viewport = event.currentTarget;
  const nextTop = viewport.scrollTop;
  const distanceToBottom = viewport.scrollHeight - (nextTop + viewport.clientHeight);
  const previousTop = lastObservedMessagesScrollTopRef.current;
  const chat = chatScrollRef.current;
  if (!chat || chat.link !== selectedLinkRef.current) return;
  if (!programmaticScrollRef.current && !chat.initial && userScrolledUpRef.current && nextTop > previousTop && distanceToBottom <= 1) {
    userScrolledUpRef.current = false;
    chatReadingPositionsRef.current.delete(chat.key);
  }
  lastObservedMessagesScrollTopRef.current = nextTop;
  if (isScrollingToBottomRef.current) {
    messagesAtBottomRef.current = true;
    if (distanceToBottom <= 1 && !bottomScrollAnimationRef.current) {
      isScrollingToBottomRef.current = false;
    }
  } else {
    messagesAtBottomRef.current = !userScrolledUpRef.current;
  }
  if (messagesAtBottomRef.current && activeUnreadCount !== 0) {
    setActiveUnreadCount(0);
  }
  const shouldShowScrollButton = userScrolledUpRef.current && distanceToBottom > SCROLL_TO_BOTTOM_BUTTON_THRESHOLD && !isScrollingToBottomRef.current;
  if (shouldShowScrollButton !== showScrollToBottomButton) setShowScrollToBottomButton(shouldShowScrollButton);
  if (userScrolledUpRef.current && !chat.initial && !programmaticScrollRef.current && nextTop <= MESSAGE_HISTORY_LOAD_THRESHOLD && hasMoreMessagesBefore && !loadingOlderMessages) {
    void loadOlderMessagesRef.current?.();
  }
  if (messagesScrollRafRef.current !== null) {
    return;
  }
  messagesScrollRafRef.current = window.requestAnimationFrame(() => {
    messagesScrollRafRef.current = null;
    if (chatScrollRef.current !== chat || messagesViewportRef.current !== viewport) return;
    const nextTop = viewport.scrollTop;
    if (userScrolledUpRef.current && !programmaticScrollRef.current && nextTop !== previousTop) saveChatReadingPosition(viewport);
    const committedTop = lastCommittedMessagesScrollTopRef.current;
    const shouldCommitMessagesTop =
      Math.abs(nextTop - committedTop) >= (bottomScrollAnimationRef.current ? 240 : MESSAGE_SCROLL_STATE_STEP) ||
      (nextTop !== committedTop && (nextTop <= 0 || distanceToBottom <= 0));
    if (shouldCommitMessagesTop) {
      lastCommittedMessagesScrollTopRef.current = nextTop;
      setMessagesScrollTop(nextTop);
    }
  });
}

export interface RemoveDirectChatLocallyActionContext {
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setUnreadByLink: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setMutedChatLinkSet: React.Dispatch<React.SetStateAction<Set<string>>>;
  selfId: string | null;
  setPinnedChatLinkSet: React.Dispatch<React.SetStateAction<Set<string>>>;
  setChatListHelper: React.Dispatch<React.SetStateAction<{ link: string; chatType: ConversationChatType; dangerAction: "leave" | "delete" | null; displayName: string; x: number; y: number; touch: boolean; anchorRect?: { left: number; top: number; width: number; height: number; } | null | undefined; } | null>>;
  readMarkersRef: React.RefObject<Record<string, string>>;
  setReadMarkersVersion: React.Dispatch<React.SetStateAction<number>>;
  readReceiptsRef: React.RefObject<Record<string, string>>;
  setReadReceiptsVersion: React.Dispatch<React.SetStateAction<number>>;
  selectedLink: string | null;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setReadMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function removeDirectChatLocallyAction({ setChats, setUnreadByLink, setMutedChatLinkSet, selfId, setPinnedChatLinkSet, setChatListHelper, readMarkersRef, setReadMarkersVersion, readReceiptsRef, setReadReceiptsVersion, selectedLink, setSelectedLink, setActiveConversation, setMessages, setReadMessageIds }: RemoveDirectChatLocallyActionContext, link: string): void {
  if (!link) return;
  setChats((prev) => prev.filter((chat) => !(chat.chatType === "direct" && chat.link === link)));
  setUnreadByLink((prev) => {
    if (!(link in prev)) return prev;
    const next = { ...prev };
    delete next[link];
    return next;
  });
  setMutedChatLinkSet((prev) => {
    if (!prev.has(link)) return prev;
    const next = new Set(prev);
    next.delete(link);
    if (selfId) {
      saveMutedChatIds(selfId, next);
    }
    return next;
  });
  setPinnedChatLinkSet((prev) => {
    if (!prev.has(link)) return prev;
    const next = new Set(prev);
    next.delete(link);
    if (selfId) {
      savePinnedChatLinks(selfId, next);
    }
    return next;
  });
  setChatListHelper((current) => (current?.chatType === "direct" && current.link === link ? null : current));
  clearConversationCaches(selfId ?? null, link, "direct");
  removeChatFromListCaches(selfId ?? null, link, "direct");
  if (readMarkersRef.current[link]) {
    const nextReadMarkers = { ...readMarkersRef.current };
    delete nextReadMarkers[link];
    readMarkersRef.current = nextReadMarkers;
    if (selfId) {
      saveReadMarkers(selfId, nextReadMarkers);
    }
    setReadMarkersVersion((prev) => prev + 1);
  }
  if (readReceiptsRef.current[link]) {
    const nextReadReceipts = { ...readReceiptsRef.current };
    delete nextReadReceipts[link];
    readReceiptsRef.current = nextReadReceipts;
    if (selfId) {
      saveReadReceipts(selfId, nextReadReceipts);
    }
    setReadReceiptsVersion((prev) => prev + 1);
  }
  if (selectedLink === link) {
    setSelectedLink(null);
    setActiveConversation(null);
    setMessages([]);
    setReadMessageIds(new Set());
  }
}

export interface ActiveChatActionContext {
  selectedChat: ChatSummary | null;
  profileData: ProfilePreview | null;
  activeConversation: ConversationResponse | null;
  selectedLink: string | null;
  selfId: string | null;
  requestedChatType: "direct" | "group" | "channel" | "saved" | "eclipse" | null;
}

export function activeChatAction({ selectedChat, profileData, activeConversation, selectedLink, selfId, requestedChatType }: ActiveChatActionContext): ChatSummary | null {
  if (selectedChat) {
    let merged = selectedChat;
    if (profileData && (profileData.link === selectedChat.link || (profileData.id && profileData.id === selectedChat.peerId))) {
      if (profileData.avatarUrl !== undefined && profileData.avatarUrl !== merged.avatarUrl) {
        merged = { ...merged, avatarUrl: profileData.avatarUrl ?? null };
      }
      if (profileData.displayName && profileData.displayName !== merged.displayName) {
        merged = { ...merged, displayName: contactDisplayName(merged, profileData.displayName) };
      }
    } else if (activeConversation?.peer && (activeConversation.peer.link === selectedChat.link || (activeConversation.peer.id && activeConversation.peer.id === selectedChat.peerId))) {
      if (activeConversation.peer.avatarUrl !== undefined && activeConversation.peer.avatarUrl !== merged.avatarUrl) {
        merged = { ...merged, avatarUrl: activeConversation.peer.avatarUrl ?? null };
      }
      if (activeConversation.peer.displayName && activeConversation.peer.displayName !== merged.displayName) {
        merged = { ...merged, displayName: contactDisplayName(merged, activeConversation.peer.displayName) };
      }
    }
    return merged;
  }
  if (!selectedLink || !activeConversation) return null;
  if (activeConversation.chatType === "group" && activeConversation.group) {
    return {
      chatType: "group" as const,
      conversationId: activeConversation.conversationId ?? `group:${activeConversation.group.id}`,
      peerId: activeConversation.group.id,
      link: activeConversation.group.link,
      displayName: activeConversation.group.name,
      avatarUrl: activeConversation.group.avatarUrl ?? null,
      lastMessage: "",
      lastMessageAt: new Date().toISOString(),
      lastMessageMine: false,
      isGroupOwner: activeConversation.group.ownerId === selfId,
    };
  }
  if (activeConversation.chatType === "channel" && activeConversation.channel) {
    const isOwner = Boolean(
      (selfId && activeConversation.channel.ownerId === selfId) ||
      activeConversation.channel.isOwner ||
      activeConversation.channel.myRole === "owner"
    );
    return {
      chatType: "channel" as const,
      conversationId: activeConversation.conversationId ?? `channel:${activeConversation.channel.id}`,
      peerId: activeConversation.channel.id,
      link: activeConversation.channel.link,
      displayName: activeConversation.channel.name,
      avatarUrl: activeConversation.channel.avatarUrl ?? null,
      lastMessage: "",
      lastMessageAt: new Date().toISOString(),
      lastMessageMine: isOwner,
      isChannelOwner: isOwner,
      ownerId: activeConversation.channel.ownerId,
      isGroupOwner: false,
    };
  }
  if (activeConversation?.peer) {
    const isSecret = Boolean(selectedLink?.startsWith("secret-"));
    return {
      chatType: "direct" as const,
      conversationId: activeConversation.conversationId ?? `temp:${activeConversation.peer.id}`,
      peerId: activeConversation.peer.id,
      isBot: activeConversation.peer.isBot,
      link: isSecret && selectedLink ? selectedLink : activeConversation.peer.link,
      displayName: activeConversation.peer.displayName,
      contactAlias: activeConversation.peer.contactAlias ?? null,
      avatarUrl: activeConversation.peer.avatarUrl ?? null,
      lastMessage: "",
      lastMessageAt: new Date().toISOString(),
      lastMessageMine: false,
    };
  }
  return {
    chatType: (requestedChatType ?? "direct") as any,
    conversationId: `temp:${selectedLink}`,
    peerId: "",
    link: selectedLink,
    displayName: profileData?.displayName || selectedLink,
    avatarUrl: profileData?.avatarUrl ?? null,
    lastMessage: "",
    lastMessageAt: new Date().toISOString(),
    lastMessageMine: false,
    isTemporary: true,
  };
}

export interface HandleSecretChatExpiredActionContext {
  activeChat: ChatSummary | null;
  selfId: string | null;
  conversationRequestSeqRef: React.RefObject<number>;
  setLoadingConversation: React.Dispatch<React.SetStateAction<boolean>>;
  setDecryptingConversation: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setImageViewer: React.Dispatch<React.SetStateAction<ChatImageGalleryItem | null>>;
  setVideoViewer: React.Dispatch<React.SetStateAction<{ src: string; caption: string; timeText: string; dateText: string; messageId: string; authorName: string; authorAvatarUrl?: string | null | undefined; authorLink?: string | null | undefined; canDelete: boolean; isMine?: boolean | undefined; } | null>>;
  setEditTarget: React.Dispatch<React.SetStateAction<EditTarget | null>>;
  setReplyToMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  setExpiringChatId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedLinkRef: React.RefObject<string | null>;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  setReadMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
}

export function handleSecretChatExpiredAction({ activeChat, selfId, conversationRequestSeqRef, setLoadingConversation, setDecryptingConversation, setMessages, setImageViewer, setVideoViewer, setEditTarget, setReplyToMessageId, setMessageText, setExpiringChatId, selectedLinkRef, activeConversationRef, setSelectedLink, setActiveConversation, setReadMessageIds, setChats }: HandleSecretChatExpiredActionContext, expiredChatId?: string): void {
  let targetSecretChatId = expiredChatId || null;
  if (!targetSecretChatId && activeChat?.conversationId?.startsWith("secret:")) {
    targetSecretChatId = activeChat.conversationId.substring("secret:".length);
  }
  if (!targetSecretChatId) return;
  if (selfId) void deleteSecretDeviceKeys(selfId, targetSecretChatId).catch(() => { });
  chatMemory.chatCacheGeneration += 1;
  clearEncryptedMedia(`secret:${targetSecretChatId}`);
  clearConversationCaches(selfId, `secret-${targetSecretChatId}`, "direct");
  try { localStorage.removeItem(`secret_codeword_${targetSecretChatId}`); } catch { }
  parsedMessageCache.clear();
  decryptedPayloadTextCache.clear();
  decryptedPayloadFailureCache.clear();

  const isCurrentActive = activeChat?.conversationId === `secret:${targetSecretChatId}`;
  if (isCurrentActive) {
    conversationRequestSeqRef.current += 1;
    setLoadingConversation(false);
    setDecryptingConversation(false);
    setMessages([]);
    setImageViewer(null);
    setVideoViewer(null);
    setEditTarget(null);
    setReplyToMessageId(null);
    setMessageText("");
    setExpiringChatId(targetSecretChatId);
    setTimeout(() => {
      if (selectedLinkRef.current !== `secret-${targetSecretChatId}` &&
        activeConversationRef.current?.conversationId !== `secret:${targetSecretChatId}`) {
        setExpiringChatId((current) => current === targetSecretChatId ? null : current);
        return;
      }
      setSelectedLink(null);
      setActiveConversation(null);
      setMessages([]);
      setReadMessageIds(new Set());
      setExpiringChatId(null);
    }, 450);
  }

  setTimeout(() => {
    setChats((prev) => prev.filter((chat) => {
      const isMatch =
        chat.conversationId === `secret:${targetSecretChatId}` ||
        chat.link === `secret-${targetSecretChatId}`;
      return !isMatch;
    }));
  }, 300);
}

export interface RefreshActiveChatDetailsContext {
  activeChat: ChatSummary | null;
  activeConversation: ConversationResponse | null;
  router: AppRouterInstance;
  selfId: string | null;
  setProfileData: React.Dispatch<React.SetStateAction<ProfilePreview | null>>;
  setContactEditorTarget: React.Dispatch<React.SetStateAction<{ link: string; displayName: string; avatarUrl?: string | null | undefined; } | null>>;
  setContactExists: React.Dispatch<React.SetStateAction<boolean>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  profileDetailsInFlightRef: React.RefObject<Set<string>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
  groupModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: GroupModalData; }>>;
  groupDetailsInFlightRef: React.RefObject<Set<string>>;
  channelModalCacheRef: React.RefObject<Map<string, { savedAt: number; data: ChannelModalData; }>>;
  channelDetailsInFlightRef: React.RefObject<Set<string>>;
}

export function refreshActiveChatDetails({ activeChat, activeConversation, router, selfId, setProfileData, setContactEditorTarget, setContactExists, setChats, profileDetailsInFlightRef, setActiveConversation, groupModalCacheRef, groupDetailsInFlightRef, channelModalCacheRef, channelDetailsInFlightRef }: RefreshActiveChatDetailsContext): void {
  if (!activeChat?.link) return;
  const targetLink = activeChat.link.startsWith("secret-")
    ? (activeConversation?.peer?.link || (activeChat as any)?.peer?.link || null)
    : activeChat.link;
  if (!targetLink) return;
  if (activeChat.chatType === "direct") {
    router.prefetch(`/app/${encodeURIComponent(targetLink)}`);
    const cachedProfile = selfId
      ? readProfileDetailsMemoryCache(selfId, targetLink) ?? loadProfilePersistentCache(selfId, targetLink)
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
              contactAlias: cachedProfile.contact.contact?.alias ?? c.contactAlias,
              avatarUrl: cachedProfile.profile.avatarUrl !== undefined ? cachedProfile.profile.avatarUrl : c.avatarUrl,
            }
            : c
        )
      );
    }
    if (isFreshProfile || profileDetailsInFlightRef.current.has(targetLink)) {
      return;
    }
    profileDetailsInFlightRef.current.add(targetLink);
    void Promise.all([
      apiRequest<ProfilePreview>(`/api/profile/${encodeURIComponent(targetLink)}`, { method: "GET" }),
      apiRequest<ContactResponse>(`/api/contacts/${encodeURIComponent(targetLink)}`, { method: "GET" }),
    ])
      .then(([profile, contact]) => {
        const snapshot = { savedAt: Date.now(), profile, contact };
        writeProfileDetailsMemoryCache(selfId, targetLink, snapshot);
        if (selfId) {
          saveProfilePersistentCache(selfId, targetLink, snapshot);
        }
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
      })
      .catch(() => undefined)
      .finally(() => {
        profileDetailsInFlightRef.current.delete(targetLink);
      });
    return;
  }
  if (activeChat.chatType === "group") {
    // Secret chats have chatType "group" but are not real groups — skip groups API
    if (activeChat.link?.startsWith("secret-")) return;
    router.prefetch(`/app/groups/${encodeURIComponent(activeChat.link)}`);
    const cached = groupModalCacheRef.current.get(activeChat.link);
    const isFresh = cached ? Date.now() - cached.savedAt <= GROUP_MODAL_CACHE_TTL_MS : false;
    if (isFresh || groupDetailsInFlightRef.current.has(activeChat.link)) return;
    groupDetailsInFlightRef.current.add(activeChat.link);
    void apiRequest<GroupModalData>(`/api/groups/${encodeURIComponent(activeChat.link)}/members`, {
      method: "GET",
      cache: "no-store",
    })
      .then((data) => {
        groupModalCacheRef.current.set(activeChat.link, { savedAt: Date.now(), data });
      })
      .catch(() => undefined)
      .finally(() => {
        groupDetailsInFlightRef.current.delete(activeChat.link);
      });
    return;
  }
  if (activeChat.chatType === "channel") {
    const cached = channelModalCacheRef.current.get(activeChat.link);
    const isFresh = cached ? Date.now() - cached.savedAt <= CHANNEL_MODAL_CACHE_TTL_MS : false;
    if (isFresh || channelDetailsInFlightRef.current.has(activeChat.link)) return;
    channelDetailsInFlightRef.current.add(activeChat.link);
    void apiRequest<ChannelModalData>(`/api/channels/${encodeURIComponent(activeChat.link)}`, {
      method: "GET",
      cache: "no-store",
    })
      .then((data) => {
        channelModalCacheRef.current.set(activeChat.link, { savedAt: Date.now(), data });
      })
      .catch(() => undefined)
      .finally(() => {
        channelDetailsInFlightRef.current.delete(activeChat.link);
      });
  }
}

export interface SynchronizeRequestedChatContext {
  searchParams: ReadonlyURLSearchParams;
  selectedLink: string | null;
  suppressRequestedChatSyncRef: React.RefObject<boolean>;
  setSelectedLink: React.Dispatch<React.SetStateAction<string | null>>;
  activeConversation: ConversationResponse | null;
  selectedSearchTargetRef: React.RefObject<{ link: string; chatType: ConversationChatType; isBot?: boolean | undefined; } | null>;
  selectedChat: ChatSummary | null;
  pathname: string;
}

export function synchronizeRequestedChat({ searchParams, selectedLink, suppressRequestedChatSyncRef, setSelectedLink, activeConversation, selectedSearchTargetRef, selectedChat, pathname }: SynchronizeRequestedChatContext): void {
  const currentChatParam = searchParams.get("chat")?.trim().toLowerCase() ?? null;
  const normalizedSelectedLink = selectedLink?.trim().toLowerCase() ?? null;
  if (currentChatParam === normalizedSelectedLink) return;
  if (currentChatParam && !normalizedSelectedLink && !suppressRequestedChatSyncRef.current) {
    setSelectedLink(currentChatParam);
    return;
  }

  const nextParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : searchParams.toString());
  if (normalizedSelectedLink) {
    nextParams.set("chat", normalizedSelectedLink);
    const conversationLink = activeConversation?.peer?.link ?? activeConversation?.group?.link ?? activeConversation?.channel?.link ??
      (activeConversation?.chatType === "eclipse" ? ECLIPSE_DIALOG_LINK : activeConversation?.chatType === "saved" ? "saved" : null);
    const targetChatType = (selectedSearchTargetRef.current?.link === normalizedSelectedLink ? selectedSearchTargetRef.current.chatType : undefined) ?? selectedChat?.chatType ??
      (conversationLink?.trim().toLowerCase() === normalizedSelectedLink ? activeConversation?.chatType : undefined);
    if (targetChatType) {
      nextParams.set("chatType", targetChatType);
    } else {
      nextParams.delete("chatType");
    }
  } else {
    nextParams.delete("chat");
    nextParams.delete("chatType");
  }

  const query = nextParams.toString();
  const nextUrl = query ? `${pathname}?${query}` : pathname;
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", nextUrl);
  }
}

export interface PrewarmSharedKeysForChatPreviewsActionContext {
  e2eIdentityReady: boolean;
  ensureSharedKeyFromServerRef: React.RefObject<((chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{ version: number; keyBase64: string; createdAt: number; } | null>) | null>;
  sharedKeyWarmupAtRef: React.RefObject<Record<string, number>>;
}

export async function prewarmSharedKeysForChatPreviewsAction({ e2eIdentityReady, ensureSharedKeyFromServerRef, sharedKeyWarmupAtRef }: PrewarmSharedKeysForChatPreviewsActionContext, chatItems: ChatSummary[]): Promise<void> {
  if (!e2eIdentityReady) return;
  const ensureSharedKey = ensureSharedKeyFromServerRef.current;
  if (!ensureSharedKey) return;

  const now = Date.now();
  const queued = new Map<string, Promise<unknown>>();
  for (const chat of chatItems) {
    if (!isSharedChat(chat)) continue;
    if (
      !canDecryptSharedPayload({
        cipherText: chat.lastMessageCipherText,
        iv: chat.lastMessageIv,
        keyVersion: chat.lastMessageKeyVersion ?? null,
      })
    ) {
      continue;
    }
    if (typeof chat.lastMessageKeyVersion !== "number") continue;
    const chatType = chat.chatType === "group" ? "group" : "channel";
    const chatId = resolveSharedChatIdFromSummary(chat);
    if (!chatId) continue;

    const localKey = loadSharedChatKeys(`${chatType}:${chatId}`).find(
      (item) => item.version === chat.lastMessageKeyVersion,
    );
    if (localKey) continue;

    const warmupKey = `${chatType}:${chatId}:${chat.lastMessageKeyVersion}`;
    const lastWarmupAt = sharedKeyWarmupAtRef.current[warmupKey] ?? 0;
    if (now - lastWarmupAt < SHARED_KEY_WARMUP_COOLDOWN_MS) continue;

    sharedKeyWarmupAtRef.current[warmupKey] = now;
    if (!queued.has(warmupKey)) {
      queued.set(
        warmupKey,
        ensureSharedKey(chatType, chat.link, chatId, chat.lastMessageKeyVersion).catch(() => null),
      );
    }
    if (queued.size >= CHAT_PREVIEW_SHARED_KEY_WARMUP_LIMIT) break;
  }

  if (queued.size === 0) return;
  await Promise.all(queued.values());
}

export interface HydrateCachedAccountContext {
  listCacheHydratedRef: React.RefObject<boolean>;
  currentUserIdRef: React.RefObject<string | null>;
  setSelfId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelfProfile: React.Dispatch<React.SetStateAction<SelfProfile | null>>;
  setStoryFeed: React.Dispatch<React.SetStateAction<StoryFeedGroup[]>>;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  setUnreadByLink: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setHasMoreChats: React.Dispatch<React.SetStateAction<boolean>>;
  setChatsCursor: React.Dispatch<React.SetStateAction<string | null>>;
}

export function hydrateCachedAccount({ listCacheHydratedRef, currentUserIdRef, setSelfId, setSelfProfile, setStoryFeed, setChats, setUnreadByLink, setHasMoreChats, setChatsCursor }: HydrateCachedAccountContext): void {
  if (listCacheHydratedRef.current) {
    return;
  }

  const cachedSelf = loadLatestSelfProfilePersistentCache();
  if (!cachedSelf) {
    return;
  }

  currentUserIdRef.current = cachedSelf.me.id;
  chatMemory.selfProfileInMemoryCache = cachedSelf;
  setSelfId(cachedSelf.me.id);
  setSelfProfile((prev) => prev ?? cachedSelf.me);

  const cachedStoryFeed = loadInitialStoryFeedSnapshot(cachedSelf.me.id);
  if (cachedStoryFeed) {
    setStoryFeed((prev) => (prev.length > 0 ? prev : cachedStoryFeed.stories));
  }

  const cachedChats = loadInitialChatListSnapshot(cachedSelf.me.id);
  if (cachedChats) {
    const normalizedChats = normalizeCachedChatsForSelf(cachedChats.chats, cachedSelf.me.id);
    const normalizedSnapshot = { ...cachedChats, chats: normalizedChats, selfId: cachedSelf.me.id };
    setChats((prev) => (prev.length > 0 ? prev : normalizedChats));
    setUnreadByLink((prev) => (Object.keys(prev).length > 0 ? prev : cachedChats.unreadByLink));
    setHasMoreChats(cachedChats.hasMoreChats);
    setChatsCursor(cachedChats.chatsCursor);
    if (!chatMemory.chatsListInMemoryCache) {
      chatMemory.chatsListInMemoryCache = normalizedSnapshot;
    }
  }

  listCacheHydratedRef.current = true;
}

export interface LoadSecretChatsActionContext {
  selfId: string | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
}

export async function loadSecretChatsAction({ selfId, t, setChats }: LoadSecretChatsActionContext): Promise<void> {
  if (!selfId) return;
  try {
    const res = await apiRequest<{
      success: boolean;
      chats: Array<{
        id: string;
        title: string;
        expiresAt: string | null;
        isApproved: boolean;
        isCreator?: boolean;
        peer: { id: string; link: string; displayName: string; contactAlias?: string | null; avatarUrl: string | null };
      }>;
    }>("/api/chats/secret");

    if (res?.success && res.chats) {
      const secretChatSummaries = res.chats.map((chat) => {
        const expTime = chat.expiresAt ? new Date(chat.expiresAt).getTime() : null;
        const peerDisplayName = chat.peer?.displayName || chat.peer?.link || chat.title || t("Секретный чат");
        const previewText = !chat.isApproved
          ? (chat.isCreator ? t("Ждем одобрения от {0}", { 0: peerDisplayName }) : t("Приглашение в секретный чат"))
          : t("Секретный чат");
        return {
          chatType: "direct",
          conversationId: `secret:${chat.id}`,
          peerId: chat.peer?.id || chat.id,
          link: `secret-${chat.id}`,
          displayName: peerDisplayName,
          contactAlias: chat.peer?.contactAlias ?? null,
          avatarUrl: chat.peer?.avatarUrl || null,
          membersCount: "0",
          lastMessage: previewText,
          lastMessageAt: chat.expiresAt
            ? new Date(expTime! - ((chat as any).lifetimeSeconds ?? 86400) * 1000).toISOString()
            : new Date().toISOString(),
          lastMessageMine: false,
          unreadCount: !chat.isApproved && !chat.isCreator ? 1 : 0,
          contactTag: "SECRET",
          contactTagVariant: "outline",
          lastMessageCipherText: null,
          lastMessageIv: null,
          lastMessageEncryptedKey: null,
          lastMessageKeyVersion: null,
          lastMessageSenderId: null,
          lastMessageSenderAlias: null,
          isCreator: Boolean(chat.isCreator),
          isApproved: Boolean(chat.isApproved),
          creatorId: (chat as any).creatorId ?? null,
          expiresAt: chat.expiresAt ?? null,
        } as ChatSummary;
      });

      setChats((prev) => mergeSecretChatSummaries(prev, secretChatSummaries));
    }
  } catch (err) {
    console.error("Failed to load secret chats from server:", err);
  }
}
