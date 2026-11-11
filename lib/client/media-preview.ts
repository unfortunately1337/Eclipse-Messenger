"use client";

import { normalizeMediaAspectRatio, normalizeMediaPreview, type MediaPreviewDetails } from "@/lib/media-preview";
import { cacheMediaPreviewDetails, getDecodedMediaPreview } from "./media-cache";

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

const localPreviews = new WeakMap<Blob, Promise<MediaPreviewDetails>>();

export function makeMediaPreviewDetails(file: Blob, kind: "image" | "video"): Promise<MediaPreviewDetails> {
  const cached = localPreviews.get(file);
  if (cached) return cached;
  const details = new Promise<MediaPreviewDetails>(resolve => {
    const url = URL.createObjectURL(file);
    const media = kind === "video" ? document.createElement("video") : new Image();
    const finish = (preview?: string) => {
      clearTimeout(timeout);
      const aspectRatio = normalizeMediaAspectRatio(media instanceof HTMLVideoElement
        ? media.videoWidth / media.videoHeight : media.naturalWidth / media.naturalHeight);
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
      resolve({ preview, aspectRatio });
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
  localPreviews.set(file, details);
  return details;
}

export async function makeMediaPreview(file: Blob, kind: "image" | "video"): Promise<string | undefined> {
  return (await makeMediaPreviewDetails(file, kind)).preview;
}

export function rememberDecodedMediaPreview(src: string, media: HTMLImageElement | HTMLVideoElement): MediaPreviewDetails {
  if (!src) return {};
  const aspectRatio = normalizeMediaAspectRatio("videoWidth" in media
    ? media.videoWidth / media.videoHeight : media.naturalWidth / media.naturalHeight);
  const preview = getDecodedMediaPreview(src) ?? captureMediaPreview(media);
  const details = { preview, aspectRatio };
  // Older attachments can have a preview but no dimensions. Keep enriching
  // that entry, including when a cross-origin image cannot be read to canvas.
  cacheMediaPreviewDetails(src, details);
  return details;
}
