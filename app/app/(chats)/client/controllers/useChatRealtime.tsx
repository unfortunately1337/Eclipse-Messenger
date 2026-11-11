"use client";

import { useCallback, useEffect, useRef } from "react";

import { apiRequest } from "@/lib/client/http";

import { type ConversationChatType } from "../../types";

import { subscribeChatRealtime } from "../chat-realtime";
import { publishTypingActivity } from "../activity-events";
import { handleWallpaperUploadAction, handleApplyPeerWallpaperAction } from "../contact-actions";

import type { MessageReactionsModel } from "./useMessageReactions";
import type { MessageEncryptionModel } from "./useMessageEncryption";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ChatPageStateModel } from "./useChatPageState";
import type { ConversationActionsModel } from "./useConversationActions";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ChatElementStateModel } from "./useChatElementState";
import type { MessageHistoryModel } from "./useMessageHistory";
import type { ChatInteractionModel } from "./useChatInteraction";
import type { ConversationNavigationModel } from "./useConversationNavigation";
import type { ComposerCaptureModel } from "./useComposerCapture";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ChatRealtimeSources {
  reactions: Pick<MessageReactionsModel, "triggerReactionPulse"> & {
    realtimeHandler: Pick<MessageReactionsModel["realtimeHandler"], "ensureSharedKeyForMembersRef" | "rotateSharedKeyRef" | "readProfileFromCacheRef" | "messagesRef" | "animateDeleteMessageRef" | "handleSecretChatExpiredRef" | "decryptMessageWithRecoveryRef" | "ensureOwnE2EReadyRef" | "ensureProfilesBatchRef">;

  };
  encryption: Pick<MessageEncryptionModel, "ensureSharedKeyForMembers" | "rotateSharedKey">;
  bootstrap: Pick<ChatBootstrapModel, "readProfileFromCache" | "loadChatPage" | "loadSecretChatsRef"> & {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "currentUserIdRef" | "currentSessionIdRef">;

  };
  page: Pick<ChatPageStateModel, "t" | "setPollResults" | "setErrorText" | "profileData"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "messages" | "chatsRef" | "activeConversationRef" | "setChats" | "setMessages" | "setActiveConversation" | "activeConversation" | "chats">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile">;
    identity: Pick<ChatPageStateModel["identity"], "cryptoDiagnosticRef" | "privateKeyRef">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "selectedLink" | "messageText">;
    messageInteraction: Pick<ChatPageStateModel["messageInteraction"], "setUnreadByLink" | "setReadMessageIds">;
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "setTypingByLink" | "setRecordingByLink" | "setSendingByLink" | "voiceRecording" | "videoRecording">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "typingResetByLinkRef" | "recordingResetByLinkRef" | "sendingResetByLinkRef" | "typingStopTimerRef" | "recordingHeartbeatRef" | "sendingHeartbeatRef" | "lastTypingValueRef" | "lastTypingSentAtRef">;
    groupDetails: Pick<ChatPageStateModel["groupDetails"], "setGroupModalData">;
    mediaAndChannel: Pick<ChatPageStateModel["mediaAndChannel"], "setChannelModalData">;
    secretChatDraft: Pick<ChatPageStateModel["secretChatDraft"], "setSecretChatExpiresAt">;
    panels: Pick<ChatPageStateModel["panels"], "isDesktop">;
    wallpaperUpload: Pick<ChatPageStateModel["wallpaperUpload"], "wallpaperTargetRef" | "setUploadingWallpaper" | "setApplyingWallpaper">;

  };
  messageActions: Pick<ConversationActionsModel, "animateDeleteMessage">;
  active: Pick<ActiveConversationModel, "handleSecretChatExpired" | "activeChat">;
  elements: Pick<ChatElementStateModel, "isMessageMarkedDeleted" | "sanitizeMessages"> & {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "pusherRef" | "realtimeSelfIdRef" | "groupModalCacheRef" | "channelModalCacheRef" | "decryptedPreviewFingerprintRef">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "inflightHydrationRef" | "openConversationRef">;
    mediaRecorder: Pick<ChatElementStateModel["mediaRecorder"], "sendingRealtimeKind">;

  };
  history: Pick<MessageHistoryModel, "buildSharedChatKeyId" | "loadSharedKeyByVersion" | "ensureSharedKeyFromServer" | "sharedKeyServerCacheRef">;
  callbacks: Pick<ChatPageCallbacks, "sendReadReceipt">;
  interaction: Pick<ChatInteractionModel, "setReadReceiptMarker" | "removeDirectChatLocally">;
  navigation: Pick<ConversationNavigationModel, "conversationDecryptRetryRef">;
  capture: Pick<ComposerCaptureModel, "pushRecording" | "pushSending">;
}

export interface ChatRealtimeModel {
  handleWallpaperUpload: (file: File) => Promise<void>;
  handleApplyPeerWallpaper: (url: string, posY?: number | undefined) => Promise<void>;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useChatRealtime(sources: ChatRealtimeSources): ChatRealtimeModel {
  const { triggerReactionPulse } = sources.reactions;
  const { ensureSharedKeyForMembersRef, rotateSharedKeyRef, readProfileFromCacheRef, messagesRef, animateDeleteMessageRef, handleSecretChatExpiredRef, decryptMessageWithRecoveryRef, ensureOwnE2EReadyRef, ensureProfilesBatchRef } = sources.reactions.realtimeHandler;
  const { ensureSharedKeyForMembers, rotateSharedKey } = sources.encryption;
  const { readProfileFromCache, loadChatPage, loadSecretChatsRef } = sources.bootstrap;
  const { currentUserIdRef, currentSessionIdRef } = sources.bootstrap.accountNavigation;
  const { t, setPollResults, setErrorText, profileData } = sources.page;
  const { messages, chatsRef, activeConversationRef, setChats, setMessages, setActiveConversation, activeConversation, chats } = sources.page.conversation;
  const { selfId, selfProfile } = sources.page.account;
  const { cryptoDiagnosticRef, privateKeyRef } = sources.page.identity;
  const { selectedLinkRef, selectedLink, messageText } = sources.page.selection;
  const { setUnreadByLink, setReadMessageIds } = sources.page.messageInteraction;
  const { setTypingByLink, setRecordingByLink, setSendingByLink, voiceRecording, videoRecording } = sources.page.recorderPresentation;
  const { typingResetByLinkRef, recordingResetByLinkRef, sendingResetByLinkRef, typingStopTimerRef, recordingHeartbeatRef, sendingHeartbeatRef, lastTypingValueRef, lastTypingSentAtRef } = sources.page.composerInteraction;
  const { setGroupModalData } = sources.page.groupDetails;
  const { setChannelModalData } = sources.page.mediaAndChannel;
  const { setSecretChatExpiresAt } = sources.page.secretChatDraft;
  const { isDesktop } = sources.page.panels;
  const { wallpaperTargetRef, setUploadingWallpaper, setApplyingWallpaper } = sources.page.wallpaperUpload;
  const { animateDeleteMessage } = sources.messageActions;
  const { handleSecretChatExpired, activeChat } = sources.active;
  const { isMessageMarkedDeleted, sanitizeMessages } = sources.elements;
  const { pusherRef, realtimeSelfIdRef, groupModalCacheRef, channelModalCacheRef, decryptedPreviewFingerprintRef } = sources.elements.conversationElement;
  const { inflightHydrationRef, openConversationRef } = sources.elements.conversationRequest;
  const { sendingRealtimeKind } = sources.elements.mediaRecorder;
  const { buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, sharedKeyServerCacheRef } = sources.history;
  const { sendReadReceipt } = sources.callbacks;
  const { setReadReceiptMarker, removeDirectChatLocally } = sources.interaction;
  const { conversationDecryptRetryRef } = sources.navigation;
  const { pushRecording, pushSending } = sources.capture;

  useEffect(() => {
    ensureSharedKeyForMembersRef.current = ensureSharedKeyForMembers;
  }, [ensureSharedKeyForMembers]);

  useEffect(() => {
    rotateSharedKeyRef.current = rotateSharedKey;
  }, [rotateSharedKey]);

  useEffect(() => {
    readProfileFromCacheRef.current = readProfileFromCache;
  }, [readProfileFromCache]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    animateDeleteMessageRef.current = animateDeleteMessage;
  }, [animateDeleteMessage]);

  useEffect(() => {
    handleSecretChatExpiredRef.current = handleSecretChatExpired;
  }, [handleSecretChatExpired]);

  useEffect(() => {
    return subscribeChatRealtime({ selfId, pusherRef, realtimeSelfIdRef, chatsRef, activeConversationRef, buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, cryptoDiagnosticRef, inflightHydrationRef, privateKeyRef, decryptMessageWithRecoveryRef, ensureOwnE2EReadyRef, t, handleSecretChatExpiredRef, ensureProfilesBatchRef, selfProfile, currentUserIdRef, setChats, selectedLinkRef, setUnreadByLink, isMessageMarkedDeleted, setMessages, sanitizeMessages, sendReadReceipt, readProfileFromCacheRef, loadChatPage, currentSessionIdRef, handleSecretChatExpired, setReadMessageIds, setReadReceiptMarker, setTypingByLink, typingResetByLinkRef, setRecordingByLink, recordingResetByLinkRef, setSendingByLink, sendingResetByLinkRef, animateDeleteMessageRef, setPollResults, messagesRef, triggerReactionPulse, removeDirectChatLocally, setActiveConversation, setGroupModalData, groupModalCacheRef, setChannelModalData, channelModalCacheRef, sharedKeyServerCacheRef, conversationDecryptRetryRef, decryptedPreviewFingerprintRef, openConversationRef, rotateSharedKeyRef, ensureSharedKeyForMembersRef, setSecretChatExpiresAt, loadSecretChatsRef, setErrorText, typingStopTimerRef, recordingHeartbeatRef, sendingHeartbeatRef });
  }, [selfId, t]);

  const pushTyping = useCallback(
    async (isTyping: boolean) => {
      if (!activeChat?.link) return;
      if (activeChat.chatType === "channel" || activeChat.chatType === "saved" || activeChat.chatType === "eclipse") return;
      try {
        await apiRequest("/api/realtime/typing", {
          method: "POST",
          body: JSON.stringify({ link: activeChat.link, chatType: activeChat.chatType, isTyping }),
        });
      } catch {
        // typing event is best-effort
      }
    },
    [activeChat?.chatType, activeChat?.link],
  );

  const stopTyping = useCallback(async (link?: string | null, chatType?: ConversationChatType) => {
    if (!link || !chatType || chatType === "channel" || chatType === "saved" || chatType === "eclipse") return;
    try {
      await apiRequest("/api/realtime/typing", {
        method: "POST",
        body: JSON.stringify({ link, chatType, isTyping: false }),
      });
    } catch {
      // best-effort
    }
  }, []);

  const lastTypingChatRef = useRef<{
    link: string;
    chatType: ConversationChatType

  } | null>(null);

  useEffect(() => {
    const currentLink = activeChat?.link ?? null;
    const currentType = activeChat?.chatType ?? null;
    const prev = lastTypingChatRef.current;
    if (prev && (prev.link !== currentLink || prev.chatType !== currentType)) {
      if (lastTypingValueRef.current) {
        lastTypingValueRef.current = false;
        void stopTyping(prev.link, prev.chatType);
      }
    }
    if (currentLink && currentType) {
      lastTypingChatRef.current = { link: currentLink, chatType: currentType };
    }

    return () => {
      if (lastTypingChatRef.current && lastTypingValueRef.current) {
        const last = lastTypingChatRef.current;
        lastTypingValueRef.current = false;
        void stopTyping(last.link, last.chatType);
      }
    };
  }, [activeChat?.chatType, activeChat?.link, stopTyping]);

  useEffect(() => {
    return publishTypingActivity({ activeChat, activeConversation, typingStopTimerRef, isDesktop, selectedLink, messageText, lastTypingValueRef, lastTypingSentAtRef, pushTyping });
  }, [activeChat?.chatType, activeChat?.link, activeConversation?.chatType, isDesktop, messageText, pushTyping, selectedLink]);

  useEffect(() => {
    if (recordingHeartbeatRef.current) {
      clearInterval(recordingHeartbeatRef.current);
      recordingHeartbeatRef.current = null;
    }

    const mode = voiceRecording ? "voice" : videoRecording ? "video" : null;
    if (!mode) {
      return;
    }

    recordingHeartbeatRef.current = setInterval(() => {
      void pushRecording(mode, true);
    }, 1800);

    return () => {
      if (recordingHeartbeatRef.current) {
        clearInterval(recordingHeartbeatRef.current);
        recordingHeartbeatRef.current = null;
      }
    };
  }, [pushRecording, videoRecording, voiceRecording]);

  useEffect(() => {
    if (sendingHeartbeatRef.current) {
      clearInterval(sendingHeartbeatRef.current);
      sendingHeartbeatRef.current = null;
    }

    if (!sendingRealtimeKind) {
      return;
    }

    sendingHeartbeatRef.current = setInterval(() => {
      void pushSending(sendingRealtimeKind, true);
    }, 2500);

    return () => {
      if (sendingHeartbeatRef.current) {
        clearInterval(sendingHeartbeatRef.current);
        sendingHeartbeatRef.current = null;
      }
    };
  }, [pushSending, sendingRealtimeKind]);

  const handleWallpaperUpload = useCallback(async (file: File) => {
    return handleWallpaperUploadAction({ wallpaperTargetRef, activeChat, profileData, t, chats, setActiveConversation, setChats, setUploadingWallpaper, activeConversationRef, setMessages, sanitizeMessages }, file);
  }, [activeChat?.link, profileData?.link, chats, t]);

  const handleApplyPeerWallpaper = useCallback(async (url: string, posY?: number) => {
    return handleApplyPeerWallpaperAction({ activeChat, profileData, setActiveConversation, setChats, setApplyingWallpaper, t }, url, posY);
  }, [activeChat?.link, profileData?.link, t]);

  return {
    handleWallpaperUpload,
    handleApplyPeerWallpaper
  };
}
