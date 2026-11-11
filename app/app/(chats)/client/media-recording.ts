"use client";

import { dateLocale } from "@/lib/i18n/translate";

export function getSupportedVideoRecorderMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }
  const isAppleWebKit =
    typeof navigator !== "undefined" &&
    /AppleWebKit/i.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg|OPR|Firefox/i.test(navigator.userAgent);
  if (isAppleWebKit) {
    const appleCandidates = [
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4",
    ];
    for (const type of appleCandidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
  }
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export function getSupportedAudioRecorderMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }
  const isAppleWebKit =
    typeof navigator !== "undefined" &&
    /AppleWebKit/i.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg|OPR|Firefox/i.test(navigator.userAgent);
  if (isAppleWebKit) {
    return MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : null;
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export function createAudioRecorder(stream: MediaStream) {
  const preferredMimeType = getSupportedAudioRecorderMimeType();
  const optionCandidates: MediaRecorderOptions[] = [];
  if (preferredMimeType) {
    optionCandidates.push(
      { mimeType: preferredMimeType, audioBitsPerSecond: 256_000 },
      { mimeType: preferredMimeType, audioBitsPerSecond: 192_000 },
      { mimeType: preferredMimeType, audioBitsPerSecond: 128_000 },
      { mimeType: preferredMimeType },
    );
  }
  optionCandidates.push(
    { audioBitsPerSecond: 256_000 },
    { audioBitsPerSecond: 192_000 },
    { audioBitsPerSecond: 128_000 },
    {},
  );

  for (const options of optionCandidates) {
    try {
      return new MediaRecorder(stream, options);
    } catch {
      // try next fallback
    }
  }
  throw new Error("audio_recorder_unsupported");
}

export function createVideoRecorder(stream: MediaStream) {
  const preferredMimeType = getSupportedVideoRecorderMimeType();
  const optionCandidates: MediaRecorderOptions[] = [];
  if (preferredMimeType) {
    optionCandidates.push(
      {
        mimeType: preferredMimeType,
        videoBitsPerSecond: 3_000_000,
        audioBitsPerSecond: 128_000,
      },
      {
        mimeType: preferredMimeType,
        videoBitsPerSecond: 2_000_000,
        audioBitsPerSecond: 128_000,
      },
      { mimeType: preferredMimeType },
    );
  }
  optionCandidates.push(
    {
      videoBitsPerSecond: 3_000_000,
      audioBitsPerSecond: 128_000,
    },
    {
      videoBitsPerSecond: 2_000_000,
      audioBitsPerSecond: 128_000,
    },
    {},
  );

  for (const options of optionCandidates) {
    try {
      return new MediaRecorder(stream, options);
    } catch {
      // try next fallback
    }
  }
  throw new Error("video_recorder_unsupported");
}

export function formatMediaDuration(durationMs: number) {
  const safeDuration = Math.max(0, Math.floor(durationMs));
  const totalSeconds = Math.floor(safeDuration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((safeDuration % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(centiseconds).padStart(2, "0")}`;
}

export function formatDurationFromSeconds(secondsInput: number) {
  const totalSeconds = Math.max(0, Math.floor(secondsInput));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatMediaViewerDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(dateLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function probeBlobDurationMs(blob: Blob, mediaKind: "audio" | "video") {
  if (typeof window === "undefined") return 0;
  return await new Promise<number>((resolve) => {
    const element = document.createElement(mediaKind);
    const objectUrl = URL.createObjectURL(blob);
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      element.removeAttribute("src");
      try {
        element.load();
      } catch {
        // ignore
      }
      URL.revokeObjectURL(objectUrl);
    };
    const finish = (value: number) => {
      cleanup();
      resolve(Math.max(0, Math.round(value)));
    };
    const timeoutId = window.setTimeout(() => finish(0), 3000);
    const clearTimer = () => window.clearTimeout(timeoutId);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      if (element.duration === Infinity) {
        element.currentTime = 1e101;
        element.ontimeupdate = () => {
          element.ontimeupdate = null;
          element.currentTime = 0;
          clearTimer();
          const d = Number.isFinite(element.duration) ? element.duration : 0;
          finish(d > 0 ? d * 1000 : 0);
        };
        return;
      }
      clearTimer();
      const durationSeconds = Number.isFinite(element.duration) ? element.duration : 0;
      finish(durationSeconds > 0 ? durationSeconds * 1000 : 0);
    };
    element.onerror = () => {
      clearTimer();
      finish(0);
    };
    element.src = objectUrl;
  });
}

export async function flushRecorderThenStop(recorder: MediaRecorder, drainMs = 0) {
  if (recorder.state === "inactive") return;
  if (drainMs > 0) {
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), drainMs);
    });
  }
  try {
    if (recorder.state === "recording") {
      recorder.requestData();
    }
  } catch {
    // ignore
  }
  try {
    recorder.stop();
  } catch {
    // ignore
  }
}

export async function getVideoDurationMs(file: File) {
  return probeBlobDurationMs(file, "video");
}

export async function getAudioDurationMs(file: File) {
  return probeBlobDurationMs(file, "audio");
}

export async function convertHeicToJpeg(file: File) {
  const mod = await import("heic2any");
  const heic2any = (mod as { default: (options: { blob: Blob; toType: string; quality?: number }) => Promise<Blob | Blob[]> })
    .default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], file.name.replace(/\.[^.]+$/u, ".jpg"), { type: "image/jpeg" });
}

export function canPlayVideoFile(file: File) {
  if (typeof document === "undefined") return true;
  const video = document.createElement("video");
  const type = file.type || "video/mp4";
  const result = video.canPlayType(type);
  return result === "probably" || result === "maybe";
}
