"use client";

import { createVideoNoteCapture } from "@/lib/client/media-recording";
import { useRef, useState } from "react";
import { type PendingVideoPayload, type PendingImagePayload, type PendingAlbumItem, type PendingAudioPayload, type PendingFilePayload, type RealtimeSendingPayload, type EditTarget } from "../../types";

export function useAttachmentDraftState() {
  const [pendingMediaBatch, setPendingMediaBatch] = useState<PendingAlbumItem[] | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImagePayload | null>(null);
  const [pendingVideo, setPendingVideo] = useState<PendingVideoPayload | null>(null);
  const [pendingAudio, setPendingAudio] = useState<PendingAudioPayload | null>(null);
  const [pendingFile, setPendingFile] = useState<PendingFilePayload | null>(null);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [hasRenderedPicker, setHasRenderedPicker] = useState(false);
  return {
    pendingMediaBatch,
    setPendingMediaBatch,
    pendingImage,
    setPendingImage,
    pendingVideo,
    setPendingVideo,
    pendingAudio,
    setPendingAudio,
    pendingFile,
    setPendingFile,
    stickerPickerOpen,
    setStickerPickerOpen,
    hasRenderedPicker,
    setHasRenderedPicker
  };
}

export function useWallpaperUploadState() {
  const [dragActive, setDragActive] = useState(false);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperTargetRef = useRef<string | null>(null);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [applyingWallpaper, setApplyingWallpaper] = useState(false);
  const pickedFilesProcessingRef = useRef(false);
  return {
    dragActive,
    setDragActive,
    wallpaperFileInputRef,
    wallpaperTargetRef,
    uploadingWallpaper,
    setUploadingWallpaper,
    applyingWallpaper,
    setApplyingWallpaper,
    pickedFilesProcessingRef
  };
}

export function usePollDraftState() {
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollQuizMode, setPollQuizMode] = useState(false);
  const [pollCorrectOptionIndex, setPollCorrectOptionIndex] = useState<number | null>(null);
  const [pollExpiresInHours, setPollExpiresInHours] = useState<number | null>(24);
  return {
    pollDialogOpen,
    setPollDialogOpen,
    pollQuestion,
    setPollQuestion,
    pollOptions,
    setPollOptions,
    pollQuizMode,
    setPollQuizMode,
    pollCorrectOptionIndex,
    setPollCorrectOptionIndex,
    pollExpiresInHours,
    setPollExpiresInHours
  };
}

export function useRecorderPresentationState() {
  const [typingByLink, setTypingByLink] = useState<Record<string, Record<string, string>>>({});
  const [recordingByLink, setRecordingByLink] = useState<Record<string, Record<string, string>>>({});
  const [sendingByLink, setSendingByLink] = useState<Record<string, Record<string, string>>>({});
  const [composerRecordMode, setComposerRecordMode] = useState<"voice" | "video">("voice");
  const [recordModeHintUntil, setRecordModeHintUntil] = useState(0);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceRecordingLocked, setVoiceRecordingLocked] = useState(false);
  const [voiceRecordingMs, setVoiceRecordingMs] = useState(0);
  const [voiceRecordingStream, setVoiceRecordingStream] = useState<MediaStream | null>(null);
  const [videoRecordingStream, setVideoRecordingStream] = useState<MediaStream | null>(null);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoCameraSwitching, setVideoCameraSwitching] = useState(false);
  const [videoRecordingLocked, setVideoRecordingLocked] = useState(false);
  const recordingLocksRef = useRef({ voice: false, video: false });
  return {
    typingByLink,
    setTypingByLink,
    recordingByLink,
    setRecordingByLink,
    sendingByLink,
    setSendingByLink,
    composerRecordMode,
    setComposerRecordMode,
    recordModeHintUntil,
    setRecordModeHintUntil,
    voiceRecording,
    setVoiceRecording,
    voiceRecordingLocked,
    setVoiceRecordingLocked,
    voiceRecordingMs,
    setVoiceRecordingMs,
    voiceRecordingStream,
    setVoiceRecordingStream,
    videoRecordingStream,
    setVideoRecordingStream,
    videoRecorderOpen,
    setVideoRecorderOpen,
    videoRecording,
    setVideoRecording,
    videoCameraSwitching,
    setVideoCameraSwitching,
    videoRecordingLocked,
    setVideoRecordingLocked,
    recordingLocksRef
  };
}

export function useComposerInteractionState() {
  const voiceStartInProgressRef = useRef(false);
  const videoOpenInProgressRef = useRef(false);
  const [videoRecordingMs, setVideoRecordingMs] = useState(0);
  const [videoFacingMode, setVideoFacingMode] = useState<"user" | "environment">("user");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [swipeMessageId, setSwipeMessageId] = useState<string | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const profileFetchInFlightRef = useRef<Set<string>>(new Set());
  const queuedProfileFetchIdsRef = useRef<Set<string>>(new Set());
  const queuedProfileFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedProfileFetchPromiseRef = useRef<Promise<void> | null>(null);
  const chatListLongPressTimerRef = useRef<number | null>(null);
  const chatListLongPressTriggeredRef = useRef(false);
  const chatListSuppressClickLinkRef = useRef<string | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingResetByLinkRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const recordingResetByLinkRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sendingResetByLinkRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const recordingHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const lastTypingValueRef = useRef<boolean | null>(null);
  const voiceHoldActiveRef = useRef(false);
  const preventPickerCloseOnFocusRef = useRef(false);
  return {
    voiceStartInProgressRef,
    videoOpenInProgressRef,
    videoRecordingMs,
    setVideoRecordingMs,
    videoFacingMode,
    setVideoFacingMode,
    replyToMessageId,
    setReplyToMessageId,
    editTarget,
    setEditTarget,
    editSaving,
    setEditSaving,
    swipeMessageId,
    setSwipeMessageId,
    swipeOffsetX,
    setSwipeOffsetX,
    profileFetchInFlightRef,
    queuedProfileFetchIdsRef,
    queuedProfileFetchTimerRef,
    queuedProfileFetchPromiseRef,
    chatListLongPressTimerRef,
    chatListLongPressTriggeredRef,
    chatListSuppressClickLinkRef,
    typingStopTimerRef,
    typingResetByLinkRef,
    recordingResetByLinkRef,
    sendingResetByLinkRef,
    recordingHeartbeatRef,
    sendingHeartbeatRef,
    lastTypingSentAtRef,
    lastTypingValueRef,
    voiceHoldActiveRef,
    preventPickerCloseOnFocusRef
  };
}

export function useMediaRecorderState() {
  const micRecordButtonRef = useRef<HTMLButtonElement | null>(null);
  const voicePointerIdRef = useRef<number | null>(null);
  const voicePointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const voiceHoldStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRecordingStartedAtRef = useRef<number | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceWaveformSamplesRef = useRef<number[]>([]);
  const voiceRecordedMimeTypeRef = useRef<string | null>(null);
  const voiceFinishInProgressRef = useRef(false);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoCaptureRef = useRef<Awaited<ReturnType<typeof createVideoNoteCapture>> | null>(null);
  const videoStartInProgressRef = useRef(false);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoRecordingStartedAtRef = useRef<number | null>(null);
  const videoRecordedMimeTypeRef = useRef<string | null>(null);
  const videoFinishInProgressRef = useRef(false);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sendingRealtimeKind, setSendingRealtimeKind] = useState<RealtimeSendingPayload["kind"] | null>(null);
  return {
    micRecordButtonRef,
    voicePointerIdRef,
    voicePointerStartRef,
    voiceHoldStartTimerRef,
    voiceRecordingStartedAtRef,
    voiceStreamRef,
    voiceRecorderRef,
    voiceChunksRef,
    voiceWaveformSamplesRef,
    voiceRecordedMimeTypeRef,
    voiceFinishInProgressRef,
    voiceTimerRef,
    videoStreamRef,
    videoRecorderRef,
    videoCaptureRef,
    videoStartInProgressRef,
    videoChunksRef,
    videoRecordingStartedAtRef,
    videoRecordedMimeTypeRef,
    videoFinishInProgressRef,
    videoTimerRef,
    sendingRealtimeKind,
    setSendingRealtimeKind
  };
}
