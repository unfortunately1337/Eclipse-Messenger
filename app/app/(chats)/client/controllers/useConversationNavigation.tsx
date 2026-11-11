"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { cacheConversationSnapshot } from "../chat-cache";

import { resetConversationViewport, retryConversationDecryption, positionMessageContextMenu } from "../attachment-actions";

import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ChatElementStateModel } from "./useChatElementState";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ChatInteractionModel } from "./useChatInteraction";
import type { MessageHistoryModel } from "./useMessageHistory";
import type { ChatPagePresentationModel } from "./useChatPagePresentation";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ConversationNavigationSources {
  page: Pick<ChatPageStateModel, "requestedChatLink" | "requestedChatType" | "setProfileData" | "setMessageHelperReadListOpen" | "chatListMenuOpen" | "setChatListMenuOpen"> & {
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "selectedLinkChangedAtRef" | "setSelectedLink" | "selectedLink" | "selectedSearchTargetRef">;
    account: Pick<ChatPageStateModel["account"], "selfId">;
    contactEditor: Pick<ChatPageStateModel["contactEditor"], "setContactEditorTarget">;
    panels: Pick<ChatPageStateModel["panels"], "setDesktopDetailsPanelOpen">;
    appearance: Pick<ChatPageStateModel["appearance"], "setMessageHelperId" | "messageHelperId" | "desktopMessageHelperRef">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "setStickerPickerOpen" | "stickerPickerOpen">;
    conversation: Pick<ChatPageStateModel["conversation"], "setAttachmentMenuOpen" | "setActiveConversation" | "setMessages" | "messages" | "activeConversation">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "setDecryptingConversation" | "loadingConversation" | "decryptingConversation">;
    identity: Pick<ChatPageStateModel["identity"], "e2eIdentityReady">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "setUnreadByLink" | "readMarkersRef" | "setMessageHelperHorizontalPlacement">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryReplyTarget">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "isCoarsePointer">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "pickedFilesProcessingRef" | "setDragActive">;

  };
  bootstrap: {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "suppressRequestedChatSyncRef" | "currentUserIdRef">;

  };
  elements: {
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "bottomScrollAnimationRef" | "isScrollingToBottomRef" | "programmaticScrollRef" | "userScrolledUpRef" | "lastObservedMessagesScrollTopRef" | "messagesAtBottomRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "lastHandledSelectedLinkRef" | "preservingHistoryScrollRef" | "prependScrollSnapshotRef" | "openConversationRef">;
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "chatScrollRef" | "chatReadingPositionsRef" | "messagesViewportRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "setHasMoreMessagesBefore" | "setLoadingOlderMessages" | "setShowScrollToBottomButton" | "lastCommittedMessagesScrollTopRef" | "setMessagesScrollTop">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "userSentMessageRef" | "footerRef">;

  };
  active: Pick<ActiveConversationModel, "selectedChat">;
  interaction: Pick<ChatInteractionModel, "setReadMarker">;
  callbacks: Pick<ChatPageCallbacks, "sendReadReceipt">;
}

export interface ConversationNavigationDeferred {
  readonly history: Pick<MessageHistoryModel, "sharedKeyServerCacheRef">;
  readonly view: Pick<ChatPagePresentationModel, "canDropChatFiles">;
}
export interface ConversationNavigationModel {
  conversationDecryptRetryRef: React.RefObject<Record<string, {
    fingerprint: string;
    attempts: number;
    lastAttemptAt: number;

  }>>;
  isFileDrag: (e: React.DragEvent<Element>) => boolean;
  handleDragEnter: (e: React.DragEvent<Element>) => void;
  handleDragLeave: (e: React.DragEvent<Element>) => void;
  handleDragOver: (e: React.DragEvent<Element>) => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useConversationNavigation(sources: ConversationNavigationSources, deferred: ConversationNavigationDeferred): ConversationNavigationModel {
  const { requestedChatLink, requestedChatType, setProfileData, setMessageHelperReadListOpen, chatListMenuOpen, setChatListMenuOpen } = sources.page;
  const { selectedLinkRef, selectedLinkChangedAtRef, setSelectedLink, selectedLink, selectedSearchTargetRef } = sources.page.selection;
  const { selfId } = sources.page.account;
  const { setContactEditorTarget } = sources.page.contactEditor;
  const { setDesktopDetailsPanelOpen } = sources.page.panels;
  const { setMessageHelperId, messageHelperId, desktopMessageHelperRef } = sources.page.appearance;
  const { setStickerPickerOpen, stickerPickerOpen } = sources.page.attachmentDraft;
  const { setAttachmentMenuOpen, setActiveConversation, setMessages, messages, activeConversation } = sources.page.conversation;
  const { setDecryptingConversation, loadingConversation, decryptingConversation } = sources.page.conversationRequest;
  const { e2eIdentityReady } = sources.page.identity;
  const { setUnreadByLink, readMarkersRef, setMessageHelperHorizontalPlacement } = sources.page.messageInteraction;
  const { setStoryReplyTarget } = sources.page.storyDraft;
  const { isCoarsePointer } = sources.page.mediaAndChannel;
  const { pickedFilesProcessingRef, setDragActive } = sources.page.wallpaperUpload;
  const { suppressRequestedChatSyncRef, currentUserIdRef } = sources.bootstrap.accountNavigation;
  const { bottomScrollAnimationRef, isScrollingToBottomRef, programmaticScrollRef, userScrolledUpRef, lastObservedMessagesScrollTopRef, messagesAtBottomRef } = sources.elements.conversationScroll;
  const { lastHandledSelectedLinkRef, preservingHistoryScrollRef, prependScrollSnapshotRef, openConversationRef } = sources.elements.conversationRequest;
  const { chatScrollRef, chatReadingPositionsRef, messagesViewportRef } = sources.elements.conversationElement;
  const { setHasMoreMessagesBefore, setLoadingOlderMessages, setShowScrollToBottomButton, lastCommittedMessagesScrollTopRef, setMessagesScrollTop } = sources.elements.storyAndViewport;
  const { userSentMessageRef, footerRef } = sources.elements.messageDelivery;
  const { selectedChat } = sources.active;
  const { setReadMarker } = sources.interaction;
  const { sendReadReceipt } = sources.callbacks;

  const conversationDecryptRetryRef = useRef<
    Record<string, {
      fingerprint: string;
      attempts: number;
      lastAttemptAt: number

    }>
  >({});

  useEffect(() => {
    const normalizedSelectedLink = selectedLinkRef.current?.trim().toLowerCase() ?? null;
    const normalizedRequested = requestedChatLink ?? null;
    if (suppressRequestedChatSyncRef.current) {
      if (!normalizedRequested) {
        suppressRequestedChatSyncRef.current = false;
      }
      return;
    }
    if (
      normalizedSelectedLink &&
      normalizedRequested &&
      normalizedSelectedLink !== normalizedRequested &&
      Date.now() - selectedLinkChangedAtRef.current < 700
    ) {
      return;
    }
    if (normalizedSelectedLink === normalizedRequested) return;

    setSelectedLink(normalizedRequested);
  }, [requestedChatLink]);

  useLayoutEffect(() => {
    return resetConversationViewport({ selectedLink, bottomScrollAnimationRef, isScrollingToBottomRef, programmaticScrollRef, lastHandledSelectedLinkRef, chatScrollRef, setHasMoreMessagesBefore, setLoadingOlderMessages, setShowScrollToBottomButton, selectedSearchTargetRef, selectedChat, requestedChatType, selfId, currentUserIdRef, chatReadingPositionsRef, setProfileData, setContactEditorTarget, setDesktopDetailsPanelOpen, userScrolledUpRef, userSentMessageRef, lastObservedMessagesScrollTopRef, lastCommittedMessagesScrollTopRef, setMessagesScrollTop, messagesAtBottomRef, preservingHistoryScrollRef, prependScrollSnapshotRef, setMessageHelperId, setStickerPickerOpen, setAttachmentMenuOpen, setActiveConversation, setMessages, setDecryptingConversation, openConversationRef });
  }, [requestedChatType, selectedChat?.chatType, selectedLink, selfId]);

  useEffect(() => {
    return retryConversationDecryption({ selectedLink, e2eIdentityReady, loadingConversation, decryptingConversation, messages, activeConversation, conversationDecryptRetryRef, selectedLinkRef, sharedKeyServerCacheRef: deferred.history.sharedKeyServerCacheRef, openConversationRef });
  }, [activeConversation?.chatType, activeConversation?.channel?.isSubscribed, activeConversation?.group?.myRole, decryptingConversation, e2eIdentityReady, loadingConversation, messages, selectedLink]);

  useEffect(() => {
    if (!selfId || !activeConversation || messages.length === 0) return;
    if (decryptingConversation) return;

    const link =
      activeConversation.chatType === "group"
        ? activeConversation.group?.link
        : activeConversation.chatType === "channel"
          ? activeConversation.channel?.link
          : activeConversation.chatType === "saved"
            ? activeConversation.saved?.link
            : activeConversation.chatType === "eclipse"
              ? activeConversation.eclipse?.link
              : activeConversation.peer?.link;
    if (!link) return;

    cacheConversationSnapshot(
      selfId,
      link,
      {
        savedAt: Date.now(),
        conversation: activeConversation,
        messages,
      },
      activeConversation.chatType,
    );
  }, [messages, activeConversation, selfId, decryptingConversation]);

  useEffect(() => {
    if (!selectedLink) return;
    setUnreadByLink((prev) => {
      if (prev[selectedLink] === 0) return prev;
      return { ...prev, [selectedLink]: 0 };
    });
  }, [selectedLink]);

  useEffect(() => {
    setStoryReplyTarget(null);
  }, [selectedLink]);

  useEffect(() => {
    if (!selectedLink) return;
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.createdAt) return;
    if (readMarkersRef.current[selectedLink] === lastMessage.createdAt) return;
    setReadMarker(selectedLink, lastMessage.createdAt);
  }, [messages, selectedLink, setReadMarker]);

  useEffect(() => {
    const type = activeConversation?.chatType;
    if (!selectedLink || !selfId || loadingConversation || !(type === "eclipse" || type === "direct" && activeConversation?.peer?.isBot)) return;
    const mark = () => {
      if (document.visibilityState !== "visible" || selectedLinkRef.current !== selectedLink) return;
      const ids = messages.filter(message => !message.pending && message.senderId !== selfId).map(message => message.id);
      if (ids.length) void sendReadReceipt(selectedLink, type, ids);
    };
    mark(); window.addEventListener("focus", mark); document.addEventListener("visibilitychange", mark);
    return () => { window.removeEventListener("focus", mark); document.removeEventListener("visibilitychange", mark); };
    // sendReadReceipt uses refs and does not carry any additional chat state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.chatType, activeConversation?.peer?.isBot, loadingConversation, messages, selectedLink, selfId]);

  useEffect(() => {
    setMessageHelperReadListOpen(false);
  }, [messageHelperId]);

  useEffect(() => {
    if (!messageHelperId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-message-helper='true'], [data-reaction-button='true']")) {
        return;
      }
      if (target?.closest("[data-message-helper-anchor='true']")) {
        return;
      }
      setMessageHelperId(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [messageHelperId]);

  useLayoutEffect(() => {
    if (!messageHelperId || isCoarsePointer) return;
    const menu = desktopMessageHelperRef.current;
    const viewport = messagesViewportRef.current;
    if (!menu || !viewport) return;
    const fit = () => {
      const bounds = viewport.getBoundingClientRect();
      const minTop = Math.max(8, bounds.top + 8);
      const composerTop = footerRef.current?.getBoundingClientRect().top ?? bounds.bottom;
      const maxBottom = Math.min(window.innerHeight - 8, bounds.bottom - 8, composerTop - 8);
      menu.style.maxHeight = Math.max(80, maxBottom - minTop) + "px";
      // Layout dimensions exclude the popup's opening scale/translation.
      const top = parseFloat(menu.style.top) || minTop;
      const left = parseFloat(menu.style.left) || bounds.left + 8;
      menu.style.top = Math.round(Math.max(minTop, Math.min(top, maxBottom - menu.offsetHeight))) + "px";
      menu.style.left = Math.round(Math.max(bounds.left + 8, Math.min(left, bounds.right - menu.offsetWidth - 8))) + "px";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(menu);
    observer.observe(viewport);
    if (footerRef.current) observer.observe(footerRef.current);
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, [messageHelperId, isCoarsePointer]);

  useEffect(() => {
    return positionMessageContextMenu({ messageHelperId, messagesViewportRef, isCoarsePointer, setMessageHelperHorizontalPlacement });
  }, [isCoarsePointer, messageHelperId]);

  useEffect(() => {
    if (!messageHelperId) return;

    const openedAt = Date.now();
    const closeHelper = () => setMessageHelperId(null);
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.("[data-message-helper='true']")) return;
      if (Date.now() - openedAt < 220) return;
      closeHelper();
    };
    const onTouchMove = () => {
      if (Date.now() - openedAt < 220) return;
      closeHelper();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [messageHelperId]);

  useEffect(() => {
    if (!chatListMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-chat-list-menu='true']")) {
        return;
      }
      setChatListMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [chatListMenuOpen]);

  useEffect(() => {
    if (!stickerPickerOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-sticker-picker='true']") ||
        target?.closest("[data-sticker-picker-toggle='true']")
      ) {
        return;
      }
      setStickerPickerOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [stickerPickerOpen]);

  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    if (!deferred.view.canDropChatFiles || pickedFilesProcessingRef.current) return;
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Child-to-child transitions are not exits from the chat drop zone.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom) return;
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = deferred.view.canDropChatFiles && !pickedFilesProcessingRef.current ? "copy" : "none";
    if (deferred.view.canDropChatFiles && !pickedFilesProcessingRef.current) setDragActive(true);
  };

  return {
    conversationDecryptRetryRef,
    isFileDrag,
    handleDragEnter,
    handleDragLeave,
    handleDragOver
  };
}
