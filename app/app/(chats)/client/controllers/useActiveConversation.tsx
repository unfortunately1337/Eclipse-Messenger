"use client";

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { useCalls } from "../../hooks/useCalls";

import { getPanelVisualStyle } from "@/lib/client/panel-visual";

import { showAppToast } from "@/lib/client/app-toast";

import { type ChatSummary } from "../../types";

import { activeChatAction, handleSecretChatExpiredAction } from "../chat-lifecycle";

import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatElementStateModel } from "./useChatElementState";

export interface ActiveConversationSources {
  page: Pick<ChatPageStateModel, "profileData" | "requestedChatType" | "t" | "transparentVisual"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "chats" | "activeConversation" | "setMessages" | "activeConversationRef" | "setActiveConversation" | "setChats">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLink" | "setMessageText" | "selectedLinkRef" | "setSelectedLink">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    notificationAndContacts: Pick<ChatPageStateModel["notificationAndContacts"], "liveBackgroundPreset">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "setLoadingConversation" | "setDecryptingConversation">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "setImageViewer" | "setVideoViewer">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "setEditTarget" | "setReplyToMessageId">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "setReadMessageIds">;

  };
  elements: Pick<ChatElementStateModel, "scrollMessagesToBottom"> & {
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "conversationRequestSeqRef">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "footerRef" | "setFooterHeight" | "footerHeight">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "messageInputRef" | "messagesViewportHeight">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "messagesAtBottomRef">;

  };
}

export interface ActiveConversationModel {
  selectedChat: import("@/app/app/(chats)/types").ChatSummary | null;
  activeChat: import("@/app/app/(chats)/types").ChatSummary | null;
  calls: ReturnType<typeof useCalls>;
  isDirectChatActive: boolean;
  currentChatWallpaper: string | null;
  currentChatWallpaperPosY: number;
  leftSidebarThemeStyle: React.CSSProperties | undefined;
  desktopDetailsPanelThemeStyle: React.CSSProperties | undefined;
  chatProfileModalThemeStyle: React.CSSProperties | undefined;
  expiringChatId: string | null;
  handleSecretChatExpired: (expiredChatId?: string | undefined) => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useActiveConversation(sources: ActiveConversationSources): ActiveConversationModel {
  const { profileData, requestedChatType, t, transparentVisual } = sources.page;
  const { chats, activeConversation, setMessages, activeConversationRef, setActiveConversation, setChats } = sources.page.conversation;
  const { selectedLink, setMessageText, selectedLinkRef, setSelectedLink } = sources.page.selection;
  const { selfId, selfProfile } = sources.page.account;
  const { liveBackgroundPreset } = sources.page.notificationAndContacts;
  const { setLoadingConversation, setDecryptingConversation } = sources.page.conversationRequest;
  const { setImageViewer, setVideoViewer } = sources.page.mediaAndChannel;
  const { setEditTarget, setReplyToMessageId } = sources.page.composerInteraction;
  const { setReadMessageIds } = sources.page.messageInteraction;
  const { scrollMessagesToBottom } = sources.elements;
  const { conversationRequestSeqRef } = sources.elements.conversationRequest;
  const { footerRef, setFooterHeight, footerHeight } = sources.elements.messageDelivery;
  const { messageInputRef, messagesViewportHeight } = sources.elements.storyAndViewport;
  const { messagesAtBottomRef } = sources.elements.conversationScroll;

  const selectedChat = chats.find((chat) => chat.link === selectedLink) ?? null;

  const activeChat = useMemo<ChatSummary | null>(
    () => {
      return activeChatAction({ selectedChat, profileData, activeConversation, selectedLink, selfId, requestedChatType });
    },
    [activeConversation, profileData, requestedChatType, selectedChat, selectedLink, selfId],
  );

  const contactChat = activeChat;

  const callTarget = useMemo(() => {
    if (!activeChat || activeChat.isBot || activeChat.isSystem || activeChat.link.startsWith("secret-")) return null;
    if (activeChat.chatType === "group") return { kind: "group" as const, link: activeChat.link, title: activeChat.displayName };
    if (activeChat.canSendMessages === false) return null;
    if ((!activeChat.chatType || activeChat.chatType === "direct") && activeChat.peerId !== selfId) return {
      kind: "direct" as const, link: activeChat.link, title: activeChat.displayName,
      peer: { id: activeChat.peerId, name: activeChat.displayName, avatarUrl: activeChat.avatarUrl ?? null, backgroundUrl: null }
    };
    return null;
  }, [activeChat, selfId]);

  const calls = useCalls(selfId, callTarget, selfProfile ? { name: selfProfile.displayName, avatarUrl: selfProfile.avatarUrl ?? null } : undefined);

  useEffect(() => {
    if (!calls.error) return;
    showAppToast({ type: "error", title: t(calls.error), durationMs: 5000 });
    calls.clearError();
  }, [calls.error, calls.clearError, t]);

  const isDirectChatActive = Boolean(
    activeChat && (activeChat.chatType === "direct" || (!activeChat.chatType && activeConversation?.chatType === "direct"))
  );

  const currentChatWallpaper = isDirectChatActive ? (activeConversation?.wallpaperUrl || activeChat?.wallpaperUrl || null) : null;

  const currentChatWallpaperPosY = isDirectChatActive ? (activeConversation?.wallpaperPosY ?? activeChat?.wallpaperPosY ?? 50) : 50;

  const selfProfileCardThemeStyle = useMemo<CSSProperties | undefined>(() => {
    if (liveBackgroundPreset === "none") return undefined;
    return {
      backgroundColor: "transparent",
    };
  }, [liveBackgroundPreset]);

  const leftSidebarThemeStyle = useMemo<CSSProperties | undefined>(() => {
    return getPanelVisualStyle(transparentVisual);
  }, [transparentVisual]);

  const desktopDetailsPanelThemeStyle = leftSidebarThemeStyle;

  const chatProfileModalThemeStyle = leftSidebarThemeStyle;

  const [expiringChatId, setExpiringChatId] = useState<string | null>(null);

  const handleSecretChatExpired = useCallback((expiredChatId?: string) => {
    return handleSecretChatExpiredAction({ activeChat, selfId, conversationRequestSeqRef, setLoadingConversation, setDecryptingConversation, setMessages, setImageViewer, setVideoViewer, setEditTarget, setReplyToMessageId, setMessageText, setExpiringChatId, selectedLinkRef, activeConversationRef, setSelectedLink, setActiveConversation, setReadMessageIds, setChats }, expiredChatId);
  }, [activeChat, selfId]);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.clientHeight;
        if (height > 0) {
          setFooterHeight(previous => previous === height ? previous : height);
        }
      }
    });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [activeChat?.link, activeChat?.chatType]);

  useLayoutEffect(() => {
    const textarea = messageInputRef.current;
    if (!textarea) return;
    const maxHeight = Math.max(120, Math.floor(messagesViewportHeight * 0.3));
    textarea.style.maxHeight = `${maxHeight}px`;
  }, [messagesViewportHeight, selectedLink, activeConversation?.chatType]);

  useEffect(() => {
    if (messagesAtBottomRef.current) {
      scrollMessagesToBottom("auto");
      const t1 = setTimeout(() => scrollMessagesToBottom("auto"), 50);
      const t2 = setTimeout(() => scrollMessagesToBottom("auto"), 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [footerHeight, scrollMessagesToBottom]);

  return {
    selectedChat,
    activeChat,
    calls,
    isDirectChatActive,
    currentChatWallpaper,
    currentChatWallpaperPosY,
    leftSidebarThemeStyle,
    desktopDetailsPanelThemeStyle,
    chatProfileModalThemeStyle,
    expiringChatId,
    handleSecretChatExpired
  };
}
