"use client";

import { normalizeMediaPreview } from "@/lib/media-preview";
import { cacheDecodedMediaPreview, getDecodedMediaPreview } from "./media-cache";

export function captureMediaPreview(media: HTMLImageElement | HTMLVideoElement): string | undefined {
  const width = "videoWidth" in media ? media.videoWidth : media.naturalWidth;
  const height = "videoHeight" in media ? media.videoHeight : media.naturalHeight;
  if (!width || !height) return;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    for (const limit of [48, 28]) {
      const scale = Math.min(1, limit / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
      const preview = normalizeMediaPreview(canvas.toDataURL("image/jpeg", 0.52));
      if (preview) return preview;
    }
  } catch {
    // An image from another origin can be displayed but cannot be read back.
  }
}

export function makeMediaPreview(file: Blob, kind: "image" | "video"): Promise<string | undefined> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const media = kind === "video" ? document.createElement("video") : new Image();
    const finish = (preview?: string) => {
      clearTimeout(timeout);
      media.onerror = null;
      media.onload = null;
      if (media instanceof HTMLVideoElement) {
        media.onloadeddata = null;
        media.removeAttribute("src");
        media.load();
      } else {
        media.removeAttribute("src");
      }
      URL.revokeObjectURL(url);
      resolve(preview);
    };
    const timeout = setTimeout(() => finish(), 1800);
    media.onerror = () => finish();
    if (media instanceof HTMLVideoElement) {
      media.muted = true;
      media.playsInline = true;
      media.preload = "auto";
      media.onloadeddata = () => finish(captureMediaPreview(media));
    } else {
      media.onload = () => finish(captureMediaPreview(media));
    }
    media.src = url;
  });
}

export function rememberDecodedMediaPreview(src: string, media: HTMLImageElement | HTMLVideoElement) {
  if (!src || getDecodedMediaPreview(src)) return;
  const preview = captureMediaPreview(media);
  if (preview) cacheDecodedMediaPreview(src, preview);
}
