"use client";
import { observeMessageSize, type MessageSizeSubscription } from "@/lib/client/message-size-observer";

import { type SelfProfile, type DecryptedMessage, type ConversationResponse } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { resolveE2EIdentity } from "@/lib/client/e2e-identity";
import { type E2EIdentity } from "@/lib/client/e2e";
import { dayKeyFromIso } from "./message-presentation";
import { SCROLL_TO_BOTTOM_BUTTON_THRESHOLD, MOBILE_CHAT_HEADER_HIDE_DISTANCE } from "./config";
import { decryptedPayloadFailureCache } from "./chat-cache";

export interface RenderedMessagesViewContext {
  selfId: string | null;
  selfProfile: SelfProfile | null;
  currentUserIdRef: React.RefObject<string | null>;
  messages: DecryptedMessage[];
  messagesViewportHeight: number;
  activeConversation: ConversationResponse | null;
  messageVerticalOffset: number;
  bannersHeight: number;
  messageOffsets: { offsets: number[]; totalHeight: number; };
  virtualMessages: { message: DecryptedMessage; index: number; top: number; }[];
}

export function renderedMessagesView({ selfId, selfProfile, currentUserIdRef, messages, messagesViewportHeight, activeConversation, messageVerticalOffset, bannersHeight, messageOffsets, virtualMessages }: RenderedMessagesViewContext): { message: DecryptedMessage; index: number; top: number; chainWithPrevious: boolean; chainWithNext: boolean; showDateSeparator: boolean; rowSpacingClassName: string; }[] {
  const currentUserId = selfId ?? selfProfile?.id ?? currentUserIdRef.current ?? "";

  const isMessageVisible = (msg: typeof messages[0]) => {
    return true;
  };

  const getPreviousVisibleMessage = (idx: number) => {
    for (let j = idx - 1; j >= 0; j--) {
      if (isMessageVisible(messages[j])) {
        return messages[j];
      }
    }
    return null;
  };

  if (messagesViewportHeight <= 0) {
    // ResizeObserver has not measured the viewport yet. A cached conversation
    // may contain hundreds of rows; mount only the latest screenful until then.
    const start = Math.max(0, messages.length - 32);
    return messages.slice(start).map((message, offset) => {
      const index = start + offset;
      const previousMessage = getPreviousVisibleMessage(index);
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      const dayKey = dayKeyFromIso(message.createdAt);
      const nextDayKey = nextMessage ? dayKeyFromIso(nextMessage.createdAt) : null;
      const isCurrentVisible = isMessageVisible(message);
      let showDateSeparator = isCurrentVisible && (!previousMessage || dayKeyFromIso(previousMessage.createdAt) !== dayKey);
      if (showDateSeparator && !previousMessage) {
        const communityCreatedAt = activeConversation?.chatType === "group"
          ? activeConversation.group?.createdAt
          : activeConversation?.chatType === "channel"
            ? activeConversation.channel?.createdAt
            : null;
        if (communityCreatedAt) {
          const communityDayKey = dayKeyFromIso(communityCreatedAt);
          if (communityDayKey === dayKey) {
            showDateSeparator = false;
          }
        }
      }
      const chainWithPrevious = Boolean(
        previousMessage &&
        previousMessage.senderId === message.senderId && previousMessage.systemPayload?.eventType !== "call" && message.systemPayload?.eventType !== "call" &&
        dayKeyFromIso(previousMessage.createdAt) === dayKey,
      );
      const chainWithNext = Boolean(nextMessage && nextMessage.senderId === message.senderId && nextMessage.systemPayload?.eventType !== "call" && message.systemPayload?.eventType !== "call" && nextDayKey === dayKey);
      const rowSpacingClassName = showDateSeparator
        ? "pb-2"
        : chainWithNext
          ? "pb-[2px]"
          : "pb-2";

      return {
        message,
        index,
        top: messageVerticalOffset + bannersHeight + (messageOffsets.offsets[index] ?? 0),
        chainWithPrevious,
        chainWithNext,
        showDateSeparator,
        rowSpacingClassName,
      };
    });
  }
  return virtualMessages.map(({ message, index, top }) => {
    const prevMessage = getPreviousVisibleMessage(index);
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const dayKey = dayKeyFromIso(message.createdAt);
    const nextDayKey = nextMessage ? dayKeyFromIso(nextMessage.createdAt) : null;
    const isCurrentVisible = isMessageVisible(message);
    let showDateSeparator = isCurrentVisible && (!prevMessage || dayKeyFromIso(prevMessage.createdAt) !== dayKey);
    if (showDateSeparator && !prevMessage) {
      const communityCreatedAt = activeConversation?.chatType === "group"
        ? activeConversation.group?.createdAt
        : activeConversation?.chatType === "channel"
          ? activeConversation.channel?.createdAt
          : null;
      if (communityCreatedAt) {
        const communityDayKey = dayKeyFromIso(communityCreatedAt);
        if (communityDayKey === dayKey) {
          showDateSeparator = false;
        }
      }
    }
    const chainWithPrevious = Boolean(
      prevMessage && prevMessage.senderId === message.senderId && prevMessage.systemPayload?.eventType !== "call" && message.systemPayload?.eventType !== "call" && dayKeyFromIso(prevMessage.createdAt) === dayKey,
    );
    const chainWithNext = Boolean(nextMessage && nextMessage.senderId === message.senderId && nextMessage.systemPayload?.eventType !== "call" && message.systemPayload?.eventType !== "call" && nextDayKey === dayKey);
    const rowSpacingClassName = showDateSeparator
      ? "pb-2"
      : chainWithNext
        ? "pb-[2px]"
        : "pb-2";
    return { message, index, top, chainWithPrevious, chainWithNext, showDateSeparator, rowSpacingClassName };
  });
}

export interface RestoreConversationReadingPositionContext {
  chatScrollRef: React.RefObject<{ key: string; link: string; initial: boolean; lastMessageId?: string | undefined; requestedBefore?: string | undefined; } | null>;
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  selectedLink: string | null;
  activeConversation: ConversationResponse | null;
  messages: DecryptedMessage[];
  userScrolledUpRef: React.RefObject<boolean>;
  userSentMessageRef: React.RefObject<boolean>;
  loadingConversation: boolean;
  chatReadingPositionsRef: React.RefObject<Map<string, { messageId: string; offset: number; top: number; createdAt: string; }>>;
  scrollMessagesToBottom: (behavior?: ScrollBehavior) => void;
  setShowScrollToBottomButton: React.Dispatch<React.SetStateAction<boolean>>;
  programmaticScrollRef: React.RefObject<boolean>;
  preservingHistoryScrollRef: React.RefObject<boolean>;
  hasMoreMessagesBefore: boolean;
  loadingOlderMessages: boolean;
  loadOlderMessagesRef: React.RefObject<(() => Promise<void>) | null>;
  messageVerticalOffset: number;
  bannersHeight: number;
  messageOffsets: { offsets: number[]; totalHeight: number; };
  lastObservedMessagesScrollTopRef: React.RefObject<number>;
  lastCommittedMessagesScrollTopRef: React.RefObject<number>;
  setMessagesScrollTop: React.Dispatch<React.SetStateAction<number>>;
}

export function restoreConversationReadingPosition({ chatScrollRef, messagesViewportRef, selectedLink, activeConversation, messages, userScrolledUpRef, userSentMessageRef, loadingConversation, chatReadingPositionsRef, scrollMessagesToBottom, setShowScrollToBottomButton, programmaticScrollRef, preservingHistoryScrollRef, hasMoreMessagesBefore, loadingOlderMessages, loadOlderMessagesRef, messageVerticalOffset, bannersHeight, messageOffsets, lastObservedMessagesScrollTopRef, lastCommittedMessagesScrollTopRef, setMessagesScrollTop }: RestoreConversationReadingPositionContext): (() => void) | undefined {
  const chat = chatScrollRef.current;
  const viewport = messagesViewportRef.current;
  const canvas = viewport?.querySelector<HTMLElement>("[data-chat-message-canvas]");
  if (!chat || chat.link !== selectedLink || !activeConversation || !viewport || !canvas || !messages.length) return;

  const last = messages[messages.length - 1];
  const lastMessageId = last.localId ?? last.id;
  const newMessage = chat.lastMessageId !== undefined && chat.lastMessageId !== lastMessageId;
  chat.lastMessageId = lastMessageId;
  const followLatest = !userScrolledUpRef.current || userSentMessageRef.current;
  if (followLatest) {
    const behavior = !chat.initial && newMessage && !loadingConversation ? "smooth" : "auto";
    chat.initial = false;
    chatReadingPositionsRef.current.delete(chat.key);
    scrollMessagesToBottom(behavior);
    userSentMessageRef.current = false;
    setShowScrollToBottomButton(false);
    return;
  }
  if (programmaticScrollRef.current || preservingHistoryScrollRef.current) return;

  const saved = chatReadingPositionsRef.current.get(chat.key);
  if (!saved) return;
  const anchor = messages.findIndex(message => message.id === saved.messageId || message.localId === saved.messageId);
  const oldest = messages[0].createdAt;
  if (anchor < 0 && chat.initial && saved.createdAt < oldest && hasMoreMessagesBefore) {
    if (loadingConversation || loadingOlderMessages) return;
    if (chat.requestedBefore !== oldest) {
      const frame = requestAnimationFrame(() => {
        if (chatScrollRef.current !== chat || !chat.initial) return;
        chat.requestedBefore = oldest;
        void loadOlderMessagesRef.current?.();
      });
      return () => cancelAnimationFrame(frame);
    }
  }

  const nearest = anchor >= 0 ? anchor : messages.findIndex(message => message.createdAt >= saved.createdAt);
  const canvasTop = viewport.scrollTop + canvas.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
  viewport.scrollTop = nearest >= 0
    ? canvasTop + messageVerticalOffset + bannersHeight + messageOffsets.offsets[nearest] - saved.offset
    : saved.top;
  chat.initial = false;
  lastObservedMessagesScrollTopRef.current = viewport.scrollTop;
  lastCommittedMessagesScrollTopRef.current = viewport.scrollTop;
  setMessagesScrollTop(viewport.scrollTop);
  setShowScrollToBottomButton(viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > SCROLL_TO_BOTTOM_BUTTON_THRESHOLD);
}

export interface GetMessageRowRefActionContext {
  messageRowRefCallbacksRef: React.RefObject<Record<string, (node: HTMLDivElement | null) => void>>;
  messageRowObserversRef: React.RefObject<Record<string, MessageSizeSubscription>>;
  messageHeightsRef: React.RefObject<Record<string, number>>;
  pendingMeasuredMessageIdsRef: React.RefObject<Set<string>>;
  scheduleMessageMeasureCommit: () => void;
}

export function getMessageRowRefAction({ messageRowRefCallbacksRef, messageRowObserversRef, messageHeightsRef, pendingMeasuredMessageIdsRef, scheduleMessageMeasureCommit }: GetMessageRowRefActionContext, messageId: string, messageLocalId?: string | null): (node: HTMLDivElement | null) => void {
  const observerKey = messageLocalId ?? messageId;
  const existing = messageRowRefCallbacksRef.current[observerKey];
  if (existing) return existing;

  const callback = (node: HTMLDivElement | null) => {
    const activeObserver = messageRowObserversRef.current[observerKey];
    if (activeObserver) {
      activeObserver.disconnect();
      delete messageRowObserversRef.current[observerKey];
    }

    if (!node) {
      return;
    }

    const updateHeight = (measuredHeight: number) => {
      const currentMessageId = node.dataset.messageId ?? messageId;
      const currentLocalId = node.dataset.messageLocalId || messageLocalId || null;
      const nextHeight = Math.max(1, Math.ceil(measuredHeight));
      const heightChanged =
        messageHeightsRef.current[currentMessageId] !== nextHeight ||
        (currentLocalId ? messageHeightsRef.current[currentLocalId] !== nextHeight : false);
      if (heightChanged) {
        messageHeightsRef.current[currentMessageId] = nextHeight;
        if (currentLocalId) {
          messageHeightsRef.current[currentLocalId] = nextHeight;
        }
        pendingMeasuredMessageIdsRef.current.add(observerKey);
        scheduleMessageMeasureCommit();
      }
    };

    messageRowObserversRef.current[observerKey] = observeMessageSize(node, updateHeight);
  };

  messageRowRefCallbacksRef.current[observerKey] = callback;
  return callback;
}

export interface ObserveChatListViewportContext {
  chatListViewportRef: React.RefObject<HTMLDivElement | null>;
  setChatListViewportHeight: React.Dispatch<React.SetStateAction<number>>;
  setChatListScrollTop: React.Dispatch<React.SetStateAction<number>>;
  lastCommittedChatListScrollTopRef: React.RefObject<number>;
  pendingChatListScrollTopRef: React.RefObject<number>;
  lastChatListScrollTopRef: React.RefObject<number>;
  isDesktop: boolean;
  mobileHeaderOffsetRef: React.RefObject<number>;
  pendingMobileHeaderOffsetRef: React.RefObject<number>;
}

export function observeChatListViewport({ chatListViewportRef, setChatListViewportHeight, setChatListScrollTop, lastCommittedChatListScrollTopRef, pendingChatListScrollTopRef, lastChatListScrollTopRef, isDesktop, mobileHeaderOffsetRef, pendingMobileHeaderOffsetRef }: ObserveChatListViewportContext): (() => void) | undefined {
  const viewport = chatListViewportRef.current;
  if (!viewport) return;

  const update = () => {
    const nextTop = Math.max(0, viewport.scrollTop);
    setChatListViewportHeight(viewport.clientHeight);
    setChatListScrollTop(nextTop);
    lastCommittedChatListScrollTopRef.current = nextTop;
    pendingChatListScrollTopRef.current = nextTop;
    lastChatListScrollTopRef.current = nextTop;
    if (!isDesktop) {
      const nextOffset = Math.min(MOBILE_CHAT_HEADER_HIDE_DISTANCE, nextTop);
      mobileHeaderOffsetRef.current = nextOffset;
      pendingMobileHeaderOffsetRef.current = nextOffset;
    } else {
      mobileHeaderOffsetRef.current = 0;
      pendingMobileHeaderOffsetRef.current = 0;
    }
  };

  update();
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => update());
    observer.observe(viewport);
    return () => observer.disconnect();
  }
  return undefined;
}

export interface ResolveAndSyncOwnE2EIdentityActionContext {
  lastOwnE2EFailureRef: React.RefObject<{ at: number; message: string; } | null>;
  resolveOwnE2EInFlightRef: React.RefObject<Promise<E2EIdentity> | null>;
  setPrivateKey: React.Dispatch<React.SetStateAction<CryptoKey | null>>;
  setSelfPublicKey: React.Dispatch<React.SetStateAction<string | null>>;
  setE2EIdentityReady: React.Dispatch<React.SetStateAction<boolean>>;
  decryptedPreviewFingerprintRef: React.RefObject<Record<string, string>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function resolveAndSyncOwnE2EIdentityAction({ lastOwnE2EFailureRef, resolveOwnE2EInFlightRef, setPrivateKey, setSelfPublicKey, setE2EIdentityReady, decryptedPreviewFingerprintRef, t }: ResolveAndSyncOwnE2EIdentityActionContext, options?: { forceServerRestore?: boolean; allowPrompt?: boolean }): Promise<E2EIdentity> {
  const recentFailure = lastOwnE2EFailureRef.current;
  if (recentFailure && Date.now() - recentFailure.at < 10_000) {
    throw new Error(recentFailure.message);
  }
  if (resolveOwnE2EInFlightRef.current) {
    return await resolveOwnE2EInFlightRef.current;
  }

  const run = (async () => {
    const identity = await resolveE2EIdentity({ force: options?.forceServerRestore === true });

    setPrivateKey(identity.privateKey);
    setSelfPublicKey(identity.publicKeyBase64);
    setE2EIdentityReady(true);
    decryptedPreviewFingerprintRef.current = {};
    decryptedPayloadFailureCache.clear();

    return identity;
  })();

  resolveOwnE2EInFlightRef.current = run;
  try {
    const result = await run;
    lastOwnE2EFailureRef.current = null;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : t("Не удалось инициализировать E2E");
    lastOwnE2EFailureRef.current = { at: Date.now(), message };
    throw error;
  } finally {
    if (resolveOwnE2EInFlightRef.current === run) {
      resolveOwnE2EInFlightRef.current = null;
    }
  }
}
