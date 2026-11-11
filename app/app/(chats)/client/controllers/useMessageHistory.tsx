"use client";

import { observeViewportGeometry } from "@/lib/client/observe-viewport-geometry";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cancelAllMessageDissolves } from "@/lib/client/message-dissolve";

import { type PinScope } from "@/lib/message-pins";
import { useMessagePins } from "../../hooks/useMessagePins";

import { useMessageSearch } from "../../hooks/useMessageSearch";

import { showAppToast } from "@/lib/client/app-toast";

import { emojiPlainText } from "@/lib/custom-emoji";

import { type DecryptedMessage, type ConversationResponse } from "../../types";

import { type E2EIdentity, loadSharedChatKeys, loadStoredE2EKeyPairs } from "@/lib/client/e2e";

import { parseMessageContentCached } from "../message-content";
import { SCROLL_TO_BOTTOM_BUTTON_THRESHOLD, MESSAGE_ROW_GAP } from "../config";

import { clampVirtualRange, findStartIndex } from "../virtualization";

import { renderedMessagesView, restoreConversationReadingPosition, getMessageRowRefAction, observeChatListViewport, resolveAndSyncOwnE2EIdentityAction } from "../message-viewport";
import { decryptMessageWithRecoveryAction, ensureSharedKeyFromServerAction, decryptHistoryPageAction, loadOlderMessagesAction } from "../message-crypto";

import type { ChatElementStateModel } from "./useChatElementState";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatDirectoryModel } from "./useChatDirectory";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { ChatInteractionModel } from "./useChatInteraction";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface MessageHistorySources {
  elements: Pick<ChatElementStateModel, "scrollMessagesToBottom" | "messageOverscan" | "mobileEmojiPickerHeight" | "chatListLoadMoreThreshold" | "sanitizeMessages" | "isMessageMarkedDeleted"> & {
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "prependScrollSnapshotRef" | "preservingHistoryScrollRef" | "loadOlderMessagesRef" | "setChatListScrollTop" | "lastCommittedChatListScrollTopRef" | "pendingChatListScrollTopRef" | "lastChatListScrollTopRef" | "mobileHeaderOffsetRef" | "pendingMobileHeaderOffsetRef" | "chatListScrollTop" | "chatListScrollRafRef" | "messagesScrollRafRef">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "messagesViewportRef" | "chatScrollRef" | "chatReadingPositionsRef" | "messageRowRefCallbacksRef" | "messageRowObserversRef" | "chatListViewportRef" | "deleteAnimationTimersRef" | "decryptedPreviewFingerprintRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "setMessagesScrollTop" | "messagesViewportHeight" | "messagesScrollTop" | "setShowScrollToBottomButton" | "hasMoreMessagesBefore" | "loadingOlderMessages" | "lastCommittedMessagesScrollTopRef" | "messageMeasureFrameRef" | "pendingMeasuredMessageIdsRef" | "setMessageMeasureVersion" | "setChatListViewportHeight" | "chatListViewportHeight" | "setMessagesViewportHeight" | "storyOverlayRenderRafRef" | "setLoadingOlderMessages" | "setHasMoreMessagesBefore">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "userScrolledUpRef" | "programmaticScrollRef" | "lastObservedMessagesScrollTopRef" | "messagesAtBottomRef">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "userSentMessageRef" | "footerHeight" | "messageHeightsRef">;

  };
  page: Pick<ChatPageStateModel, "detailsTargetRef" | "profileModalOpen" | "t"> & {
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "voiceRecording" | "videoRecording">;
    conversation: Pick<ChatPageStateModel["conversation"], "messages" | "activeConversation" | "chats" | "activeConversationRef" | "setMessages">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile" | "animatedMessageIdsRef">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "selectedLinkRef">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "loadingConversation">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "globalMusicVisible">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "stickerPickerOpen">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop" | "setDesktopDetailsPanelOpen">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "groupModalOpen">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "channelModalOpen">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "hasMoreChats" | "loadingMoreChats" | "chatsCursor">;
    identity: Pick<ChatPageStateModel["identity"], "setPrivateKey" | "setSelfPublicKey" | "setE2EIdentityReady" | "privateKey" | "selfPublicKey" | "cryptoDiagnosticRef">;

  };
  directory: Pick<ChatDirectoryModel, "messageOffsets" | "messageSizes" | "messageVerticalOffset" | "bannersHeight" | "chatListTotalHeight" | "scrollToMessageById">;
  bootstrap: Pick<ChatBootstrapModel, "loadChatPage" | "ensureSharedKeyFromServerRef"> & {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "currentUserIdRef">;

  };
  active: Pick<ActiveConversationModel, "activeChat">;
  callbacks: Pick<ChatPageCallbacks, "showDetailsPanel">;
  presentation: Pick<ConversationPresentationModel, "canUseDesktopDetailsPanel" | "isSecretChat">;
  interaction: Pick<ChatInteractionModel, "interruptMessageAutoScroll">;
}

export interface MessageHistoryModel {
  renderedMessages: {
    message: import("@/app/app/(chats)/types").DecryptedMessage;
    index: number;
    top: number;
    chainWithPrevious: boolean;
    chainWithNext: boolean;
    showDateSeparator: boolean;
    rowSpacingClassName: string;

  }[];
  messagesCanvasHeight: number;
  getMessageRowRef: (messageId: string, messageLocalId?: string | null | undefined) => (node: HTMLDivElement | null) => void;
  resolveAndSyncOwnE2EIdentity: (options?: {
    forceServerRestore?: boolean | undefined;
    allowPrompt?: boolean | undefined;

  } | undefined) => Promise<import("@/lib/client/e2e").E2EIdentity>;
  ensureOwnE2EReady: (options?: {
    allowPrompt?: boolean | undefined;

  } | undefined) => Promise<{
    privateKey: CryptoKey;
    publicKeyBase64: string;
    privateKeyBase64: string | null;

  }>;
  decryptMessageWithRecovery: (params: {
    privateKey: CryptoKey;
    cipherText: string;
    iv: string;
    encryptedKey: string;

  }) => Promise<string>;
  buildSharedChatKeyId: (chatType: "group" | "channel", chatId: string) => string;
  sharedKeyServerCacheRef: React.RefObject<Map<string, {
    expiresAt: number;
    value: {
      version: number;
      keyBase64: string;
      createdAt: number;

    } | null;

  }>>;
  loadSharedKeyByVersion: (chatKeyId: string, version: number) => NonNullable<ReturnType<typeof import("@/lib/client/e2e").loadActiveSharedChatKey>> | null;
  ensureSharedKeyFromServer: (chatType: "group" | "channel", link: string, chatId: string, version?: number | null | undefined) => Promise<{
    version: number;
    keyBase64: string;
    createdAt: number;

  } | null>;
  decryptHistoryPage: (data: import("@/app/app/(chats)/types").ConversationResponse, link: string) => Promise<import("@/app/app/(chats)/types").DecryptedMessage[]>;
  messageSearch: ReturnType<typeof useMessageSearch>;
  pinScope: import("@/lib/message-pins").PinScope | null;
  handlePinError: (error: unknown) => void;
  messagePins: ReturnType<typeof useMessagePins>;
  pinPreview: {
    key: string;
    id: string;
    text: string;

  } | null;
  setPinPreview: React.Dispatch<React.SetStateAction<{
    key: string;
    id: string;
    text: string;

  } | null>>;
  pinNavigatingKey: string;
  setPinNavigatingKey: React.Dispatch<React.SetStateAction<string>>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useMessageHistory(sources: MessageHistorySources): MessageHistoryModel {
  const { scrollMessagesToBottom, messageOverscan, mobileEmojiPickerHeight, chatListLoadMoreThreshold, sanitizeMessages, isMessageMarkedDeleted } = sources.elements;
  const { prependScrollSnapshotRef, preservingHistoryScrollRef, loadOlderMessagesRef, setChatListScrollTop, lastCommittedChatListScrollTopRef, pendingChatListScrollTopRef, lastChatListScrollTopRef, mobileHeaderOffsetRef, pendingMobileHeaderOffsetRef, chatListScrollTop, chatListScrollRafRef, messagesScrollRafRef } = sources.elements.conversationRequest;
  const { messagesViewportRef, chatScrollRef, chatReadingPositionsRef, messageRowRefCallbacksRef, messageRowObserversRef, chatListViewportRef, deleteAnimationTimersRef, decryptedPreviewFingerprintRef } = sources.elements.conversationElement;
  const { setMessagesScrollTop, messagesViewportHeight, messagesScrollTop, setShowScrollToBottomButton, hasMoreMessagesBefore, loadingOlderMessages, lastCommittedMessagesScrollTopRef, messageMeasureFrameRef, pendingMeasuredMessageIdsRef, setMessageMeasureVersion, setChatListViewportHeight, chatListViewportHeight, setMessagesViewportHeight, storyOverlayRenderRafRef, setLoadingOlderMessages, setHasMoreMessagesBefore } = sources.elements.storyAndViewport;
  const { userScrolledUpRef, programmaticScrollRef, lastObservedMessagesScrollTopRef, messagesAtBottomRef } = sources.elements.conversationScroll;
  const { userSentMessageRef, footerHeight, messageHeightsRef } = sources.elements.messageDelivery;
  const { detailsTargetRef, profileModalOpen, t } = sources.page;
  const { voiceRecording, videoRecording } = sources.page.recorderPresentation;
  const { messages, activeConversation, chats, activeConversationRef, setMessages } = sources.page.conversation;
  const { selfId, selfProfile, animatedMessageIdsRef } = sources.page.account;
  const { selectedLink, selectedLinkRef } = sources.page.selection;
  const { loadingConversation } = sources.page.conversationRequest;
  const { globalMusicVisible } = sources.page.secretChatDraft;
  const { stickerPickerOpen } = sources.page.attachmentDraft;
  const { isDesktop, setDesktopDetailsPanelOpen } = sources.page.panels;
  const { groupModalOpen } = sources.page.groupDetails;
  const { channelModalOpen } = sources.page.mediaAndChannel;
  const { hasMoreChats, loadingMoreChats, chatsCursor } = sources.page.messageInteraction;
  const { setPrivateKey, setSelfPublicKey, setE2EIdentityReady, privateKey, selfPublicKey, cryptoDiagnosticRef } = sources.page.identity;
  const { messageOffsets, messageSizes, messageVerticalOffset, bannersHeight, chatListTotalHeight, scrollToMessageById } = sources.directory;
  const { loadChatPage, ensureSharedKeyFromServerRef } = sources.bootstrap;
  const { currentUserIdRef } = sources.bootstrap.accountNavigation;
  const { activeChat } = sources.active;
  const { showDetailsPanel } = sources.callbacks;
  const { canUseDesktopDetailsPanel, isSecretChat } = sources.presentation;
  const { interruptMessageAutoScroll } = sources.interaction;

  useEffect(() => {
    // Prevent layout shift jerking when toggling voice/video recording
    requestAnimationFrame(() => {
      scrollMessagesToBottom("auto");
    });
    const timer = setTimeout(() => {
      scrollMessagesToBottom("auto");
    }, 80);
    const timer2 = setTimeout(() => {
      scrollMessagesToBottom("auto");
    }, 200);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [voiceRecording, videoRecording, scrollMessagesToBottom]);

  useLayoutEffect(() => {
    const snapshot = prependScrollSnapshotRef.current;
    const viewport = messagesViewportRef.current;
    if (!snapshot || !viewport) return;

    const chat = chatScrollRef.current;
    if (!chat || !chatReadingPositionsRef.current.has(chat.key)) {
      const delta = viewport.scrollHeight - snapshot.previousHeight;
      viewport.scrollTop = snapshot.previousTop + delta;
      setMessagesScrollTop(viewport.scrollTop);
    }
    prependScrollSnapshotRef.current = null;
    preservingHistoryScrollRef.current = false;
  }, [messages.length]);

  const messageWindow = useMemo(() => {
    if (messages.length === 0 || messagesViewportHeight <= 0) {
      return { start: 0, end: -1 };
    }
    // Pixel overscan also covers runs of very short rows between scroll commits.
    const start = findStartIndex(messageOffsets.offsets, messageSizes, Math.max(0, messagesScrollTop - 320));
    let end = start;
    const viewportEnd = messagesScrollTop + messagesViewportHeight + 320;
    while (
      end < messages.length &&
      messageOffsets.offsets[end] + messageSizes[end] + MESSAGE_ROW_GAP < viewportEnd
    ) {
      end += 1;
    }
    return clampVirtualRange(messages.length, start, end, messageOverscan);
  }, [
    messages.length,
    messagesViewportHeight,
    messagesScrollTop,
    messageOffsets.offsets,
    messageSizes,
    messageOverscan,
  ]);

  const virtualMessages = useMemo(() => {
    if (messageWindow.end < messageWindow.start) return [];
    return messages.slice(messageWindow.start, messageWindow.end + 1).map((message, offset) => {
      const index = messageWindow.start + offset;
      return {
        message,
        index,
        top: messageVerticalOffset + bannersHeight + (messageOffsets.offsets[index] ?? 0),
      };
    });
  }, [messageVerticalOffset, messages, messageOffsets.offsets, messageWindow.end, messageWindow.start, bannersHeight]);

  const renderedMessages = useMemo(() => {
    return renderedMessagesView({ selfId, selfProfile, currentUserIdRef, messages, messagesViewportHeight, activeConversation, messageVerticalOffset, bannersHeight, messageOffsets, virtualMessages });
  }, [messageOffsets.offsets, messageVerticalOffset, messages, messagesViewportHeight, virtualMessages, selfId, selfProfile?.id, bannersHeight, activeConversation]);

  const messagesCanvasHeight = useMemo(
    () => Math.max(messagesViewportHeight, messageVerticalOffset + messageOffsets.totalHeight + bannersHeight),
    [messageOffsets.totalHeight, messageVerticalOffset, messagesViewportHeight, bannersHeight],
  );

  useLayoutEffect(() => {
    return restoreConversationReadingPosition({ chatScrollRef, messagesViewportRef, selectedLink, activeConversation, messages, userScrolledUpRef, userSentMessageRef, loadingConversation, chatReadingPositionsRef, scrollMessagesToBottom, setShowScrollToBottomButton, programmaticScrollRef, preservingHistoryScrollRef, hasMoreMessagesBefore, loadingOlderMessages, loadOlderMessagesRef, messageVerticalOffset, bannersHeight, messageOffsets, lastObservedMessagesScrollTopRef, lastCommittedMessagesScrollTopRef, setMessagesScrollTop });
  }, [activeConversation, bannersHeight, footerHeight, globalMusicVisible, hasMoreMessagesBefore, loadingConversation,
    loadingOlderMessages, messageOffsets, messageVerticalOffset, messages, mobileEmojiPickerHeight,
    SCROLL_TO_BOTTOM_BUTTON_THRESHOLD, scrollMessagesToBottom, selectedLink, stickerPickerOpen]);

  const scheduleMessageMeasureCommit = useCallback(() => {
    if (messageMeasureFrameRef.current !== null) {
      return;
    }
    messageMeasureFrameRef.current = window.requestAnimationFrame(() => {
      messageMeasureFrameRef.current = null;
      if (pendingMeasuredMessageIdsRef.current.size === 0) return;
      pendingMeasuredMessageIdsRef.current.clear();
      setMessageMeasureVersion((prev) => prev + 1);
    });
  }, []);

  const getMessageRowRef = useCallback((messageId: string, messageLocalId?: string | null) => {
    return getMessageRowRefAction({ messageRowRefCallbacksRef, messageRowObserversRef, messageHeightsRef, pendingMeasuredMessageIdsRef, scheduleMessageMeasureCommit }, messageId, messageLocalId);
  }, [scheduleMessageMeasureCommit]);

  useEffect(() => {
    return () => {
      if (messageMeasureFrameRef.current !== null) {
        cancelAnimationFrame(messageMeasureFrameRef.current);
        messageMeasureFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const mobileChatOpen = !isDesktop && Boolean(activeChat);
    window.dispatchEvent(
      new CustomEvent("eclipse:mobile-chat-visibility", {
        detail: { mobileChatOpen },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("eclipse:mobile-chat-visibility", {
          detail: { mobileChatOpen: false },
        }),
      );
    };
  }, [activeChat, isDesktop]);

  useEffect(() => {
    if (!isDesktop) {
      setDesktopDetailsPanelOpen(false);
    }
  }, [isDesktop]);

  useLayoutEffect(() => {
    const target = detailsTargetRef.current;
    if (isDesktop && target && (profileModalOpen || groupModalOpen || channelModalOpen)) {
      showDetailsPanel(target.kind, target.link);
    }
  }, [isDesktop, profileModalOpen, groupModalOpen, channelModalOpen]);

  useEffect(() => {
    if (!canUseDesktopDetailsPanel) {
      setDesktopDetailsPanelOpen(false);
    }
  }, [canUseDesktopDetailsPanel]);

  useEffect(() => {
    const lock = !isDesktop && Boolean(activeChat);
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    if (lock) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
    }

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [activeChat, isDesktop]);

  useEffect(() => {
    return observeChatListViewport({ chatListViewportRef, setChatListViewportHeight, setChatListScrollTop, lastCommittedChatListScrollTopRef, pendingChatListScrollTopRef, lastChatListScrollTopRef, isDesktop, mobileHeaderOffsetRef, pendingMobileHeaderOffsetRef });
  }, [isDesktop, chats.length]);

  useEffect(() => {
    if (!hasMoreChats || loadingMoreChats) return;
    const distanceToBottom = chatListTotalHeight - (chatListScrollTop + chatListViewportHeight);
    if (distanceToBottom > chatListLoadMoreThreshold) return;
    void loadChatPage(chatsCursor, "append");
  }, [
    chatListScrollTop,
    chatListViewportHeight,
    chatListTotalHeight,
    hasMoreChats,
    loadingMoreChats,
    chatsCursor,
    loadChatPage,
    chatListLoadMoreThreshold,
  ]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    const update = () => {
      setMessagesViewportHeight(viewport.clientHeight);
      if (!userScrolledUpRef.current && chatScrollRef.current?.initial === false) {
        scrollMessagesToBottom("auto");
      }
    };

    return observeViewportGeometry(viewport, update);
  }, [activeChat?.link, isDesktop, scrollMessagesToBottom]);

  useEffect(() => {
    const currentIds = new Set<string>();
    messages.forEach((message) => {
      currentIds.add(message.id);
      if (message.localId) currentIds.add(message.localId);
    });
    Object.keys(messageHeightsRef.current).forEach((messageId) => {
      if (!currentIds.has(messageId)) {
        delete messageHeightsRef.current[messageId];
      }
    });
    Object.keys(messageRowObserversRef.current).forEach((messageId) => {
      if (!currentIds.has(messageId)) {
        messageRowObserversRef.current[messageId]?.disconnect();
        delete messageRowObserversRef.current[messageId];
      }
    });
    Object.keys(messageRowRefCallbacksRef.current).forEach((messageId) => {
      if (!currentIds.has(messageId)) {
        delete messageRowRefCallbacksRef.current[messageId];
      }
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      Object.values(messageRowObserversRef.current).forEach((observer) => observer.disconnect());
      messageRowObserversRef.current = {};
      Object.values(deleteAnimationTimersRef.current).forEach((timer) => clearTimeout(timer));
      cancelAllMessageDissolves();
      deleteAnimationTimersRef.current = {};
      if (chatListScrollRafRef.current !== null) {
        cancelAnimationFrame(chatListScrollRafRef.current);
        chatListScrollRafRef.current = null;
      }
      if (messagesScrollRafRef.current !== null) {
        cancelAnimationFrame(messagesScrollRafRef.current);
        messagesScrollRafRef.current = null;
      }
      if (storyOverlayRenderRafRef.current !== null) {
        cancelAnimationFrame(storyOverlayRenderRafRef.current);
        storyOverlayRenderRafRef.current = null;
      }
    };
  }, []);

  const resolveOwnE2EInFlightRef = useRef<Promise<E2EIdentity> | null>(null);

  const lastForcedRestoreAtRef = useRef(0);

  const lastOwnE2EFailureRef = useRef<{
    at: number;
    message: string

  } | null>(null);

  const FORCE_RESTORE_COOLDOWN_MS = 15_000;

  const resolveAndSyncOwnE2EIdentity = useCallback(async (options?: {
    forceServerRestore?: boolean;
    allowPrompt?: boolean

  }) => {
    return resolveAndSyncOwnE2EIdentityAction({ lastOwnE2EFailureRef, resolveOwnE2EInFlightRef, setPrivateKey, setSelfPublicKey, setE2EIdentityReady, decryptedPreviewFingerprintRef, t }, options);
  }, [t]);

  const ensureOwnE2EReady = useCallback(async (options?: { allowPrompt?: boolean }) => {
    if (privateKey && selfPublicKey) {
      const matchedPrivateKeyBase64 =
        loadStoredE2EKeyPairs().find((pair) => pair.publicKeyBase64 === selfPublicKey)?.privateKeyBase64 ?? null;
      return {
        privateKey,
        publicKeyBase64: selfPublicKey,
        privateKeyBase64: matchedPrivateKeyBase64,
      };
    }

    try {
      const identity = await resolveAndSyncOwnE2EIdentity({ allowPrompt: options?.allowPrompt ?? false });
      return {
        privateKey: identity.privateKey,
        publicKeyBase64: identity.publicKeyBase64,
        privateKeyBase64: identity.privateKeyBase64,
      };
    } catch (error) {
      const details = error instanceof Error ? ` (${error.message})` : "";
      throw new Error(t("Не удалось инициализировать E2E на этом устройстве{0}", { 0: details }));
    }
  }, [privateKey, resolveAndSyncOwnE2EIdentity, selfPublicKey, t]);

  const decryptMessageWithRecovery = useCallback(
    async (params: {
      privateKey: CryptoKey;
      cipherText: string;
      iv: string;
      encryptedKey: string

    }) => {
      return decryptMessageWithRecoveryAction({ currentUserIdRef, resolveOwnE2EInFlightRef, lastForcedRestoreAtRef, FORCE_RESTORE_COOLDOWN_MS, resolveAndSyncOwnE2EIdentity, t }, params);
    },
    [FORCE_RESTORE_COOLDOWN_MS, resolveAndSyncOwnE2EIdentity, t],
  );

  const resolvePrivateKeyBase64 = useCallback(async () => {
    const own = await ensureOwnE2EReady();
    if (own.privateKeyBase64) return own.privateKeyBase64;
    const pairs = loadStoredE2EKeyPairs();
    const matched = own.publicKeyBase64
      ? pairs.find((pair) => pair.publicKeyBase64 === own.publicKeyBase64)
      : null;
    return matched?.privateKeyBase64 ?? pairs[0]?.privateKeyBase64 ?? null;
  }, [ensureOwnE2EReady]);

  const buildSharedChatKeyId = useCallback((chatType: "group" | "channel", chatId: string) => {
    return `${chatType}:${chatId}`;
  }, []);

  const sharedKeyFetchesRef = useRef(new Map<string, Promise<{
    version: number;
    keyBase64: string;
    createdAt: number

  } | null>>());

  const sharedKeyServerCacheRef = useRef(
    new Map<string, {
      expiresAt: number;
      value: {
        version: number;
        keyBase64: string;
        createdAt: number

      } | null

    }>(),
  );

  const loadSharedKeyByVersion = useCallback((chatKeyId: string, version: number) => {
    const keys = loadSharedChatKeys(chatKeyId);
    return keys.find((item) => item.version === version) ?? null;
  }, []);

  const ensureSharedKeyFromServer = useCallback(
    async (chatType: "group" | "channel", link: string, chatId: string, version?: number | null) => {
      return ensureSharedKeyFromServerAction({ sharedKeyServerCacheRef, sharedKeyFetchesRef, resolvePrivateKeyBase64, t, buildSharedChatKeyId }, chatType, link, chatId, version);
    },
    [buildSharedChatKeyId, resolvePrivateKeyBase64, t],
  );

  useEffect(() => {
    ensureSharedKeyFromServerRef.current = ensureSharedKeyFromServer;
  }, [ensureSharedKeyFromServer]);

  const decryptHistoryPage = useCallback(async (data: ConversationResponse, link: string): Promise<DecryptedMessage[]> => {
    return decryptHistoryPageAction({ buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, cryptoDiagnosticRef, privateKey, decryptMessageWithRecovery }, data, link);
  }, [buildSharedChatKeyId, ensureSharedKeyFromServer, loadSharedKeyByVersion, decryptMessageWithRecovery, privateKey, t]);

  const loadOlderMessages = useCallback(async () => {
    return loadOlderMessagesAction({ loadingOlderMessages, hasMoreMessagesBefore, selectedLink, activeConversation, messages, setLoadingOlderMessages, isDesktop, decryptHistoryPage, selectedLinkRef, activeConversationRef, messagesViewportRef, setHasMoreMessagesBefore, setMessages, sanitizeMessages, isMessageMarkedDeleted, animatedMessageIdsRef, preservingHistoryScrollRef, messagesAtBottomRef, setShowScrollToBottomButton, prependScrollSnapshotRef, selfId });
  }, [
    activeConversation,
    buildSharedChatKeyId,
    ensureSharedKeyFromServer,
    hasMoreMessagesBefore,
    isDesktop,
    isMessageMarkedDeleted,
    loadingOlderMessages,
    decryptHistoryPage,
    messages,
    privateKey,
    sanitizeMessages,
    selectedLink, t]);

  useEffect(() => {
    loadOlderMessagesRef.current = loadOlderMessages;
    return () => {
      loadOlderMessagesRef.current = null;
    };
  }, [loadOlderMessages]);

  const messageSearchItems = useMemo(() => messages.filter(message => !message.systemPayload).map(message => {
    const parsed = parseMessageContentCached(message.text, false);
    const text = "text" in parsed && typeof parsed.text === "string" ? parsed.text : "caption" in parsed && typeof parsed.caption === "string" ? parsed.caption : "";
    return { id: message.id, text: emojiPlainText(text) };
  }), [messages]);

  const messageSearch = useMessageSearch({
    scope: `${selfId}:${selectedLink?.toLowerCase() ?? ""}:${activeChat?.chatType ?? "direct"}`,
    messages: messageSearchItems, hasMore: hasMoreMessagesBefore, loading: loadingOlderMessages,
    loadOlder: loadOlderMessages, scroll: scrollToMessageById, stopScroll: interruptMessageAutoScroll,
  });

  const pinScope = useMemo<PinScope | null>(() => {
    if (!activeConversation?.conversationId) return null;
    const chatType = isSecretChat ? "secret" : activeConversation.chatType ?? "direct";
    const chatId = chatType === "group" ? activeConversation.group?.id
      : chatType === "channel" ? activeConversation.channel?.id
        : chatType === "secret" ? activeConversation.conversationId.replace(/^secret:/, "") : activeConversation.conversationId;
    return chatId ? { chatType, chatId } : null;
  }, [activeConversation, isSecretChat]);

  const handlePinError = useCallback((error: unknown) => {
    showAppToast({ type: "error", title: t(error instanceof Error ? error.message : "Не удалось изменить закреплённые сообщения") });
  }, [t]);

  const messagePins = useMessagePins(pinScope, handlePinError);

  const [pinPreview, setPinPreview] = useState<{
    key: string;
    id: string;
    text: string

  } | null>(null);

  const [pinNavigatingKey, setPinNavigatingKey] = useState("");

  return {
    renderedMessages,
    messagesCanvasHeight,
    getMessageRowRef,
    resolveAndSyncOwnE2EIdentity,
    ensureOwnE2EReady,
    decryptMessageWithRecovery,
    buildSharedChatKeyId,
    sharedKeyServerCacheRef,
    loadSharedKeyByVersion,
    ensureSharedKeyFromServer,
    decryptHistoryPage,
    messageSearch,
    pinScope,
    handlePinError,
    messagePins,
    pinPreview,
    setPinPreview,
    pinNavigatingKey,
    setPinNavigatingKey
  };
}
