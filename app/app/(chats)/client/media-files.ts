"use client";

export const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const HEIC_IMAGE_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export const AUDIO_MAX_BYTES = 100 * 1024 * 1024;

export const FILE_MAX_BYTES = 100 * 1024 * 1024;

export const AUDIO_MAX_DURATION_MS = 600_000;

export function formatFileSize(size: number) {
  const safeSize = Math.max(0, size);
  if (safeSize >= 1024 * 1024) {
    return `${(safeSize / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (safeSize >= 1024) {
    return `${Math.round(safeSize / 1024)} KB`;
  }
  return `${safeSize} B`;
}

export const GROUP_AVATAR_LIMITS = {
  imageMaxBytes: 3_000_000,
  videoMaxBytes: 5_000_000,
  maxDurationMs: 5_000,
} as const;

export const CHANNEL_AVATAR_LIMITS = {
  imageMaxBytes: 3_000_000,
  videoMaxBytes: 5_000_000,
  maxDurationMs: 5_000,
} as const;

export const isGifFile = (file: File) => file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

export const isAudioFile = (file: File) =>
  file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);

export async function optimizeStoryImageFile(file: File) {
  if (typeof document === "undefined" || isGifFile(file)) return file;
  if (file.size <= 250_000 && !/^image\/(png|bmp|tiff)$/i.test(file.type)) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxSide = 1920;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob || blob.size >= file.size) return file;
    const nextName = file.name.replace(/\.[^.]+$/u, ".jpg") || `story-${Date.now()}.jpg`;
    return new File([blob], nextName, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

export async function resolveImageAverageColor(file: Blob) {
  if (typeof document === "undefined") return "#151515";
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) return "#151515";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    }
    if (count <= 0) return "#151515";
    const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value / count))).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return "#151515";
  } finally {
    bitmap?.close();
  }
}

export async function resolveVideoAverageColor(file: File) {
  if (typeof document === "undefined") return "#151515";
  return new Promise<string>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    const timeout = setTimeout(() => { cleanup(); resolve("#151515"); }, 5000);
    const cleanup = () => {
      clearTimeout(timeout);
      video.onloadeddata = null;
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    const sample = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
        if (!ctx || video.videoWidth <= 0 || video.videoHeight <= 0) {
          cleanup();
          resolve("#151515");
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let index = 0; index < data.length; index += 4) {
          r += data[index];
          g += data[index + 1];
          b += data[index + 2];
          count += 1;
        }
        const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value / Math.max(1, count)))).toString(16).padStart(2, "0");
        cleanup();
        resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
      } catch {
        cleanup();
        resolve("#151515");
      }
    };
    video.onloadeddata = sample;
    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.1, Math.max(0, (Number.isFinite(video.duration) ? video.duration : 1) / 20));
      } catch {
        sample();
      }
    };
    video.onerror = () => {
      cleanup();
      resolve("#151515");
    };
  });
}
