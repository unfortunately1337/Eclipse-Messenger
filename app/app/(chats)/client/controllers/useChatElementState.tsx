"use client";
import { isMessageDissolving } from "@/lib/client/message-dissolve";

import { useConversationElementRefs, useConversationScrollRefs, useMessageDeliveryRefs, useConversationRequestRefs } from "../state/conversation-state";
import { useStoryAndViewportState } from "../state/stories-state";
import { useMediaRecorderState } from "../state/composer-state";

import { type UIEvent, useCallback, useEffect, useMemo } from "react";

import { readDeletedMessages, saveDeletedMessages, deletedMessageExpiry } from "@/lib/client/deleted-messages";

import { warmReactionAnimations } from "@/lib/client/reaction-animation";

import { type DecryptedMessage } from "../../types";
import { ALL_AVAILABLE_REACTIONS } from "../../constants";

import { PRESENCE_STATUS_TICK_MS } from "../config";

import { scrollMessagesToBottomAction, observeStoryKeyboard, observeMobileChatViewport, handleChatListScrollAction } from "../chat-lifecycle";

import type { ChatPageStateModel } from "./useChatPageState";

export interface ChatElementStateSources {
  page: Pick<ChatPageStateModel, "setPresenceNowTs" | "setLocallyHiddenMessageIds" | "locallyHiddenMessageIds"> & {
    account: Pick<ChatPageStateModel["account"], "selfId">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink">;
    conversation: Pick<ChatPageStateModel["conversation"], "activeConversation">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "setHighlightedMessageId">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "pendingMediaBatch" | "pendingImage" | "pendingVideo">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "storyDraft" | "setStoryDraftKeyboardInset">;

  };
}

export interface ChatElementStateModel {
  mediaRecorder: ReturnType<typeof useMediaRecorderState>;
  conversationElement: ReturnType<typeof useConversationElementRefs>;
  conversationScroll: ReturnType<typeof useConversationScrollRefs>;
  messageDelivery: ReturnType<typeof useMessageDeliveryRefs>;
  conversationRequest: ReturnType<typeof useConversationRequestRefs>;
  mobileEmojiPickerHeight: number;
  storyAndViewport: ReturnType<typeof useStoryAndViewportState>;
  chatOverscan: 12 | 8;
  messageOverscan: 14 | 10;
  chatListLoadMoreThreshold: 520 | 280;
  isMessageMarkedDeleted: (messageId: string) => boolean;
  markMessageDeletedTombstone: (messageId: string | string[]) => void;
  clearMessageDeletedTombstone: (messageId: string) => void;
  sanitizeMessages: (items: import("@/app/app/(chats)/types").DecryptedMessage[]) => import("@/app/app/(chats)/types").DecryptedMessage[];
  scrollMessagesToBottom: (behavior?: ScrollBehavior) => void;
  flashMessageHighlight: (messageId: string, durationMs?: number) => void;
  handleChatListScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  handleChatListTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleChatListTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleChatListWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatElementState(sources: ChatElementStateSources): ChatElementStateModel {
  const { setPresenceNowTs, setLocallyHiddenMessageIds, locallyHiddenMessageIds } = sources.page;
  const { selfId } = sources.page.account;
  const { isDesktop } = sources.page.panels;
  const { selectedLink } = sources.page.selection;
  const { activeConversation } = sources.page.conversation;
  const { setHighlightedMessageId } = sources.page.messageInteraction;
  const { pendingMediaBatch, pendingImage, pendingVideo } = sources.page.attachmentDraft;
  const { storyDraft, setStoryDraftKeyboardInset } = sources.page.storyDraft;

  const mediaRecorderStateModel = useMediaRecorderState();
  const {
    micRecordButtonRef, voicePointerIdRef, voicePointerStartRef, voiceHoldStartTimerRef, voiceRecordingStartedAtRef,
    voiceStreamRef, voiceRecorderRef, voiceChunksRef, voiceWaveformSamplesRef, voiceRecordedMimeTypeRef,
    voiceFinishInProgressRef, voiceTimerRef, videoStreamRef, videoRecorderRef, videoCaptureRef,
    videoStartInProgressRef, videoChunksRef, videoRecordingStartedAtRef, videoRecordedMimeTypeRef, videoFinishInProgressRef,
    videoTimerRef, sendingRealtimeKind, setSendingRealtimeKind
  } = mediaRecorderStateModel;

  useEffect(() => {
    const update = () => { if (document.visibilityState !== "hidden") setPresenceNowTs(Date.now()); };
    const timer = setInterval(update, PRESENCE_STATUS_TICK_MS);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);

  const conversationElementStateModel = useConversationElementRefs();
  const {
    videoPreviewRef, videoInputDeviceIdsRef, activeVideoDeviceIdRef, videoCameraSwitchInProgressRef, skipMicTapRef,
    pusherRef, realtimeSelfIdRef, decryptedPreviewFingerprintRef, peerPublicKeyByLinkRef, imageInputRef,
    groupAvatarInputRef, channelAvatarInputRef, chatListViewportRef, messageSwipeStartRef, messagesViewportRef,
    chatReadingPositionsRef, chatScrollRef, messagesEndRef, videoViewerRef, messageLongPressTimerRef,
    messageLongPressStartRef, messageLongPressTriggeredRef, draftBeforeEditRef, editPrefillTargetIdRef, groupModalCacheRef,
    channelModalCacheRef, profileDetailsInFlightRef, groupDetailsInFlightRef, channelDetailsInFlightRef, contactsForAddCacheRef,
    messageRowObserversRef, messageRowRefCallbacksRef, deleteAnimationTimersRef, deletedMessageTombstonesRef
  } = conversationElementStateModel;

  useEffect(() => {
    deletedMessageTombstonesRef.current = readDeletedMessages(selfId);
  }, [selfId]);

  const conversationScrollStateModel = useConversationScrollRefs();
  const {
    messagesAtBottomRef, userScrolledUpRef, lastObservedMessagesScrollTopRef, messagesTouchYRef, programmaticScrollRef,
    isScrollingToBottomRef, bottomScrollAnimationRef
  } = conversationScrollStateModel;

  useEffect(() => () => bottomScrollAnimationRef.current?.cancel(), []);

  const messageDeliveryStateModel = useMessageDeliveryRefs();
  const {
    userSentMessageRef, lastTapRef, sentReadReceiptIdsRef, readReceiptEndpointUnsupportedRef, messageHeightsRef,
    footerRef, footerHeight, setFooterHeight, reactionInFlightRef, reactionPulseTimersRef
  } = messageDeliveryStateModel;

  useEffect(() => {
    const handle = window.setTimeout(() => warmReactionAnimations(ALL_AVAILABLE_REACTIONS), 250);
    return () => window.clearTimeout(handle);
  }, []);

  const conversationRequestStateModel = useConversationRequestRefs();
  const {
    reactionPulseVersions, setReactionPulseVersions, conversationRequestSeqRef, listCacheHydratedRef, inflightHydrationRef,
    inflightChatListRequestKeyRef, loadingMoreChatsRef, openConversationInFlightRef, lastHandledSelectedLinkRef, openConversationRef,
    loadOlderMessagesRef, preservingHistoryScrollRef, prependScrollSnapshotRef, chatListScrollRafRef, messagesScrollRafRef,
    lastChatListScrollTopRef, lastCommittedChatListScrollTopRef, pendingChatListScrollTopRef, pendingMobileHeaderOffsetRef, mobileHeaderOffsetRef,
    chatListTouchStartRef, chatListScrollTop, setChatListScrollTop, mobileChatViewportHeight, setMobileChatViewportHeight
  } = conversationRequestStateModel;

  const mobileEmojiPickerHeight = Math.max(0, Math.min(300, Math.max(260, (mobileChatViewportHeight ?? 640) * .44), (mobileChatViewportHeight ?? 640) - 90));

  const storyAndViewportStateModel = useStoryAndViewportState();
  const {
    chatListViewportHeight, setChatListViewportHeight, messagesScrollTop, setMessagesScrollTop, lastCommittedMessagesScrollTopRef,
    messagesViewportHeight, setMessagesViewportHeight, messageMeasureVersion, setMessageMeasureVersion, storiesHidden,
    setStoriesHidden, storiesHiddenRef, lastChatListScrollIntentRef, hasMoreMessagesBefore, setHasMoreMessagesBefore,
    loadingOlderMessages, setLoadingOlderMessages, showScrollToBottomButton, setShowScrollToBottomButton, messageInputRef,
    storyInputRef, storyAdvanceTimerRef, storyViewerVideoRef, storyProgressRafRef, storyImageProgressStoryIdRef,
    storyImageProgressElapsedRef, storyViewerProgressRef, storyOverlayRenderRafRef, storyDraftRef, storyOverlayLastDrawPointRef,
    storyMediaDragRef, storyMediaPointersRef, storyMediaPinchRef, messageHighlightTimeoutRef, messageMeasureFrameRef,
    pendingMeasuredMessageIdsRef
  } = storyAndViewportStateModel;

  const chatOverscan = isDesktop ? 12 : 8;

  const messageOverscan = isDesktop ? 14 : 10;

  const chatListLoadMoreThreshold = isDesktop ? 520 : 280;

  const pruneDeletedMessageTombstones = useCallback(() => {
    const now = Date.now();
    deletedMessageTombstonesRef.current.forEach((expiresAt, id) => {
      if (expiresAt <= now) {
        deletedMessageTombstonesRef.current.delete(id);
      }
    });
  }, []);

  const isMessageMarkedDeleted = useCallback((messageId: string) => {
    const expiresAt = deletedMessageTombstonesRef.current.get(messageId);
    if (!expiresAt) {
      return false;
    }
    if (expiresAt <= Date.now()) {
      deletedMessageTombstonesRef.current.delete(messageId);
      return false;
    }
    return true;
  }, []);

  const markMessageDeletedTombstone = useCallback((messageId: string | string[]) => {
    pruneDeletedMessageTombstones();
    const expiry = deletedMessageExpiry();
    for (const id of Array.isArray(messageId) ? messageId : [messageId]) deletedMessageTombstonesRef.current.set(id, expiry);
    saveDeletedMessages(selfId, deletedMessageTombstonesRef.current);
  }, [pruneDeletedMessageTombstones, selfId]);

  const clearMessageDeletedTombstone = useCallback((messageId: string) => {
    deletedMessageTombstonesRef.current.delete(messageId);
    saveDeletedMessages(selfId, deletedMessageTombstonesRef.current);
  }, [selfId]);

  const hiddenMessagesStorageKey = useMemo(
    () =>
      selfId && selectedLink && activeConversation?.chatType
        ? `eclipse:hidden-messages:${selfId}:${activeConversation.chatType}:${selectedLink}`
        : null,
    [activeConversation?.chatType, selectedLink, selfId],
  );

  useEffect(() => {
    if (!hiddenMessagesStorageKey || typeof window === "undefined") {
      setLocallyHiddenMessageIds(new Set());
      return;
    }
    try {
      const raw = window.localStorage.getItem(hiddenMessagesStorageKey);
      if (!raw) {
        setLocallyHiddenMessageIds(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      setLocallyHiddenMessageIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setLocallyHiddenMessageIds(new Set());
    }
  }, [hiddenMessagesStorageKey]);

  useEffect(() => {
    if (!hiddenMessagesStorageKey || typeof window === "undefined") return;
    if (locallyHiddenMessageIds.size === 0) {
      window.localStorage.removeItem(hiddenMessagesStorageKey);
      return;
    }
    window.localStorage.setItem(hiddenMessagesStorageKey, JSON.stringify([...locallyHiddenMessageIds]));
  }, [hiddenMessagesStorageKey, locallyHiddenMessageIds]);

  const sanitizeMessages = useCallback((items: DecryptedMessage[]) => {
    if (items.length === 0) return items;
    pruneDeletedMessageTombstones();
    return items.filter((message) => (!isMessageMarkedDeleted(message.id) || isMessageDissolving(message.id)) && !locallyHiddenMessageIds.has(message.id));
  }, [isMessageMarkedDeleted, locallyHiddenMessageIds, pruneDeletedMessageTombstones]);

  const scrollMessagesToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      return scrollMessagesToBottomAction({ messagesViewportRef, userScrolledUpRef, userSentMessageRef, bottomScrollAnimationRef, isScrollingToBottomRef, programmaticScrollRef, messagesAtBottomRef, lastObservedMessagesScrollTopRef, lastCommittedMessagesScrollTopRef, setMessagesScrollTop }, behavior);
    },
    [setMessagesScrollTop],
  );

  const flashMessageHighlight = useCallback((messageId: string, durationMs = 1800) => {
    if (messageHighlightTimeoutRef.current !== null) {
      window.clearTimeout(messageHighlightTimeoutRef.current);
    }
    setHighlightedMessageId(messageId);
    messageHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
      messageHighlightTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (messageHighlightTimeoutRef.current !== null) {
        window.clearTimeout(messageHighlightTimeoutRef.current);
        messageHighlightTimeoutRef.current = null;
      }
      if (pendingMediaBatch?.length) {
        pendingMediaBatch.forEach((item) => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
      }
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      if (pendingVideo?.previewUrl) {
        URL.revokeObjectURL(pendingVideo.previewUrl);
      }
    };
  }, [pendingImage, pendingMediaBatch, pendingVideo]);

  useEffect(() => {
    return observeStoryKeyboard({ storyDraft, setStoryDraftKeyboardInset });
  }, [storyDraft]);

  useEffect(() => {
    return observeMobileChatViewport({ isDesktop, selectedLink, setMobileChatViewportHeight, messagesAtBottomRef, scrollMessagesToBottom });
  }, [isDesktop, selectedLink]);

  const handleChatListScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    return handleChatListScrollAction({ lastChatListScrollTopRef, pendingChatListScrollTopRef, isDesktop, lastChatListScrollIntentRef, mobileHeaderOffsetRef, pendingMobileHeaderOffsetRef, storiesHiddenRef, setStoriesHidden, chatListScrollRafRef, lastCommittedChatListScrollTopRef, setChatListScrollTop }, event);
  }, [isDesktop]);

  const handleChatListTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktop || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const viewport = event.currentTarget;
    chatListTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      top: viewport.scrollTop,
    };
  }, [isDesktop]);

  const handleChatListTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktop || event.touches.length !== 1) return;
    const start = chatListTouchStartRef.current;
    if (!start) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) return;
    if (Math.abs(dy) > 2) {
      const dir = dy > 0 ? -1 : 1;
      lastChatListScrollIntentRef.current = { dir, at: Date.now() };
      if (dir > 0 && !storiesHiddenRef.current) {
        storiesHiddenRef.current = true;
        setStoriesHidden(true);
      }
    }
  }, [isDesktop]);

  const handleChatListWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (isDesktop) return;
      if (Math.abs(event.deltaY) > 1) {
        const dir = event.deltaY > 0 ? 1 : -1;
        lastChatListScrollIntentRef.current = { dir, at: Date.now() };
        if (dir > 0 && !storiesHiddenRef.current) {
          storiesHiddenRef.current = true;
          setStoriesHidden(true);
        }
      }
    },
    [isDesktop],
  );

  return {
    mediaRecorder: mediaRecorderStateModel,
    conversationElement: conversationElementStateModel,
    conversationScroll: conversationScrollStateModel,
    messageDelivery: messageDeliveryStateModel,
    conversationRequest: conversationRequestStateModel,
    mobileEmojiPickerHeight,
    storyAndViewport: storyAndViewportStateModel,
    chatOverscan,
    messageOverscan,
    chatListLoadMoreThreshold,
    isMessageMarkedDeleted,
    markMessageDeletedTombstone,
    clearMessageDeletedTombstone,
    sanitizeMessages,
    scrollMessagesToBottom,
    flashMessageHighlight,
    handleChatListScroll,
    handleChatListTouchStart,
    handleChatListTouchMove,
    handleChatListWheel
  };
}
