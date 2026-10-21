import { randomUUID } from "crypto";

export function extensionFromMime(mimeType: string) {
  const normalized = mimeType.toLowerCase().split(";", 1)[0]?.trim() || "";
  // Images
  if (normalized.includes("image/jpeg") || normalized.includes("image/jpg") || normalized.includes("image/pjpeg")) return "jpg";
  if (normalized.includes("image/png") || normalized.includes("image/x-png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/gif")) return "gif";
  if (normalized.includes("image/avif")) return "avif";
  if (normalized.includes("image/heic")) return "heic";
  if (normalized.includes("image/heif")) return "heif";
  if (normalized.includes("image/bmp")) return "bmp";
  if (normalized.includes("image/svg")) return "svg";

  // Videos
  if (normalized.includes("video/mp4") || normalized.includes("video/x-m4v")) return "mp4";
  if (normalized.includes("video/webm")) return "webm";
  if (normalized.includes("video/quicktime")) return "mov";
  if (normalized.includes("video/ogg")) return "ogv";
  if (normalized.includes("video/x-matroska")) return "mkv";
  if (normalized.includes("video/3gpp")) return "3gp";
  if (normalized.includes("video/x-msvideo")) return "avi";

  // Audio
  if (normalized.includes("audio/mpeg") || normalized.includes("audio/mp3") || normalized.includes("audio/x-mp3") || normalized.includes("audio/x-mpeg")) return "mp3";
  if (normalized.includes("audio/wav") || normalized.includes("audio/x-wav") || normalized.includes("audio/wave") || normalized.includes("audio/vnd.wave")) return "wav";
  if (normalized.includes("audio/mp4") || normalized.includes("audio/m4a") || normalized.includes("audio/x-m4a")) return "m4a";
  if (normalized.includes("audio/aac") || normalized.includes("audio/x-aac")) return "aac";
  if (normalized.includes("audio/flac") || normalized.includes("audio/x-flac")) return "flac";
  if (normalized.includes("audio/ogg") || normalized.includes("audio/vorbis")) return "ogg";
  if (normalized.includes("audio/opus")) return "opus";
  if (normalized.includes("audio/webm")) return "webm";
  if (normalized.includes("audio/3gpp")) return "3gp";
  if (normalized.includes("audio/mid") || normalized.includes("audio/midi")) return "mid";

  // Documents
  if (normalized.includes("application/pdf")) return "pdf";
  if (normalized.includes("application/zip")) return "zip";

  return "bin";
}

export function extensionFromFilename(filename: string | null | undefined) {
  const trimmed = filename?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\.([a-z0-9]{1,16})$/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

export function buildMediaObjectKey(input: {
  kind: string;
  ownerId: string;
  mimeType: string;
  filename?: string | null;
  extension?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const mimeExtension = extensionFromMime(input.mimeType);
  const ext = input.extension ?? (mimeExtension !== "bin" ? mimeExtension : extensionFromFilename(input.filename) ?? "bin");
  const id = randomUUID();
  return `media/${input.kind}/${yyyy}/${mm}/${input.ownerId}/${id}.${ext}`;
}
