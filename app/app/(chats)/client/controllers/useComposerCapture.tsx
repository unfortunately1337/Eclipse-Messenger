"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect } from "react";

import { replaceRecordingCamera, type RecordingCameraRequest } from "@/lib/client/recording-camera";

import { apiRequest } from "@/lib/client/http";

import { showAppToast } from "@/lib/client/app-toast";

import { type RealtimeSendingPayload } from "../../types";

import { VOICE_MAX_DURATION_MS, VIDEO_MAX_DURATION_MS } from "../config";

import { flushRecorderThenStop } from "../media-recording";

import { decryptSharedChatPreviews, pushOptimisticMessageAction } from "../message-crypto";
import { sendPreparedMessageAction } from "../send-message";
import { readFailedMessages, rememberOutgoingMessage, forgetOutgoingMessage } from "@/lib/client/failed-message-store";
import { mergeMessageWindow } from "../../chat-message-state";
import {
  stopVoiceStreamAction,
  stopVideoStreamAction,
  attachVideoPreviewStreamAction,
  requestVideoRecorderStreamAction,
  sendRecordedMediaAction,
  finishVoiceRecordingAction,
  startVoiceRecordingAction,
  startVideoRecordingForStreamAction,
  openVideoRecorderAction,
  finishVideoRecordingAction,
  handleMicPointerDownAction,
  handleMicPointerMoveAction,
  handleMicPointerUpAction,
  handleMicPointerCancelAction,
  bindRecordingGestures,
  refreshSystemBotCommands
} from "../recording-actions";

import type { ChatPageStateModel } from "./useChatPageState";
import type { ChatElementStateModel } from "./useChatElementState";
import type { MessageHistoryModel } from "./useMessageHistory";
import type { ChatBootstrapModel } from "./useChatBootstrap";
import type { ActiveConversationModel } from "./useActiveConversation";
import type { ConversationPresentationModel } from "./useConversationPresentation";
import type { MessageEncryptionModel } from "./useMessageEncryption";
import type { ChatPageCallbacks } from "./chat-page-callbacks";

export interface ComposerCaptureSources {
  page: Pick<ChatPageStateModel, "t" | "beginMessageSend" | "endMessageSend" | "setErrorText"> & {
    conversation: Pick<ChatPageStateModel["conversation"], "chats" | "setChats" | "messages" | "setMessages" | "activeConversation" | "setActiveConversation" | "activeConversationRef">;
    identity: Pick<ChatPageStateModel["identity"], "cryptoDiagnosticRef">;
    account: Pick<ChatPageStateModel["account"], "selfId" | "selfProfile" | "setActiveUnreadCount" | "animatedMessageIdsRef">;
    composerInteraction: Pick<ChatPageStateModel["composerInteraction"], "replyToMessageId" | "setReplyToMessageId" | "voiceHoldActiveRef" | "voiceStartInProgressRef" | "setVideoRecordingMs" | "videoOpenInProgressRef" | "videoFacingMode" | "videoRecordingMs" | "setVideoFacingMode">;
    selection: Pick<ChatPageStateModel["selection"], "selectedLinkRef" | "setMessageText" | "messageText">;
    storyDraft: Pick<ChatPageStateModel["storyDraft"], "setStoryReplyTarget">;
    attachmentDraft: Pick<ChatPageStateModel["attachmentDraft"], "setPendingImage" | "setPendingVideo" | "setPendingAudio" | "setPendingFile" | "setPendingMediaBatch" | "pendingMediaBatch" | "pendingImage" | "pendingVideo" | "pendingAudio" | "pendingFile">;
    panels: Pick<ChatPageStateModel["panels"], "pendingDeleteRef" | "chatActionPanelTimeoutRef">;
    recorderPresentation: Pick<ChatPageStateModel["recorderPresentation"], "setVoiceRecordingStream" | "setVoiceRecording" | "setVoiceRecordingLocked" | "setVideoRecordingStream" | "setVideoRecording" | "setVideoRecordingLocked" | "setVideoRecorderOpen" | "voiceRecordingMs" | "voiceRecording" | "recordingLocksRef" | "setVoiceRecordingMs" | "videoRecording" | "videoRecorderOpen" | "setVideoCameraSwitching" | "setRecordModeHintUntil" | "composerRecordMode" | "voiceRecordingLocked" | "videoRecordingLocked" | "setComposerRecordMode">;
    conversationRequest: Pick<ChatPageStateModel["conversationRequest"], "setSendingMedia" | "syncing" | "sending">;

  };
  elements: Pick<ChatElementStateModel, "sanitizeMessages" | "isMessageMarkedDeleted" | "markMessageDeletedTombstone"> & {
    conversationElement: Pick<ChatElementStateModel["conversationElement"], "decryptedPreviewFingerprintRef" | "peerPublicKeyByLinkRef" | "videoPreviewRef" | "skipMicTapRef" | "activeVideoDeviceIdRef" | "videoInputDeviceIdsRef" | "videoCameraSwitchInProgressRef">;
    conversationScroll: Pick<ChatElementStateModel["conversationScroll"], "messagesAtBottomRef">;
    messageDelivery: Pick<ChatElementStateModel["messageDelivery"], "userSentMessageRef">;
    storyAndViewport: Pick<ChatElementStateModel["storyAndViewport"], "setShowScrollToBottomButton">;
    conversationRequest: Pick<ChatElementStateModel["conversationRequest"], "openConversationRef">;
    mediaRecorder: Pick<ChatElementStateModel["mediaRecorder"], "voiceRecorderRef" | "voiceRecordingStartedAtRef" | "voiceRecordedMimeTypeRef" | "voiceFinishInProgressRef" | "voiceChunksRef" | "voiceWaveformSamplesRef" | "voiceHoldStartTimerRef" | "voiceTimerRef" | "voiceStreamRef" | "videoCaptureRef" | "videoRecorderRef" | "videoRecordingStartedAtRef" | "videoRecordedMimeTypeRef" | "videoFinishInProgressRef" | "videoChunksRef" | "videoTimerRef" | "videoStreamRef" | "voicePointerIdRef" | "micRecordButtonRef" | "voicePointerStartRef" | "setSendingRealtimeKind" | "videoStartInProgressRef">;

  };
  history: Pick<MessageHistoryModel, "buildSharedChatKeyId" | "loadSharedKeyByVersion" | "ensureSharedKeyFromServer" | "ensureOwnE2EReady">;
  bootstrap: {
    accountNavigation: Pick<ChatBootstrapModel["accountNavigation"], "currentUserIdRef">;

  };
  active: Pick<ActiveConversationModel, "activeChat" | "handleSecretChatExpired">;
  presentation: Pick<ConversationPresentationModel, "eclipseBots" | "activeTitle">;
  encryption: Pick<MessageEncryptionModel, "rotateSharedKey">;
  callbacks: Pick<ChatPageCallbacks, "uploadChatMediaFile">;
}

export interface ComposerCaptureModel {
  pushOptimisticMessage: (payloadText: string, options?: {
    replyToMessageId?: string | null | undefined;
    id?: string | undefined;

  } | undefined) => string | null;
  removeOptimisticMessage: (optimisticMessageId: string | null | undefined) => void;
  sendPreparedMessage: (payloadText: string, options?: {
    resetComposer?: boolean | undefined;
    replyToMessageId?: string | null | undefined;
    optimisticMessageId?: string | null | undefined;
    throwOnError?: boolean | undefined;

  } | undefined) => Promise<void>;
  pushRecording: (mode: "voice" | "video", isRecording: boolean) => Promise<void>;
  pushSending: (kind: "image" | "voice" | "video" | "file" | "music" | "video_note", isSending: boolean) => Promise<void>;
  cancelVoiceRecording: () => void;
  cancelVideoRecording: () => void;
  finishVoiceRecording: (send: boolean) => Promise<void>;
  finishVideoRecording: (send: boolean) => Promise<void>;
  flipVideoCamera: () => Promise<void>;
  handleMicPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleMicClick: () => void;
}

/** Owns this stage of the chat lifecycle; cleanup and hook order match the page. */
export function useComposerCapture(sources: ComposerCaptureSources): ComposerCaptureModel {
  const { t, beginMessageSend, endMessageSend, setErrorText } = sources.page;
  const { chats, setChats, messages, setMessages, activeConversation, setActiveConversation, activeConversationRef } = sources.page.conversation;
  const { cryptoDiagnosticRef } = sources.page.identity;
  const { selfId, selfProfile, setActiveUnreadCount, animatedMessageIdsRef } = sources.page.account;
  const { replyToMessageId, setReplyToMessageId, voiceHoldActiveRef, voiceStartInProgressRef, setVideoRecordingMs, videoOpenInProgressRef, videoFacingMode, videoRecordingMs, setVideoFacingMode } = sources.page.composerInteraction;
  const { selectedLinkRef, setMessageText, messageText } = sources.page.selection;
  const { setStoryReplyTarget } = sources.page.storyDraft;
  const { setPendingImage, setPendingVideo, setPendingAudio, setPendingFile, setPendingMediaBatch, pendingMediaBatch, pendingImage, pendingVideo, pendingAudio, pendingFile } = sources.page.attachmentDraft;
  const { pendingDeleteRef, chatActionPanelTimeoutRef } = sources.page.panels;
  const { setVoiceRecordingStream, setVoiceRecording, setVoiceRecordingLocked, setVideoRecordingStream, setVideoRecording, setVideoRecordingLocked, setVideoRecorderOpen, voiceRecordingMs, voiceRecording, recordingLocksRef, setVoiceRecordingMs, videoRecording, videoRecorderOpen, setVideoCameraSwitching, setRecordModeHintUntil, composerRecordMode, voiceRecordingLocked, videoRecordingLocked, setComposerRecordMode } = sources.page.recorderPresentation;
  const { setSendingMedia, syncing, sending } = sources.page.conversationRequest;
  const { sanitizeMessages, isMessageMarkedDeleted, markMessageDeletedTombstone } = sources.elements;
  const { decryptedPreviewFingerprintRef, peerPublicKeyByLinkRef, videoPreviewRef, skipMicTapRef, activeVideoDeviceIdRef, videoInputDeviceIdsRef, videoCameraSwitchInProgressRef } = sources.elements.conversationElement;
  const { messagesAtBottomRef } = sources.elements.conversationScroll;
  const { userSentMessageRef } = sources.elements.messageDelivery;
  const { setShowScrollToBottomButton } = sources.elements.storyAndViewport;
  const { openConversationRef } = sources.elements.conversationRequest;
  const { voiceRecorderRef, voiceRecordingStartedAtRef, voiceRecordedMimeTypeRef, voiceFinishInProgressRef, voiceChunksRef, voiceWaveformSamplesRef, voiceHoldStartTimerRef, voiceTimerRef, voiceStreamRef, videoCaptureRef, videoRecorderRef, videoRecordingStartedAtRef, videoRecordedMimeTypeRef, videoFinishInProgressRef, videoChunksRef, videoTimerRef, videoStreamRef, voicePointerIdRef, micRecordButtonRef, voicePointerStartRef, setSendingRealtimeKind, videoStartInProgressRef } = sources.elements.mediaRecorder;
  const { buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, ensureOwnE2EReady } = sources.history;
  const { currentUserIdRef } = sources.bootstrap.accountNavigation;
  const { activeChat, handleSecretChatExpired } = sources.active;
  const { eclipseBots, activeTitle } = sources.presentation;
  const { rotateSharedKey } = sources.encryption;
  const { uploadChatMediaFile } = sources.callbacks;

  const failedChatLink = activeChat?.link;
  const failedChatType = activeConversation?.chatType;
  const failedConversationId = activeConversation?.conversationId;
  useEffect(() => {
    if (!selfId || !failedChatLink || !failedChatType || failedChatLink.startsWith("secret-")) return;
    const account = selfId, link = failedChatLink;
    const target = `${failedChatType}:${link}`;
    let cancelled = false;
    void readFailedMessages(account, target).then(failed => {
      if (cancelled || currentUserIdRef.current !== account || selectedLinkRef.current !== link || !failed.length) return;
      const visible = failed.filter(message => !isMessageMarkedDeleted(message.id));
      visible.forEach(rememberOutgoingMessage);
      setMessages(previous => sanitizeMessages(mergeMessageWindow(previous, visible.filter(message => !previous.some(existing => existing.id === message.id || existing.localId === message.id)))));
    });
    return () => { cancelled = true; };
  }, [selfId, failedChatLink, failedConversationId, failedChatType, currentUserIdRef, selectedLinkRef, isMessageMarkedDeleted, sanitizeMessages, setMessages]);

  useEffect(() => {
    return decryptSharedChatPreviews({ chats, decryptedPreviewFingerprintRef, buildSharedChatKeyId, loadSharedKeyByVersion, ensureSharedKeyFromServer, cryptoDiagnosticRef, setChats });
  }, [buildSharedChatKeyId, chats, ensureSharedKeyFromServer, loadSharedKeyByVersion, t]);

  const pushOptimisticMessage = useCallback((payloadText: string, options?: {
    replyToMessageId?: string | null;
    id?: string

  }) => {
    return pushOptimisticMessageAction({ selfId, selfProfile, currentUserIdRef, activeChat, messages, replyToMessageId, messagesAtBottomRef, userSentMessageRef, setShowScrollToBottomButton, setActiveUnreadCount, setMessages, sanitizeMessages, setChats }, payloadText, options);
  }, [activeChat, replyToMessageId, sanitizeMessages, selfId, selfProfile?.id]);

  const removeOptimisticMessage = useCallback((optimisticMessageId: string | null | undefined) => {
    if (!optimisticMessageId) return;
    forgetOutgoingMessage(optimisticMessageId);
    setMessages((prev) => prev.filter((message) => message.id !== optimisticMessageId));
  }, []);

  const sendPreparedMessage = useCallback(async (payloadText: string, options?: {
    resetComposer?: boolean;
    replyToMessageId?: string | null;
    optimisticMessageId?: string | null;
    throwOnError?: boolean

  }) => {
    return sendPreparedMessageAction({ activeChat, activeConversation, t, selectedLinkRef, currentUserIdRef, selfId, removeOptimisticMessage, beginMessageSend, eclipseBots, setMessageText, setReplyToMessageId, setStoryReplyTarget, endMessageSend, replyToMessageId, setErrorText, setMessages, sanitizeMessages, setPendingImage, setPendingVideo, setPendingAudio, setPendingFile, setPendingMediaBatch, openConversationRef, buildSharedChatKeyId, ensureSharedKeyFromServer, rotateSharedKey, animatedMessageIdsRef, isMessageMarkedDeleted, markMessageDeletedTombstone, pendingDeleteRef, setChats, ensureOwnE2EReady, peerPublicKeyByLinkRef, setActiveConversation, handleSecretChatExpired, activeTitle }, payloadText, options);
  }, [activeChat, activeConversation, beginMessageSend, endMessageSend, ensureOwnE2EReady, replyToMessageId, sanitizeMessages, selfId, eclipseBots.act, t]);

  const pushRecording = useCallback(
    async (mode: "voice" | "video", isRecording: boolean) => {
      if (!activeChat?.link) return;
      if (activeChat.chatType === "saved") return;
      try {
        await apiRequest("/api/realtime/recording", {
          method: "POST",
          body: JSON.stringify({ link: activeChat.link, chatType: activeChat.chatType, mode, isRecording }),
        });
      } catch {
        // recording event is best-effort
      }
    },
    [activeChat?.chatType, activeChat?.link],
  );

  const pushSending = useCallback(
    async (kind: RealtimeSendingPayload["kind"], isSending: boolean) => {
      if (!activeChat?.link) return;
      if (activeChat.chatType === "saved") return;
      try {
        await apiRequest("/api/realtime/sending", {
          method: "POST",
          body: JSON.stringify({ link: activeChat.link, chatType: activeChat.chatType, kind, isSending }),
        });
      } catch {
        // sending event is best-effort
      }
    },
    [activeChat?.chatType, activeChat?.link],
  );

  const stopVoiceStream = useCallback(() => {
    return stopVoiceStreamAction({ voiceRecorderRef, voiceRecordingStartedAtRef, voiceRecordedMimeTypeRef, voiceFinishInProgressRef, voiceChunksRef, voiceWaveformSamplesRef, voiceHoldStartTimerRef, voiceTimerRef, voiceStreamRef, setVoiceRecordingStream, setVoiceRecording, setVoiceRecordingLocked });
  }, []);

  const stopVideoStream = useCallback(() => {
    return stopVideoStreamAction({ videoCaptureRef, videoRecorderRef, videoRecordingStartedAtRef, videoRecordedMimeTypeRef, videoFinishInProgressRef, videoChunksRef, videoTimerRef, videoStreamRef, videoPreviewRef, setVideoRecordingStream, setVideoRecording, setVideoRecordingLocked });
  }, []);

  const clearVoiceHoldStartTimer = useCallback(() => {
    if (!voiceHoldStartTimerRef.current) return;
    clearTimeout(voiceHoldStartTimerRef.current);
    voiceHoldStartTimerRef.current = null;
  }, []);

  const releaseMicPointerCapture = useCallback(() => {
    const pointerId = voicePointerIdRef.current;
    const button = micRecordButtonRef.current;
    if (pointerId !== null && button?.hasPointerCapture(pointerId)) {
      try {
        button.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
    voicePointerIdRef.current = null;
    voicePointerStartRef.current = null;
    voiceHoldActiveRef.current = false;
  }, []);

  const cancelVoiceRecording = useCallback(() => {
    skipMicTapRef.current = true;
    clearVoiceHoldStartTimer();
    releaseMicPointerCapture();

    const recorder = voiceRecorderRef.current;
    voiceRecorderRef.current = null;
    voiceChunksRef.current = [];
    voiceWaveformSamplesRef.current = [];
    voiceFinishInProgressRef.current = false;
    stopVoiceStream();
    void pushRecording("voice", false);

    if (recorder && recorder.state !== "inactive") {
      void flushRecorderThenStop(recorder).catch(() => undefined);
    }
  }, [clearVoiceHoldStartTimer, pushRecording, releaseMicPointerCapture, stopVoiceStream]);

  const cancelVideoRecording = useCallback(() => {
    skipMicTapRef.current = true;
    clearVoiceHoldStartTimer();
    releaseMicPointerCapture();

    const recorder = videoRecorderRef.current;
    videoRecorderRef.current = null;
    videoChunksRef.current = [];
    videoFinishInProgressRef.current = false;
    stopVideoStream();
    setVideoRecorderOpen(false);
    void pushRecording("video", false);

    if (recorder && recorder.state !== "inactive") {
      void flushRecorderThenStop(recorder).catch(() => undefined);
    }
  }, [clearVoiceHoldStartTimer, pushRecording, releaseMicPointerCapture, stopVideoStream]);

  const attachVideoPreviewStream = useCallback((stream: MediaStream) => {
    return attachVideoPreviewStreamAction({ activeVideoDeviceIdRef, videoPreviewRef }, stream);
  }, []);

  const refreshVideoInputDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoInputDeviceIdsRef.current = devices
        .filter((device) => device.kind === "videoinput" && device.deviceId)
        .map((device) => device.deviceId);
    } catch {
      videoInputDeviceIdsRef.current = [];
    }
  }, []);

  const requestVideoRecorderStream = useCallback(
    async (options: RecordingCameraRequest) => {
      return requestVideoRecorderStreamAction({ refreshVideoInputDevices }, options);
    },
    [refreshVideoInputDevices],
  );

  const sendRecordedMedia = useCallback(async (blob: Blob, kind: "voice" | "video_note", durationMs: number, waveform?: number[]) => {
    return sendRecordedMediaAction({ activeChat, selfId, selectedLinkRef, currentUserIdRef, pushOptimisticMessage, t, setSendingMedia, setSendingRealtimeKind, pushSending, uploadChatMediaFile, sendPreparedMessage, removeOptimisticMessage }, blob, kind, durationMs, waveform);
  }, [activeChat?.link, selfId, pushOptimisticMessage, pushSending, removeOptimisticMessage, sendPreparedMessage, t]);

  const finishVoiceRecording = useCallback(
    async (send: boolean) => {
      return finishVoiceRecordingAction({ voiceFinishInProgressRef, voiceRecorderRef, stopVoiceStream, setVoiceRecording, setVoiceRecordingLocked, voiceTimerRef, voiceChunksRef, voiceRecordingMs, voiceRecordingStartedAtRef, voiceWaveformSamplesRef, pushRecording, setErrorText, t, sendRecordedMedia, skipMicTapRef }, send);
    },
    [pushRecording, sendRecordedMedia, stopVoiceStream, voiceRecordingMs, t],
  );

  const startVoiceRecording = useCallback(async () => {
    return startVoiceRecordingAction({ voiceRecording, voiceStartInProgressRef, syncing, activeChat, activeConversationRef, setErrorText, t, selectedLinkRef, voiceHoldActiveRef, recordingLocksRef, voiceStreamRef, setVoiceRecordingStream, voiceChunksRef, voiceWaveformSamplesRef, voiceRecordedMimeTypeRef, voiceRecorderRef, voiceRecordingStartedAtRef, setVoiceRecordingMs, setVoiceRecording, pushRecording, voiceTimerRef, stopVoiceStream });
  }, [activeChat, pushRecording, releaseMicPointerCapture, sending, stopVoiceStream, syncing, voiceRecording, t]);

  const startVideoRecordingForStream = useCallback(async (stream: MediaStream) => {
    return startVideoRecordingForStreamAction({ videoRecording, videoStartInProgressRef, selectedLinkRef, voiceHoldActiveRef, videoStreamRef, setVideoRecordingStream, videoChunksRef, videoRecordedMimeTypeRef, recordingLocksRef, setVideoRecorderOpen, videoCaptureRef, setErrorText, t, stopVideoStream, videoRecorderRef, videoRecordingStartedAtRef, setVideoRecordingMs, setVideoRecording, pushRecording, videoTimerRef }, stream);
  }, [pushRecording, releaseMicPointerCapture, stopVideoStream, videoRecording, t]);

  const openVideoRecorder = useCallback(async (autoStart = false) => {
    return openVideoRecorderAction({ videoRecorderOpen, videoOpenInProgressRef, syncing, activeChat, activeConversationRef, setErrorText, t, selectedLinkRef, voiceHoldActiveRef, requestVideoRecorderStream, videoFacingMode, recordingLocksRef, videoStreamRef, setVideoRecordingMs, setVideoRecorderOpen, attachVideoPreviewStream, startVideoRecordingForStream, stopVideoStream }, autoStart);
  }, [
    activeChat,
    attachVideoPreviewStream,
    requestVideoRecorderStream,
    sending,
    startVideoRecordingForStream,
    stopVideoStream,
    syncing,
    videoFacingMode,
    videoRecorderOpen, t]);

  const finishVideoRecording = useCallback(
    async (send: boolean) => {
      return finishVideoRecordingAction({ videoFinishInProgressRef, videoRecorderRef, stopVideoStream, setVideoRecorderOpen, videoRecordingStartedAtRef, videoRecordingMs, setVideoRecording, setVideoRecordingLocked, videoTimerRef, videoChunksRef, pushRecording, setErrorText, t, sendRecordedMedia, skipMicTapRef }, send);
    },
    [pushRecording, sendRecordedMedia, stopVideoStream, videoRecordingMs, t],
  );

  const flipVideoCamera = useCallback(async () => {
    const original = videoStreamRef.current;
    if (!videoRecorderOpen || !original || videoCameraSwitchInProgressRef.current) return;
    videoCameraSwitchInProgressRef.current = true;
    setVideoCameraSwitching(true);
    const recordingLink = selectedLinkRef.current;
    const capture = videoCaptureRef.current;
    const isCurrent = () => videoStreamRef.current === original && selectedLinkRef.current === recordingLink && (!capture || videoCaptureRef.current === capture);
    try {
      const next = await replaceRecordingCamera({
        currentStream: original, facingMode: videoFacingMode,
        deviceIds: videoInputDeviceIdsRef.current, capture, requestStream: requestVideoRecorderStream, isCurrent
      });
      if (!isCurrent()) { next.stream.getTracks().forEach(track => track.stop()); return; }
      videoStreamRef.current = next.stream;
      setVideoRecordingStream(next.stream);
      attachVideoPreviewStream(next.stream);
      setVideoFacingMode(next.facingMode);
      if (!next.switched) showAppToast({ type: "error", title: t("Не удалось переключить камеру") });
    } catch (error) {
      if (isCurrent() && !(error instanceof DOMException && error.name === "AbortError")) showAppToast({ type: "error", title: t("Не удалось переключить камеру") });
    } finally { videoCameraSwitchInProgressRef.current = false; setVideoCameraSwitching(false); }
  }, [attachVideoPreviewStream, requestVideoRecorderStream, videoFacingMode, videoRecorderOpen, t]);

  useEffect(() => {
    if (!voiceRecording) return;
    if (voiceRecordingMs < VOICE_MAX_DURATION_MS) return;
    void finishVoiceRecording(true);
  }, [finishVoiceRecording, voiceRecording, voiceRecordingMs]);

  useEffect(() => {
    if (!videoRecording) return;
    if (videoRecordingMs < VIDEO_MAX_DURATION_MS) return;
    void finishVideoRecording(true);
  }, [finishVideoRecording, videoRecording, videoRecordingMs]);

  const handleMicPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    return handleMicPointerDownAction({ messageText, pendingMediaBatch, pendingImage, pendingVideo, pendingAudio, pendingFile, voicePointerIdRef, voicePointerStartRef, voiceHoldActiveRef, skipMicTapRef, clearVoiceHoldStartTimer, voiceHoldStartTimerRef, voiceRecording, videoRecording, setRecordModeHintUntil, composerRecordMode, setVoiceRecordingLocked, startVoiceRecording, setVideoRecordingLocked, openVideoRecorder }, event);
  }, [
    clearVoiceHoldStartTimer,
    composerRecordMode,
    messageText,
    openVideoRecorder,
    pendingAudio,
    pendingFile,
    pendingImage,
    pendingMediaBatch,
    pendingVideo,
    startVoiceRecording,
    videoRecording,
    voiceRecording,
  ]);

  const handleMicPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    return handleMicPointerMoveAction({ voiceHoldActiveRef, voiceRecording, videoRecording, voicePointerStartRef, clearVoiceHoldStartTimer, skipMicTapRef, composerRecordMode, setVoiceRecordingLocked, startVoiceRecording, setVideoRecordingLocked, openVideoRecorder, voiceRecordingLocked, videoRecordingLocked, cancelVoiceRecording, cancelVideoRecording }, event);
  }, [
    cancelVideoRecording,
    cancelVoiceRecording,
    composerRecordMode,
    openVideoRecorder,
    startVoiceRecording,
    videoRecording,
    videoRecordingLocked,
    voiceRecording,
    voiceRecordingLocked,
  ]);

  const handleMicPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    return handleMicPointerUpAction({ voiceHoldActiveRef, clearVoiceHoldStartTimer, voicePointerIdRef, voicePointerStartRef, voiceRecording, videoRecording, voiceRecordingLocked, videoRecordingLocked, skipMicTapRef, finishVoiceRecording, finishVideoRecording }, event);
  }, [
    clearVoiceHoldStartTimer,
    finishVideoRecording,
    finishVoiceRecording,
    videoRecording,
    videoRecordingLocked,
    voiceRecording,
    voiceRecordingLocked,
  ]);

  const handleMicPointerCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    return handleMicPointerCancelAction({ voiceHoldActiveRef, clearVoiceHoldStartTimer, voicePointerIdRef, voicePointerStartRef, voiceRecording, videoRecording, voiceRecordingLocked, videoRecordingLocked, skipMicTapRef, cancelVoiceRecording, cancelVideoRecording }, event);
  }, [
    cancelVideoRecording,
    cancelVoiceRecording,
    clearVoiceHoldStartTimer,
    videoRecording,
    videoRecordingLocked,
    voiceRecording,
    voiceRecordingLocked,
  ]);

  useEffect(() => {
    return bindRecordingGestures({ voiceRecording, videoRecording, voiceHoldActiveRef, voicePointerIdRef, clearVoiceHoldStartTimer, voicePointerStartRef, voiceRecordingLocked, videoRecordingLocked, skipMicTapRef, cancelVoiceRecording, cancelVideoRecording, finishVoiceRecording, finishVideoRecording, handleMicPointerMove });
  }, [voiceRecording, videoRecording, voiceRecordingLocked, videoRecordingLocked, handleMicPointerMove, clearVoiceHoldStartTimer, cancelVoiceRecording, cancelVideoRecording, finishVoiceRecording, finishVideoRecording]);

  const handleMicClick = useCallback(() => {
    if (skipMicTapRef.current) {
      skipMicTapRef.current = false;
      return;
    }
    if (voiceRecording || videoRecording) return;
    if (messageText.trim() || pendingMediaBatch?.length || pendingImage || pendingVideo || pendingAudio || pendingFile) return;
    setComposerRecordMode((prev) => (prev === "voice" ? "video" : "voice"));
    setRecordModeHintUntil(Date.now() + 4500);
  }, [messageText, pendingAudio, pendingFile, pendingImage, pendingMediaBatch, pendingVideo, videoRecording, voiceRecording]);

  useEffect(() => {
    return () => {
      clearVoiceHoldStartTimer();
      voicePointerIdRef.current = null;
      voicePointerStartRef.current = null;
      stopVoiceStream();
      stopVideoStream();
    };
  }, [clearVoiceHoldStartTimer, stopVideoStream, stopVoiceStream]);

  useEffect(() => {
    return () => {
      if (chatActionPanelTimeoutRef.current) {
        clearTimeout(chatActionPanelTimeoutRef.current);
      }
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.finalizeTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (!voiceRecording && !videoRecording) return;
    return () => {
      if (voiceFinishInProgressRef.current || videoFinishInProgressRef.current) {
        return;
      }
      void pushRecording("voice", false);
      void pushRecording("video", false);
      stopVoiceStream();
      stopVideoStream();
      setVideoRecorderOpen(false);
    };
  }, [activeChat?.link, pushRecording, stopVideoStream, stopVoiceStream, videoRecording, voiceRecording]);

  useEffect(() => {
    return refreshSystemBotCommands({ activeConversation, setActiveConversation });
  }, [activeConversation]);

  return {
    pushOptimisticMessage,
    removeOptimisticMessage,
    sendPreparedMessage,
    pushRecording,
    pushSending,
    cancelVoiceRecording,
    cancelVideoRecording,
    finishVoiceRecording,
    finishVideoRecording,
    flipVideoCamera,
    handleMicPointerDown,
    handleMicPointerMove,
    handleMicPointerUp,
    handleMicPointerCancel,
    handleMicClick
  };
}
