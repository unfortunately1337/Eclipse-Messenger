"use client";
import type { MessageDeletionShift } from "./message-deletion-layout";

import { type ChatSummary, type ConversationResponse, type PendingAlbumItem, type PendingImagePayload, type PendingVideoPayload, type PendingAudioPayload, type PendingFilePayload, type ProfileBatchItem, type DecryptedMessage, type ConversationChatType } from "../types";
import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { finishMediaRecording, createVideoNoteCapture } from "@/lib/client/media-recording";
import { PointerEvent as ReactPointerEvent } from "react";
import { type RecordingCameraRequest } from "@/lib/client/recording-camera";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { cacheMediaBlobUrl } from "@/lib/client/media-cache";
import { startMessageDissolve, cancelMessageDissolve, finishMessageDissolve } from "@/lib/client/message-dissolve";
import { mapConcurrentSettled } from "@/lib/client/concurrent-requests";
import { serializeVideoContent, serializeVoiceContent } from "../chat-message-transport";
import { downsampleWaveform, encodeWaveformForMessage } from "@/lib/client/voice-waveform";
import { probeBlobDurationMs, createAudioRecorder, createVideoRecorder } from "./media-recording";
import { VOICE_MAX_DURATION_MS, VOICE_MAX_BYTES, VIDEO_MAX_DURATION_MS, VIDEO_MAX_BYTES, RECORD_START_SWIPE_UP_PX, VOICE_CANCEL_THRESHOLD_PX, VOICE_LOCK_THRESHOLD_PX, DIRECT_PEER_KEY_POLL_MAX_ATTEMPTS, DIRECT_PEER_KEY_POLL_INTERVAL_MS } from "./config";
import { readConversationMemoryCache, loadConversationSessionCache, loadConversationPersistentCache, cacheConversationSnapshot } from "./chat-cache";

export interface StopVoiceStreamActionContext {
  voiceRecorderRef: React.RefObject<MediaRecorder | null>;
  voiceRecordingStartedAtRef: React.RefObject<number | null>;
  voiceRecordedMimeTypeRef: React.RefObject<string | null>;
  voiceFinishInProgressRef: React.RefObject<boolean>;
  voiceChunksRef: React.RefObject<Blob[]>;
  voiceWaveformSamplesRef: React.RefObject<number[]>;
  voiceHoldStartTimerRef: React.RefObject<NodeJS.Timeout | null>;
  voiceTimerRef: React.RefObject<NodeJS.Timeout | null>;
  voiceStreamRef: React.RefObject<MediaStream | null>;
  setVoiceRecordingStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setVoiceRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setVoiceRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

export function stopVoiceStreamAction({ voiceRecorderRef, voiceRecordingStartedAtRef, voiceRecordedMimeTypeRef, voiceFinishInProgressRef, voiceChunksRef, voiceWaveformSamplesRef, voiceHoldStartTimerRef, voiceTimerRef, voiceStreamRef, setVoiceRecordingStream, setVoiceRecording, setVoiceRecordingLocked }: StopVoiceStreamActionContext): void {
  voiceRecorderRef.current = null;
  voiceRecordingStartedAtRef.current = null;
  voiceRecordedMimeTypeRef.current = null;
  if (!voiceFinishInProgressRef.current) {
    voiceChunksRef.current = [];
    voiceWaveformSamplesRef.current = [];
  }
  if (voiceHoldStartTimerRef.current) {
    clearTimeout(voiceHoldStartTimerRef.current);
    voiceHoldStartTimerRef.current = null;
  }
  if (voiceTimerRef.current) {
    clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
  }
  const stream = voiceStreamRef.current;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  voiceStreamRef.current = null;
  setVoiceRecordingStream(null);
  setVoiceRecording(false);
  setVoiceRecordingLocked(false);
}

export interface StopVideoStreamActionContext {
  videoCaptureRef: React.RefObject<{ stream: MediaStream; setSource: (nextSource: MediaStream) => Promise<void>; stop: () => void; } | null>;
  videoRecorderRef: React.RefObject<MediaRecorder | null>;
  videoRecordingStartedAtRef: React.RefObject<number | null>;
  videoRecordedMimeTypeRef: React.RefObject<string | null>;
  videoFinishInProgressRef: React.RefObject<boolean>;
  videoChunksRef: React.RefObject<Blob[]>;
  videoTimerRef: React.RefObject<NodeJS.Timeout | null>;
  videoStreamRef: React.RefObject<MediaStream | null>;
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
  setVideoRecordingStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setVideoRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

export function stopVideoStreamAction({ videoCaptureRef, videoRecorderRef, videoRecordingStartedAtRef, videoRecordedMimeTypeRef, videoFinishInProgressRef, videoChunksRef, videoTimerRef, videoStreamRef, videoPreviewRef, setVideoRecordingStream, setVideoRecording, setVideoRecordingLocked }: StopVideoStreamActionContext): void {
  videoCaptureRef.current?.stop();
  videoCaptureRef.current = null;
  videoRecorderRef.current = null;
  videoRecordingStartedAtRef.current = null;
  videoRecordedMimeTypeRef.current = null;
  if (!videoFinishInProgressRef.current) {
    videoChunksRef.current = [];
  }
  if (videoTimerRef.current) {
    clearInterval(videoTimerRef.current);
    videoTimerRef.current = null;
  }
  const stream = videoStreamRef.current;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (videoPreviewRef.current) {
    videoPreviewRef.current.pause();
    videoPreviewRef.current.srcObject = null;
  }
  videoStreamRef.current = null;
  setVideoRecordingStream(null);
  setVideoRecording(false);
  setVideoRecordingLocked(false);
}

export interface AttachVideoPreviewStreamActionContext {
  activeVideoDeviceIdRef: React.RefObject<string | null>;
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
}

export function attachVideoPreviewStreamAction({ activeVideoDeviceIdRef, videoPreviewRef }: AttachVideoPreviewStreamActionContext, stream: MediaStream): void {
  const videoTrack = stream.getVideoTracks()[0] ?? null;
  activeVideoDeviceIdRef.current = videoTrack?.getSettings().deviceId ?? null;
  let attempts = 0;
  const bindPreview = () => {
    const preview = videoPreviewRef.current;
    if (!preview) {
      attempts += 1;
      if (attempts < 8) {
        requestAnimationFrame(bindPreview);
      }
      return;
    }
    preview.controls = false;
    preview.disablePictureInPicture = true;
    preview.disableRemotePlayback = true;
    preview.setAttribute("webkit-playsinline", "true");
    preview.srcObject = stream;
    preview.muted = true;
    preview.playsInline = true;
    preview.autoplay = true;
    void preview.play().catch(() => undefined);
  };
  requestAnimationFrame(bindPreview);
}

export interface RequestVideoRecorderStreamActionContext {
  refreshVideoInputDevices: () => Promise<void>;
}

export async function requestVideoRecorderStreamAction({ refreshVideoInputDevices }: RequestVideoRecorderStreamActionContext, options: RecordingCameraRequest): Promise<MediaStream> {
  const baseAudio = {
    audio: options.audio === false ? false : {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: { ideal: 48_000 },
      sampleSize: { ideal: 16 },
    },
  } as const;
  const baseVideo = {
    aspectRatio: { ideal: 1.0 },
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
  } as const;
  const directConstraints =
    options.preferFacing ? {
      ...baseAudio,
      video: { facingMode: { exact: options.facingMode }, ...baseVideo },
    } : options.deviceId && options.deviceId.trim()
      ? {
        ...baseAudio,
        video: {
          deviceId: { exact: options.deviceId.trim() },
          ...baseVideo,
        },
      }
      : {
        ...baseAudio,
        video: {
          facingMode: { ideal: options.facingMode },
          ...baseVideo,
        },
      };

  const attachAudioTrackIfMissing = async (stream: MediaStream) => {
    if (options.audio === false) return stream;
    const hasAudioTrack = stream.getAudioTracks().some((track) => track.readyState === "live");
    if (hasAudioTrack) return stream;
    try {
      const audioFallback = await navigator.mediaDevices.getUserMedia({ audio: true });
      return new MediaStream([...stream.getVideoTracks(), ...audioFallback.getAudioTracks()]);
    } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(directConstraints);
    await refreshVideoInputDevices();
    return await attachAudioTrackIfMissing(stream);
  } catch {
    if (options.deviceId && options.deviceId.trim()) {
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({
          ...baseAudio,
          video: {
            deviceId: { exact: options.deviceId.trim() },
            ...baseVideo,
          },
        });
        await refreshVideoInputDevices();
        return await attachAudioTrackIfMissing(fallback);
      } catch {
        // continue to generic fallback
      }
    }
    try {
      const genericFallback = await navigator.mediaDevices.getUserMedia({
        audio: options.audio !== false,
        video: {
          facingMode: { ideal: options.facingMode },
          aspectRatio: { ideal: 1.0 },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
      });
      await refreshVideoInputDevices();
      return await attachAudioTrackIfMissing(genericFallback);
    } catch {
      try {
        const basicStream = await navigator.mediaDevices.getUserMedia({
          audio: options.audio !== false,
          video: true,
        });
        await refreshVideoInputDevices();
        return await attachAudioTrackIfMissing(basicStream);
      } catch {
        throw new Error("camera_unavailable");
      }
    }
  }
}

export interface SendRecordedMediaActionContext {
  activeChat: ChatSummary | null;
  selfId: string | null;
  selectedLinkRef: React.RefObject<string | null>;
  currentUserIdRef: React.RefObject<string | null>;
  pushOptimisticMessage: (payloadText: string, options?: { replyToMessageId?: string | null | undefined; id?: string | undefined; } | undefined) => string | null;
  t: (source: string, values?: TranslationValues | undefined) => string;
  setSendingMedia: React.Dispatch<React.SetStateAction<boolean>>;
  setSendingRealtimeKind: React.Dispatch<React.SetStateAction<"image" | "video" | "voice" | "file" | "music" | "video_note" | null>>;
  pushSending: (kind: "image" | "video" | "voice" | "file" | "music" | "video_note", isSending: boolean) => Promise<void>;
  uploadChatMediaFile: (file: Blob, kind: "image" | "video" | "voice" | "file" | "audio" | "video_note", durationMs?: number | undefined) => Promise<{ id: string; url: string; expiresAt?: string | null | undefined; }>;
  sendPreparedMessage: (payloadText: string, options?: { resetComposer?: boolean | undefined; replyToMessageId?: string | null | undefined; optimisticMessageId?: string | null | undefined; throwOnError?: boolean | undefined; } | undefined) => Promise<void>;
  removeOptimisticMessage: (optimisticMessageId: string | null | undefined) => void;
}

export async function sendRecordedMediaAction({ activeChat, selfId, selectedLinkRef, currentUserIdRef, pushOptimisticMessage, t, setSendingMedia, setSendingRealtimeKind, pushSending, uploadChatMediaFile, sendPreparedMessage, removeOptimisticMessage }: SendRecordedMediaActionContext, blob: Blob, kind: "voice" | "video_note", durationMs: number, waveform?: number[]): Promise<void> {
  const originLink = activeChat?.link;
  const originUserId = selfId;
  const content = (url: string) => kind === "voice"
    ? serializeVoiceContent(url, durationMs, waveform)
    : serializeVideoContent(url, durationMs, "", "note");
  const optimisticUrl = URL.createObjectURL(blob);
  const optimisticMessageId = selectedLinkRef.current === originLink && currentUserIdRef.current === originUserId
    ? pushOptimisticMessage(content(optimisticUrl)) : crypto.randomUUID();
  let uploadedUrl: string | null = null;
  let running = false;
  const submit = async () => {
    if (running) return;
    if (selectedLinkRef.current !== originLink || currentUserIdRef.current !== originUserId) {
      showAppToast({
        type: "error", title: t("Вернитесь в исходный чат, чтобы повторить отправку"),
        actions: [{ label: t("Повторить"), onClick: () => { void submit(); } }], durationMs: 30_000,
      });
      return;
    }
    running = true;
    setSendingMedia(true);
    setSendingRealtimeKind(kind);
    void pushSending(kind, true);
    try {
      uploadedUrl ??= (await uploadChatMediaFile(blob, kind, durationMs)).url;
      if (selectedLinkRef.current !== originLink || currentUserIdRef.current !== originUserId) throw new Error(t("Чат изменился. Вернитесь в него и повторите отправку."));
      cacheMediaBlobUrl(uploadedUrl, optimisticUrl);
      // Reuse the same id on retry: a lost response must not create a duplicate message.
      await sendPreparedMessage(content(uploadedUrl), { resetComposer: false, optimisticMessageId, throwOnError: true });
    } catch (error) {
      if (selectedLinkRef.current === originLink) removeOptimisticMessage(optimisticMessageId);
      const message = error instanceof Error ? error.message : t("Не удалось отправить запись");
      showAppToast({ type: "error", title: message, actions: [{ label: t("Повторить"), onClick: () => { void submit(); } }], durationMs: 60_000 });
    } finally {
      running = false;
      void pushSending(kind, false);
      setSendingRealtimeKind(null);
      setSendingMedia(false);
    }
  };
  await submit();
}

export interface FinishVoiceRecordingActionContext {
  voiceFinishInProgressRef: React.RefObject<boolean>;
  voiceRecorderRef: React.RefObject<MediaRecorder | null>;
  stopVoiceStream: () => void;
  setVoiceRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setVoiceRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
  voiceTimerRef: React.RefObject<NodeJS.Timeout | null>;
  voiceChunksRef: React.RefObject<Blob[]>;
  voiceRecordingMs: number;
  voiceRecordingStartedAtRef: React.RefObject<number | null>;
  voiceWaveformSamplesRef: React.RefObject<number[]>;
  pushRecording: (mode: "video" | "voice", isRecording: boolean) => Promise<void>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  sendRecordedMedia: (blob: Blob, kind: "voice" | "video_note", durationMs: number, waveform?: number[] | undefined) => Promise<void>;
  skipMicTapRef: React.RefObject<boolean>;
}

export async function finishVoiceRecordingAction({ voiceFinishInProgressRef, voiceRecorderRef, stopVoiceStream, setVoiceRecording, setVoiceRecordingLocked, voiceTimerRef, voiceChunksRef, voiceRecordingMs, voiceRecordingStartedAtRef, voiceWaveformSamplesRef, pushRecording, setErrorText, t, sendRecordedMedia, skipMicTapRef }: FinishVoiceRecordingActionContext, send: boolean): Promise<void> {
  if (voiceFinishInProgressRef.current) return;
  const recorder = voiceRecorderRef.current;
  if (!recorder) {
    stopVoiceStream();
    return;
  }
  voiceFinishInProgressRef.current = true;

  try {
    // Keep the original chunk handler until the recorder has emitted its final chunk.
    // Fast UI feedback: immediately freeze recording state & timer
    setVoiceRecording(false);
    setVoiceRecordingLocked(false);
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }

    // Stop emits the final chunk before its stop event. Keep tracks alive until then.
    const rawBlob = await finishMediaRecording(recorder, voiceChunksRef.current);

    const timerDurationMs = voiceRecordingMs;
    const elapsedDurationMs = voiceRecordingStartedAtRef.current
      ? Math.max(0, Date.now() - voiceRecordingStartedAtRef.current)
      : 0;
    const capturedWaveformSamples = voiceWaveformSamplesRef.current.slice();
    stopVoiceStream();
    void pushRecording("voice", false);

    if (!send || rawBlob.size === 0) {
      return;
    }
    const probedDurationMs = await probeBlobDurationMs(rawBlob, "audio");
    const effectiveDurationMs = Math.max(timerDurationMs, elapsedDurationMs, probedDurationMs, 0);
    if (effectiveDurationMs > VOICE_MAX_DURATION_MS) {
      setErrorText(t("Голосовое слишком длинное. Максимум 10 минут."));
      return;
    }
    if (rawBlob.size > VOICE_MAX_BYTES) {
      setErrorText(t("Голосовое слишком большое. Попробуйте более короткую запись."));
      return;
    }

    const waveform = encodeWaveformForMessage(downsampleWaveform(capturedWaveformSamples));
    await sendRecordedMedia(rawBlob, "voice", effectiveDurationMs, waveform);
    skipMicTapRef.current = false;
  } catch (error) {
    stopVoiceStream();
    setErrorText(error instanceof Error ? error.message : t("Не удалось завершить голосовое сообщение"));
    void pushRecording("voice", false);
  } finally {
    voiceFinishInProgressRef.current = false;
    voiceChunksRef.current = [];
    voiceWaveformSamplesRef.current = [];
  }
}

export interface StartVoiceRecordingActionContext {
  voiceRecording: boolean;
  voiceStartInProgressRef: React.RefObject<boolean>;
  syncing: boolean;
  activeChat: ChatSummary | null;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  selectedLinkRef: React.RefObject<string | null>;
  voiceHoldActiveRef: React.RefObject<boolean>;
  recordingLocksRef: React.RefObject<{ voice: boolean; video: boolean; }>;
  voiceStreamRef: React.RefObject<MediaStream | null>;
  setVoiceRecordingStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  voiceChunksRef: React.RefObject<Blob[]>;
  voiceWaveformSamplesRef: React.RefObject<number[]>;
  voiceRecordedMimeTypeRef: React.RefObject<string | null>;
  voiceRecorderRef: React.RefObject<MediaRecorder | null>;
  voiceRecordingStartedAtRef: React.RefObject<number | null>;
  setVoiceRecordingMs: React.Dispatch<React.SetStateAction<number>>;
  setVoiceRecording: React.Dispatch<React.SetStateAction<boolean>>;
  pushRecording: (mode: "video" | "voice", isRecording: boolean) => Promise<void>;
  voiceTimerRef: React.RefObject<NodeJS.Timeout | null>;
  stopVoiceStream: () => void;
}

export async function startVoiceRecordingAction({ voiceRecording, voiceStartInProgressRef, syncing, activeChat, activeConversationRef, setErrorText, t, selectedLinkRef, voiceHoldActiveRef, recordingLocksRef, voiceStreamRef, setVoiceRecordingStream, voiceChunksRef, voiceWaveformSamplesRef, voiceRecordedMimeTypeRef, voiceRecorderRef, voiceRecordingStartedAtRef, setVoiceRecordingMs, setVoiceRecording, pushRecording, voiceTimerRef, stopVoiceStream }: StartVoiceRecordingActionContext): Promise<void> {
  if (voiceRecording || voiceStartInProgressRef.current || syncing || !activeChat) return;
  if (activeConversationRef.current?.chatType === "eclipse") {
    setErrorText(t("Системный бот принимает команды текстом. Для аватара бота выберите изображение в меню создания бота."));
    return;
  }
  voiceStartInProgressRef.current = true;
  const recordingLink = selectedLinkRef.current;
  const beganFromHold = voiceHoldActiveRef.current;
  try {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: { ideal: 48_000 },
          sampleSize: { ideal: 16 },
        },
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    if (selectedLinkRef.current !== recordingLink || (beganFromHold && !voiceHoldActiveRef.current && !recordingLocksRef.current.voice)) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    const liveAudioTrack = stream.getAudioTracks().find((track) => track.readyState === "live");
    if (!liveAudioTrack) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("mic_unavailable");
    }
    liveAudioTrack.enabled = true;
    voiceStreamRef.current = stream;
    setVoiceRecordingStream(stream);
    voiceChunksRef.current = [];
    voiceWaveformSamplesRef.current = [];
    voiceRecordedMimeTypeRef.current = null;
    const recorder = createAudioRecorder(stream);
    if (recorder.mimeType) {
      voiceRecordedMimeTypeRef.current = recorder.mimeType;
    }
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        if (!voiceRecordedMimeTypeRef.current && event.data.type) {
          voiceRecordedMimeTypeRef.current = event.data.type;
        }
        voiceChunksRef.current.push(event.data);
      }
    };
    recorder.start(200);
    voiceRecorderRef.current = recorder;
    const startedAt = Date.now();
    voiceRecordingStartedAtRef.current = startedAt;
    setVoiceRecordingMs(0);
    setVoiceRecording(true);
    void pushRecording("voice", true);
    voiceTimerRef.current = setInterval(() => {
      const base = voiceRecordingStartedAtRef.current ?? startedAt;
      setVoiceRecordingMs(Math.max(0, Date.now() - base));
    }, 100);
  } catch {
    stopVoiceStream();
    setErrorText(t("Нет доступа к микрофону"));
  } finally { voiceStartInProgressRef.current = false; }
}

export interface StartVideoRecordingForStreamActionContext {
  videoRecording: boolean;
  videoStartInProgressRef: React.RefObject<boolean>;
  selectedLinkRef: React.RefObject<string | null>;
  voiceHoldActiveRef: React.RefObject<boolean>;
  videoStreamRef: React.RefObject<MediaStream | null>;
  setVideoRecordingStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  videoChunksRef: React.RefObject<Blob[]>;
  videoRecordedMimeTypeRef: React.RefObject<string | null>;
  recordingLocksRef: React.RefObject<{ voice: boolean; video: boolean; }>;
  setVideoRecorderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  videoCaptureRef: React.RefObject<{ stream: MediaStream; setSource: (nextSource: MediaStream) => Promise<void>; stop: () => void; } | null>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  stopVideoStream: () => void;
  videoRecorderRef: React.RefObject<MediaRecorder | null>;
  videoRecordingStartedAtRef: React.RefObject<number | null>;
  setVideoRecordingMs: React.Dispatch<React.SetStateAction<number>>;
  setVideoRecording: React.Dispatch<React.SetStateAction<boolean>>;
  pushRecording: (mode: "video" | "voice", isRecording: boolean) => Promise<void>;
  videoTimerRef: React.RefObject<NodeJS.Timeout | null>;
}

export async function startVideoRecordingForStreamAction({ videoRecording, videoStartInProgressRef, selectedLinkRef, voiceHoldActiveRef, videoStreamRef, setVideoRecordingStream, videoChunksRef, videoRecordedMimeTypeRef, recordingLocksRef, setVideoRecorderOpen, videoCaptureRef, setErrorText, t, stopVideoStream, videoRecorderRef, videoRecordingStartedAtRef, setVideoRecordingMs, setVideoRecording, pushRecording, videoTimerRef }: StartVideoRecordingForStreamActionContext, stream: MediaStream): Promise<void> {
  if (videoRecording || videoStartInProgressRef.current) return;
  videoStartInProgressRef.current = true;
  const recordingLink = selectedLinkRef.current;
  const beganFromHold = voiceHoldActiveRef.current;
  videoStreamRef.current = stream;
  setVideoRecordingStream(stream);
  if (!stream || videoRecording) return;
  videoChunksRef.current = [];
  videoRecordedMimeTypeRef.current = null;
  let recorder: MediaRecorder;
  try {
    const capture = await createVideoNoteCapture(stream);
    if (selectedLinkRef.current !== recordingLink || videoStreamRef.current !== stream || (beganFromHold && !voiceHoldActiveRef.current && !recordingLocksRef.current.video)) { capture.stop(); videoStartInProgressRef.current = false; setVideoRecorderOpen(false); return; }
    videoCaptureRef.current = capture;
    recorder = createVideoRecorder(capture.stream);
    if (recorder.mimeType) {
      videoRecordedMimeTypeRef.current = recorder.mimeType;
    }
  } catch {
    videoStartInProgressRef.current = false;
    setErrorText(t("Не удалось начать запись видеокружка. Проверьте доступ к камере."));
    stopVideoStream();
    setVideoRecorderOpen(false);
    return;
  }
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      if (!videoRecordedMimeTypeRef.current && event.data.type) {
        videoRecordedMimeTypeRef.current = event.data.type;
      }
      videoChunksRef.current.push(event.data);
    }
  };
  try { recorder.start(200); } catch {
    videoStartInProgressRef.current = false;
    stopVideoStream();
    setVideoRecorderOpen(false);
    setErrorText(t("Не удалось начать запись видеокружка"));
    return;
  }
  videoStartInProgressRef.current = false;
  videoRecorderRef.current = recorder;
  const startedAt = Date.now();
  videoRecordingStartedAtRef.current = startedAt;
  setVideoRecordingMs(0);
  setVideoRecording(true);
  void pushRecording("video", true);
  videoTimerRef.current = setInterval(() => {
    const base = videoRecordingStartedAtRef.current ?? startedAt;
    setVideoRecordingMs(Math.max(0, Date.now() - base));
  }, 100);
}

export interface OpenVideoRecorderActionContext {
  videoRecorderOpen: boolean;
  videoOpenInProgressRef: React.RefObject<boolean>;
  syncing: boolean;
  activeChat: ChatSummary | null;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  selectedLinkRef: React.RefObject<string | null>;
  voiceHoldActiveRef: React.RefObject<boolean>;
  requestVideoRecorderStream: (options: RecordingCameraRequest) => Promise<MediaStream>;
  videoFacingMode: "user" | "environment";
  recordingLocksRef: React.RefObject<{ voice: boolean; video: boolean; }>;
  videoStreamRef: React.RefObject<MediaStream | null>;
  setVideoRecordingMs: React.Dispatch<React.SetStateAction<number>>;
  setVideoRecorderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  attachVideoPreviewStream: (stream: MediaStream) => void;
  startVideoRecordingForStream: (stream: MediaStream) => Promise<void>;
  stopVideoStream: () => void;
}

export async function openVideoRecorderAction({ videoRecorderOpen, videoOpenInProgressRef, syncing, activeChat, activeConversationRef, setErrorText, t, selectedLinkRef, voiceHoldActiveRef, requestVideoRecorderStream, videoFacingMode, recordingLocksRef, videoStreamRef, setVideoRecordingMs, setVideoRecorderOpen, attachVideoPreviewStream, startVideoRecordingForStream, stopVideoStream }: OpenVideoRecorderActionContext, autoStart = false): Promise<void> {
  if (videoRecorderOpen || videoOpenInProgressRef.current || syncing || !activeChat) return;
  if (activeConversationRef.current?.chatType === "eclipse") {
    setErrorText(t("Системный бот принимает команды текстом. Для аватара бота выберите изображение в меню создания бота."));
    return;
  }
  videoOpenInProgressRef.current = true;
  const recordingLink = selectedLinkRef.current;
  const beganFromHold = voiceHoldActiveRef.current;
  try {
    const stream = await requestVideoRecorderStream({ facingMode: videoFacingMode });
    if (selectedLinkRef.current !== recordingLink || (beganFromHold && !voiceHoldActiveRef.current && !recordingLocksRef.current.video)) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    videoStreamRef.current = stream;
    setVideoRecordingMs(0);
    setVideoRecorderOpen(true);
    attachVideoPreviewStream(stream);
    if (autoStart) {
      await startVideoRecordingForStream(stream);
    }
  } catch {
    stopVideoStream();
    setErrorText(t("Нет доступа к камере"));
  } finally { videoOpenInProgressRef.current = false; }
}

export interface FinishVideoRecordingActionContext {
  videoFinishInProgressRef: React.RefObject<boolean>;
  videoRecorderRef: React.RefObject<MediaRecorder | null>;
  stopVideoStream: () => void;
  setVideoRecorderOpen: React.Dispatch<React.SetStateAction<boolean>>;
  videoRecordingStartedAtRef: React.RefObject<number | null>;
  videoRecordingMs: number;
  setVideoRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setVideoRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
  videoTimerRef: React.RefObject<NodeJS.Timeout | null>;
  videoChunksRef: React.RefObject<Blob[]>;
  pushRecording: (mode: "video" | "voice", isRecording: boolean) => Promise<void>;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
  sendRecordedMedia: (blob: Blob, kind: "voice" | "video_note", durationMs: number, waveform?: number[] | undefined) => Promise<void>;
  skipMicTapRef: React.RefObject<boolean>;
}

export async function finishVideoRecordingAction({ videoFinishInProgressRef, videoRecorderRef, stopVideoStream, setVideoRecorderOpen, videoRecordingStartedAtRef, videoRecordingMs, setVideoRecording, setVideoRecordingLocked, videoTimerRef, videoChunksRef, pushRecording, setErrorText, t, sendRecordedMedia, skipMicTapRef }: FinishVideoRecordingActionContext, send: boolean): Promise<void> {
  if (videoFinishInProgressRef.current) return;
  const recorder = videoRecorderRef.current;
  if (!recorder) {
    stopVideoStream();
    setVideoRecorderOpen(false);
    return;
  }
  videoFinishInProgressRef.current = true;

  try {
    // Capture exact recorded duration before stopping
    const recordedDurationMs = videoRecordingStartedAtRef.current
      ? Math.max(0, Date.now() - videoRecordingStartedAtRef.current)
      : videoRecordingMs;

    // Fast UI feedback: immediately freeze recording state & timer
    setVideoRecording(false);
    setVideoRecordingLocked(false);
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }

    const rawBlob = await finishMediaRecording(recorder, videoChunksRef.current);
    stopVideoStream();
    setVideoRecorderOpen(false);
    void pushRecording("video", false);

    if (!send || rawBlob.size === 0) return;

    let effectiveDurationMs = Math.max(recordedDurationMs, videoRecordingMs, 0);
    if (effectiveDurationMs <= 0) {
      effectiveDurationMs = await probeBlobDurationMs(rawBlob, "video");
    }
    if (effectiveDurationMs > VIDEO_MAX_DURATION_MS) {
      setErrorText(t("Видеокружок слишком длинный. Максимум 1 минута."));
      return;
    }
    if (rawBlob.size > VIDEO_MAX_BYTES) {
      setErrorText(t("Видеокружок слишком большой. Запишите короче."));
      return;
    }
    await sendRecordedMedia(rawBlob, "video_note", effectiveDurationMs);
    skipMicTapRef.current = false;
  } catch (error) {
    stopVideoStream();
    setVideoRecorderOpen(false);
    setErrorText(error instanceof Error ? error.message : t("Не удалось завершить видеокружок"));
    void pushRecording("video", false);
  } finally {
    videoFinishInProgressRef.current = false;
    videoChunksRef.current = [];
  }
}

export interface HandleMicPointerDownActionContext {
  messageText: string;
  pendingMediaBatch: PendingAlbumItem[] | null;
  pendingImage: PendingImagePayload | null;
  pendingVideo: PendingVideoPayload | null;
  pendingAudio: PendingAudioPayload | null;
  pendingFile: PendingFilePayload | null;
  voicePointerIdRef: React.RefObject<number | null>;
  voicePointerStartRef: React.RefObject<{ x: number; y: number; } | null>;
  voiceHoldActiveRef: React.RefObject<boolean>;
  skipMicTapRef: React.RefObject<boolean>;
  clearVoiceHoldStartTimer: () => void;
  voiceHoldStartTimerRef: React.RefObject<NodeJS.Timeout | null>;
  voiceRecording: boolean;
  videoRecording: boolean;
  setRecordModeHintUntil: React.Dispatch<React.SetStateAction<number>>;
  composerRecordMode: "video" | "voice";
  setVoiceRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
  startVoiceRecording: () => Promise<void>;
  setVideoRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
  openVideoRecorder: (autoStart?: boolean) => Promise<void>;
}

export function handleMicPointerDownAction({ messageText, pendingMediaBatch, pendingImage, pendingVideo, pendingAudio, pendingFile, voicePointerIdRef, voicePointerStartRef, voiceHoldActiveRef, skipMicTapRef, clearVoiceHoldStartTimer, voiceHoldStartTimerRef, voiceRecording, videoRecording, setRecordModeHintUntil, composerRecordMode, setVoiceRecordingLocked, startVoiceRecording, setVideoRecordingLocked, openVideoRecorder }: HandleMicPointerDownActionContext, event: ReactPointerEvent<HTMLButtonElement>): void {
  if (messageText.trim() || pendingMediaBatch?.length || pendingImage || pendingVideo || pendingAudio || pendingFile) return;
  event.preventDefault();
  event.stopPropagation();
  voicePointerIdRef.current = event.pointerId;
  voicePointerStartRef.current = { x: event.clientX, y: event.clientY };
  event.currentTarget.setPointerCapture(event.pointerId);
  voiceHoldActiveRef.current = true;
  skipMicTapRef.current = false;
  clearVoiceHoldStartTimer();
  voiceHoldStartTimerRef.current = setTimeout(() => {
    if (!voiceHoldActiveRef.current || voiceRecording || videoRecording) return;
    skipMicTapRef.current = true;
    setRecordModeHintUntil(0);
    if (composerRecordMode === "voice") {
      setVoiceRecordingLocked(false);
      void startVoiceRecording();
    } else {
      setVideoRecordingLocked(false);
      void openVideoRecorder(true);
    }
  }, 120);
}

export interface HandleMicPointerMoveActionContext {
  voiceHoldActiveRef: React.RefObject<boolean>;
  voiceRecording: boolean;
  videoRecording: boolean;
  voicePointerStartRef: React.RefObject<{ x: number; y: number; } | null>;
  clearVoiceHoldStartTimer: () => void;
  skipMicTapRef: React.RefObject<boolean>;
  composerRecordMode: "video" | "voice";
  setVoiceRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
  startVoiceRecording: () => Promise<void>;
  setVideoRecordingLocked: React.Dispatch<React.SetStateAction<boolean>>;
  openVideoRecorder: (autoStart?: boolean) => Promise<void>;
  voiceRecordingLocked: boolean;
  videoRecordingLocked: boolean;
  cancelVoiceRecording: () => void;
  cancelVideoRecording: () => void;
}

export function handleMicPointerMoveAction({ voiceHoldActiveRef, voiceRecording, videoRecording, voicePointerStartRef, clearVoiceHoldStartTimer, skipMicTapRef, composerRecordMode, setVoiceRecordingLocked, startVoiceRecording, setVideoRecordingLocked, openVideoRecorder, voiceRecordingLocked, videoRecordingLocked, cancelVoiceRecording, cancelVideoRecording }: HandleMicPointerMoveActionContext, event: ReactPointerEvent<HTMLButtonElement>): void {
  if (voiceHoldActiveRef.current || voiceRecording || videoRecording) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (!voiceHoldActiveRef.current) return;
  const start = voicePointerStartRef.current;
  if (!start) return;
  const deltaX = event.clientX - start.x;
  const deltaY = event.clientY - start.y;
  const leftOffset = Math.min(0, deltaX);
  const upOffset = Math.min(0, deltaY);
  const hasRecording = voiceRecording || videoRecording;
  if (!hasRecording && upOffset <= -RECORD_START_SWIPE_UP_PX) {
    clearVoiceHoldStartTimer();
    skipMicTapRef.current = true;
    if (composerRecordMode === "voice") {
      setVoiceRecordingLocked(true);
      void startVoiceRecording();
    } else {
      setVideoRecordingLocked(true);
      void openVideoRecorder(true);
    }
    voiceHoldActiveRef.current = false;
    return;
  }
  if (!hasRecording) return;
  const locked = voiceRecording ? voiceRecordingLocked : videoRecordingLocked;
  if (locked) return;
  if (leftOffset <= -VOICE_CANCEL_THRESHOLD_PX) {
    clearVoiceHoldStartTimer();
    voiceHoldActiveRef.current = false;
    skipMicTapRef.current = true;
    if (voiceRecording) {
      cancelVoiceRecording();
    } else if (videoRecording) {
      cancelVideoRecording();
    }
    return;
  }
  if (upOffset <= -VOICE_LOCK_THRESHOLD_PX) {
    clearVoiceHoldStartTimer();
    if (voiceRecording) {
      setVoiceRecordingLocked(true);
    } else if (videoRecording) {
      setVideoRecordingLocked(true);
    }
    voiceHoldActiveRef.current = false;
    skipMicTapRef.current = true;
  }
}

export interface HandleMicPointerUpActionContext {
  voiceHoldActiveRef: React.RefObject<boolean>;
  clearVoiceHoldStartTimer: () => void;
  voicePointerIdRef: React.RefObject<number | null>;
  voicePointerStartRef: React.RefObject<{ x: number; y: number; } | null>;
  voiceRecording: boolean;
  videoRecording: boolean;
  voiceRecordingLocked: boolean;
  videoRecordingLocked: boolean;
  skipMicTapRef: React.RefObject<boolean>;
  finishVoiceRecording: (send: boolean) => Promise<void>;
  finishVideoRecording: (send: boolean) => Promise<void>;
}

export function handleMicPointerUpAction({ voiceHoldActiveRef, clearVoiceHoldStartTimer, voicePointerIdRef, voicePointerStartRef, voiceRecording, videoRecording, voiceRecordingLocked, videoRecordingLocked, skipMicTapRef, finishVoiceRecording, finishVideoRecording }: HandleMicPointerUpActionContext, event: ReactPointerEvent<HTMLButtonElement>): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  if (!voiceHoldActiveRef.current) {
    clearVoiceHoldStartTimer();
    voicePointerIdRef.current = null;
    voicePointerStartRef.current = null;
    return;
  }
  clearVoiceHoldStartTimer();
  voiceHoldActiveRef.current = false;
  voicePointerIdRef.current = null;
  voicePointerStartRef.current = null;
  if (voiceRecording || videoRecording) {
    const locked = voiceRecording ? voiceRecordingLocked : videoRecordingLocked;
    if (locked) return;
    skipMicTapRef.current = true;
    if (voiceRecording) {
      void finishVoiceRecording(true);
    } else {
      void finishVideoRecording(true);
    }
    return;
  }
}

export interface HandleMicPointerCancelActionContext {
  voiceHoldActiveRef: React.RefObject<boolean>;
  clearVoiceHoldStartTimer: () => void;
  voicePointerIdRef: React.RefObject<number | null>;
  voicePointerStartRef: React.RefObject<{ x: number; y: number; } | null>;
  voiceRecording: boolean;
  videoRecording: boolean;
  voiceRecordingLocked: boolean;
  videoRecordingLocked: boolean;
  skipMicTapRef: React.RefObject<boolean>;
  cancelVoiceRecording: () => void;
  cancelVideoRecording: () => void;
}

export function handleMicPointerCancelAction({ voiceHoldActiveRef, clearVoiceHoldStartTimer, voicePointerIdRef, voicePointerStartRef, voiceRecording, videoRecording, voiceRecordingLocked, videoRecordingLocked, skipMicTapRef, cancelVoiceRecording, cancelVideoRecording }: HandleMicPointerCancelActionContext, event: ReactPointerEvent<HTMLButtonElement>): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  if (!voiceHoldActiveRef.current) {
    clearVoiceHoldStartTimer();
    voicePointerIdRef.current = null;
    voicePointerStartRef.current = null;
    return;
  }
  clearVoiceHoldStartTimer();
  voiceHoldActiveRef.current = false;
  voicePointerIdRef.current = null;
  voicePointerStartRef.current = null;
  if (voiceRecording || videoRecording) {
    const locked = voiceRecording ? voiceRecordingLocked : videoRecordingLocked;
    if (locked) return;
    skipMicTapRef.current = true;
    if (voiceRecording) {
      cancelVoiceRecording();
    } else {
      cancelVideoRecording();
    }
  }
}

export interface BindRecordingGesturesContext {
  voiceRecording: boolean;
  videoRecording: boolean;
  voiceHoldActiveRef: React.RefObject<boolean>;
  voicePointerIdRef: React.RefObject<number | null>;
  clearVoiceHoldStartTimer: () => void;
  voicePointerStartRef: React.RefObject<{ x: number; y: number; } | null>;
  voiceRecordingLocked: boolean;
  videoRecordingLocked: boolean;
  skipMicTapRef: React.RefObject<boolean>;
  cancelVoiceRecording: () => void;
  cancelVideoRecording: () => void;
  finishVoiceRecording: (send: boolean) => Promise<void>;
  finishVideoRecording: (send: boolean) => Promise<void>;
  handleMicPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
}

export function bindRecordingGestures({ voiceRecording, videoRecording, voiceHoldActiveRef, voicePointerIdRef, clearVoiceHoldStartTimer, voicePointerStartRef, voiceRecordingLocked, videoRecordingLocked, skipMicTapRef, cancelVoiceRecording, cancelVideoRecording, finishVoiceRecording, finishVideoRecording, handleMicPointerMove }: BindRecordingGesturesContext): (() => void) | undefined {
  if (!voiceRecording && !videoRecording) return;
  // The composer replaces the microphone button while recording, releasing
  // its pointer capture. Observe release outside that removed button too.
  const release = (event: PointerEvent) => {
    if (!voiceHoldActiveRef.current || voicePointerIdRef.current !== event.pointerId) return;
    clearVoiceHoldStartTimer();
    voiceHoldActiveRef.current = false;
    voicePointerIdRef.current = null;
    voicePointerStartRef.current = null;
    if (voiceRecording ? voiceRecordingLocked : videoRecordingLocked) return;
    skipMicTapRef.current = true;
    if (event.type === "pointercancel") {
      if (voiceRecording) cancelVoiceRecording();
      else cancelVideoRecording();
    } else if (voiceRecording) {
      void finishVoiceRecording(true);
    } else {
      void finishVideoRecording(true);
    }
  };
  const move = (event: PointerEvent) => {
    if (voiceHoldActiveRef.current && voicePointerIdRef.current === event.pointerId) {
      handleMicPointerMove(event as unknown as ReactPointerEvent<HTMLButtonElement>);
    }
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  return () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
  };
}

export interface RefreshSystemBotCommandsContext {
  activeConversation: ConversationResponse | null;
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
}

export function refreshSystemBotCommands({ activeConversation, setActiveConversation }: RefreshSystemBotCommandsContext): (() => void) | undefined {
  if (activeConversation?.chatType !== "direct" || activeConversation.peer?.isBot) return;
  if (activeConversation.peer?.publicKey && !activeConversation.peer.publicKey.startsWith("encdet:v1:")) return;
  if (!activeConversation.peer?.link) return;

  let cancelled = false;
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    try {
      const keyState = await apiRequest<{ publicKey: string | null }>(
        `/api/settings/e2e-key/${encodeURIComponent(activeConversation.peer!.link)}`,
        { method: "GET" },
      );
      if (cancelled || !keyState.publicKey || keyState.publicKey.startsWith("encdet:v1:")) return;
      setActiveConversation((prev) =>
        prev?.chatType === "direct" && prev.peer
          ? { ...prev, peer: { ...prev.peer, publicKey: keyState.publicKey } }
          : prev,
      );
    } catch {
      // polling is best-effort
    }
    if (attempts >= DIRECT_PEER_KEY_POLL_MAX_ATTEMPTS) {
      clearInterval(timer);
    }
  }, DIRECT_PEER_KEY_POLL_INTERVAL_MS);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

export interface UpdateLastMessagePreviewAfterDeleteActionContext {
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  readProfileFromCache: (userId: string) => ProfileBatchItem | null;
  selfId: string | null;
}

export function updateLastMessagePreviewAfterDeleteAction({ setChats, readProfileFromCache, selfId }: UpdateLastMessagePreviewAfterDeleteActionContext, nextMessages: DecryptedMessage[], link: string): void {
  const last = nextMessages[nextMessages.length - 1] ?? null;
  setChats((prev) =>
    prev.map((chat) => {
      if (chat.link !== link) return chat;
      if (!last) {
        return { ...chat, lastMessage: "", lastMessageMine: false };
      }
      const previewBase = last.text;
      const senderProfile = chat.chatType === "group" ? readProfileFromCache(last.senderId) : null;
      const senderName = last.senderDisplayName || senderProfile?.displayName || "";
      const preview =
        chat.chatType === "group" && senderName
          ? `${senderName}: ${previewBase}`
          : previewBase;
      return {
        ...chat,
        lastMessage: preview,
        lastMessageAt: last.createdAt,
        lastMessageMine: last.senderId === selfId,
      };
    }),
  );
}

export interface SyncConversationCacheMessagesActionContext {
  selfId: string | null;
  selectedLink: string | null;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  messages: DecryptedMessage[];
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  setActiveConversation: React.Dispatch<React.SetStateAction<ConversationResponse | null>>;
}

export function syncConversationCacheMessagesAction({ selfId, selectedLink, activeConversationRef, messages, sanitizeMessages, setActiveConversation }: SyncConversationCacheMessagesActionContext, link: string, chatType: ConversationChatType, updater: (messages: DecryptedMessage[]) => DecryptedMessage[]): void {
  const cachedSnapshot = selfId
    ? readConversationMemoryCache(selfId, link, chatType) ??
    loadConversationSessionCache(selfId, link, chatType) ??
    loadConversationPersistentCache(selfId, link, chatType)
    : null;
  const activeSnapshot =
    selectedLink === link && activeConversationRef.current?.chatType === chatType
      ? activeConversationRef.current
      : null;
  const baseSnapshot = cachedSnapshot
    ? cachedSnapshot
    : activeSnapshot
      ? {
        savedAt: Date.now(),
        conversation: activeSnapshot,
        messages,
      }
      : null;
  if (!baseSnapshot) return;
  const nextMessages = sanitizeMessages(updater(baseSnapshot.messages));
  cacheConversationSnapshot(
    selfId,
    link,
    {
      savedAt: Date.now(),
      conversation: baseSnapshot.conversation,
      messages: nextMessages,
    },
    chatType,
  );
  if (selectedLink === link && activeConversationRef.current?.chatType === chatType) {
    setActiveConversation((prev) => (prev?.chatType === chatType ? { ...prev, messages: nextMessages } : prev));
  }
}

export interface AnimateDeleteMessageActionContext {
  markMessageDeletedTombstone: (messageId: string | string[]) => void;
  syncConversationCacheMessages: (link: string, chatType: ConversationChatType, updater: (messages: DecryptedMessage[]) => DecryptedMessage[]) => void;
  selectedLinkRef: React.RefObject<string | null>;
  activeConversationRef: React.RefObject<ConversationResponse | null>;
  setRemovingMessageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  messages: DecryptedMessage[];
  messageOffsets: { offsets: number[]; totalHeight: number; };
  messageHeightsRef: React.RefObject<Record<string, number>>;
  messageSizes: number[];
  setDeletingShift: React.Dispatch<React.SetStateAction<MessageDeletionShift | null>>;
  deleteAnimationTimersRef: React.RefObject<Record<string, NodeJS.Timeout>>;
  setMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  sanitizeMessages: (items: DecryptedMessage[]) => DecryptedMessage[];
  updateLastMessagePreviewAfterDelete: (nextMessages: DecryptedMessage[], link: string) => void;
}

export function animateDeleteMessageAction({ markMessageDeletedTombstone, syncConversationCacheMessages, selectedLinkRef, activeConversationRef, setRemovingMessageIds, messages, messageOffsets, messageHeightsRef, messageSizes, setDeletingShift, deleteAnimationTimersRef, setMessages, sanitizeMessages, updateLastMessagePreviewAfterDelete }: AnimateDeleteMessageActionContext, messageId: string | string[], link: string, chatType: ConversationChatType = "direct"): void {
  const ids = [...new Set(Array.isArray(messageId) ? messageId : [messageId])];
  const selected = new Set(ids);
  markMessageDeletedTombstone(ids);
  syncConversationCacheMessages(link, chatType, cached => cached.filter(message => !selected.has(message.id)));
  if (selectedLinkRef.current !== link || activeConversationRef.current?.chatType !== chatType) return;
  let duration = 0;
  for (const id of ids) duration = Math.max(duration, startMessageDissolve(id));
  setRemovingMessageIds(previous => new Set([...previous, ...ids]));
  const rows = messages.flatMap((message, index) => {
    if (!selected.has(message.id)) return [];
    const nextOffset = messageOffsets.offsets[index + 1], offset = messageOffsets.offsets[index];
    const height = nextOffset !== undefined && offset !== undefined ? Math.max(0, nextOffset - offset) : messageHeightsRef.current[message.id] ?? (message.localId ? messageHeightsRef.current[message.localId] : undefined) ?? messageSizes[index] ?? 60;
    return [{ id: message.id, index, height }];
  });
  if (rows.length) setDeletingShift(previous => {
    const combined = [...(previous?.rows ?? []).filter(row => !selected.has(row.id)), ...rows].sort((a,b) => a.index-b.index);
    return { afterIndex: combined[0].index, shiftY: combined.reduce((sum,row) => sum+row.height,0), rows: combined };
  });
  const timer = setTimeout(() => {
    const activeIds = new Set(ids.filter(id => deleteAnimationTimersRef.current[id] === timer));
    if (!activeIds.size) return;
    activeIds.forEach(finishMessageDissolve);
    syncConversationCacheMessages(link, chatType, cached => cached.filter(message => !activeIds.has(message.id)));
    activeIds.forEach(id => { delete deleteAnimationTimersRef.current[id]; });
    setDeletingShift(previous => {
      const remaining = previous?.rows?.filter(row => !activeIds.has(row.id)).map(row => ({ ...row, index: row.index - rows.filter(removed => activeIds.has(removed.id) && removed.index < row.index).length }));
      return remaining?.length ? { afterIndex: remaining[0].index, shiftY: remaining.reduce((sum,row) => sum+row.height,0), rows: remaining } : null;
    });
    if (selectedLinkRef.current === link && activeConversationRef.current?.chatType === chatType) setMessages(previous => {
      const next = sanitizeMessages(previous.filter(message => !activeIds.has(message.id)));
      updateLastMessagePreviewAfterDelete(next,link);
      return next;
    });
    setRemovingMessageIds(previous => new Set([...previous].filter(id => !activeIds.has(id))));
    requestAnimationFrame(() => activeIds.forEach(cancelMessageDissolve));
  }, duration);
  ids.forEach(id => { deleteAnimationTimersRef.current[id] = timer; });
}


export interface FinalizePendingSelectionDeleteActionContext {
  pendingSelectionDeleteRef: React.RefObject<{ messageIds: string[]; link: string; chatType: ConversationChatType; previousMessages: DecryptedMessage[]; previousHiddenMessageIds: string[]; mode: "mine" | "everyone"; finalizeTimer?: NodeJS.Timeout | undefined; } | null>;
  setSelectionDeleting: React.Dispatch<React.SetStateAction<boolean>>;
  rollbackPendingSelectionDelete: (pending: { messageIds: string[]; link: string; chatType: ConversationChatType; previousMessages: DecryptedMessage[]; previousHiddenMessageIds: string[]; mode: "mine" | "everyone"; finalizeTimer?: NodeJS.Timeout | undefined; }) => void;
  setErrorText: (message: string | null) => void;
  t: (source: string, values?: TranslationValues | undefined) => string;
}

export async function finalizePendingSelectionDeleteAction({ pendingSelectionDeleteRef, setSelectionDeleting, rollbackPendingSelectionDelete, setErrorText, t }: FinalizePendingSelectionDeleteActionContext): Promise<void> {
  const pending = pendingSelectionDeleteRef.current;
  if (!pending) return;
  pendingSelectionDeleteRef.current = null;
  setSelectionDeleting(true);
  const localOnly = new Set(pending.previousMessages.filter(message => message.sendFailure).map(message => message.id));
  const validServerIds = pending.messageIds.filter(
    (id) => !id.startsWith("optimistic:") && !id.startsWith("msg:") && !localOnly.has(id),
  );
  try {
    if (validServerIds.length > 0) {
      const results = await mapConcurrentSettled(validServerIds, 6, (messageId) =>
          apiRequest(`/api/chats/${encodeURIComponent(pending.link)}?chatType=${pending.chatType}`, {
            method: "DELETE",
            body: JSON.stringify({
              messageId,
              mode: pending.mode,
            }),
          }),
      );
      const failedIds = validServerIds.filter((_, index) => results[index].status === "rejected");
      if (failedIds.length) {
        const successfulIds = new Set(pending.messageIds.filter(id => !failedIds.includes(id)));
        rollbackPendingSelectionDelete({
          ...pending, messageIds: failedIds,
          previousMessages: pending.previousMessages.filter(message => !successfulIds.has(message.id))
        });
        const failure = results.find(result => result.status === "rejected") as PromiseRejectedResult;
        setErrorText(failure.reason instanceof Error ? failure.reason.message : t("Ошибка удаления сообщения"));
      }
    }
  } catch (error) {
    rollbackPendingSelectionDelete(pending);
    setErrorText(error instanceof Error ? error.message : t("Ошибка удаления сообщения"));
  } finally {
    setSelectionDeleting(false);
  }
}
