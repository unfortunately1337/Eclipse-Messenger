import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { resolveUploadScope } from "@/lib/server/media-scope";
import { readRequestBody } from "@/lib/server/request-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { buildMediaObjectKey } from "@/lib/server/media-keys";
import { buildPublicMediaPath, deleteMediaObject, inferContentType, sniffMediaBuffer, uploadMediaBuffer } from "@/lib/server/media-storage";

const IMAGE_MAX_BYTES = 100 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const VOICE_MAX_BYTES = 30_000_000;
const VIDEO_NOTE_MAX_BYTES = 30_000_000;
const AUDIO_MAX_BYTES = 100 * 1024 * 1024;
const FILE_MAX_BYTES = 100 * 1024 * 1024;

const allowedKinds = new Set(["image", "video", "voice", "video_note", "audio", "file"] as const);
const blockedInlineMimeTypes = new Set([
  "application/javascript",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/html",
  "text/javascript",
  "application/x-msdownload",
  "application/x-sh",
  "application/x-csh",
  "text/x-php",
  "application/x-httpd-php",
]);

const dangerousExtensions = new Set([
  "exe", "bat", "cmd", "sh", "php", "phtml", "php3", "php4", "php5", "phps",
  "js", "mjs", "cjs", "vbs", "ps1", "html", "htm", "xhtml", "jar", "com", "scr", "msi"
]);

function getSizeLimit(kind: string) {
  if (kind === "image") return IMAGE_MAX_BYTES;
  if (kind === "video") return VIDEO_MAX_BYTES;
  if (kind === "voice") return VOICE_MAX_BYTES;
  if (kind === "video_note") return VIDEO_NOTE_MAX_BYTES;
  if (kind === "audio") return AUDIO_MAX_BYTES;
  if (kind === "file") return FILE_MAX_BYTES;
  return IMAGE_MAX_BYTES;
}

function normalizeMimeType(mime: string): string {
  const lower = mime.toLowerCase().split(";", 1)[0]?.trim() || "application/octet-stream";
  if (lower === "audio/mp3" || lower === "audio/x-mp3" || lower === "audio/x-mpeg") return "audio/mpeg";
  if (lower === "audio/x-wav" || lower === "audio/wave" || lower === "audio/vnd.wave") return "audio/wav";
  if (lower === "audio/x-m4a" || lower === "audio/m4a") return "audio/mp4";
  if (lower === "audio/x-aac") return "audio/aac";
  if (lower === "audio/x-flac") return "audio/flac";
  if (lower === "image/pjpeg" || lower === "image/jpg") return "image/jpeg";
  if (lower === "image/x-png") return "image/png";
  if (lower === "video/x-m4v") return "video/mp4";
  return lower;
}

function resolveMediaMime(file: File, buffer: Buffer, kind: string): string {
  // 1. Sniff magic bytes from the buffer (highest trust) with contextual kind hint
  const sniffed = sniffMediaBuffer(buffer, kind);
  if (sniffed) {
    if (kind === "voice" || kind === "audio") {
      if (sniffed.mimeType === "video/webm" || sniffed.mimeType === "video/x-matroska") {
        return "audio/webm";
      }
      if (sniffed.mimeType === "video/mp4" || sniffed.mimeType === "video/quicktime") {
        return "audio/mp4";
      }
      if (sniffed.mimeType === "video/ogg") {
        return "audio/ogg";
      }
    }
    if (kind === "video_note") {
      if (sniffed.mimeType === "video/x-matroska") {
        return "video/webm";
      }
    }
    return normalizeMimeType(sniffed.mimeType);
  }

  // 2. Check client-reported MIME if not generic
  const rawMime = file.type ? normalizeMimeType(file.type) : "";
  if (rawMime && rawMime !== "application/octet-stream" && rawMime !== "binary/octet-stream") {
    if (kind === "voice" || kind === "audio") {
      if (rawMime === "video/webm" || rawMime === "video/x-matroska") {
        return "audio/webm";
      }
      if (rawMime === "video/mp4") {
        return "audio/mp4";
      }
    }
    if (kind === "video_note") {
      if (rawMime === "video/x-matroska") {
        return "video/webm";
      }
    }
    return rawMime;
  }

  // 3. Fallback to extension inference from filename
  if (file.name) {
    const inferred = inferContentType(file.name, undefined, kind);
    if (inferred && inferred !== "application/octet-stream") {
      const norm = normalizeMimeType(inferred);
      if (kind === "voice" || kind === "audio") {
        if (norm === "video/webm" || norm === "video/x-matroska") return "audio/webm";
        if (norm === "video/mp4") return "audio/mp4";
      }
      if (kind === "video_note") {
        if (norm === "video/x-matroska") return "video/webm";
      }
      return norm;
    }
  }

  // 4. Default kind-based fallback for media
  if (kind === "audio") return "audio/mpeg";
  if (kind === "voice") return "audio/webm";
  if (kind === "video_note") return "video/webm";
  if (kind === "video") return "video/mp4";
  if (kind === "image") return "image/jpeg";

  return "application/octet-stream";
}

function assertSafeMediaMime(kind: string, mimeType: string, filename?: string) {
  let normalized = normalizeMimeType(mimeType);

  if (kind === "voice" || kind === "audio") {
    if (normalized === "video/webm" || normalized === "video/x-matroska") {
      normalized = "audio/webm";
    } else if (normalized === "video/mp4" || normalized === "video/quicktime") {
      normalized = "audio/mp4";
    } else if (normalized === "video/ogg") {
      normalized = "audio/ogg";
    }
  }

  if (kind === "video_note") {
    if (normalized === "video/x-matroska") {
      normalized = "video/webm";
    }
  }

  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (dangerousExtensions.has(ext)) {
      throw new Error("Файлы с таким расширением заблокированы из соображений безопасности");
    }
  }

  if (blockedInlineMimeTypes.has(normalized)) {
    throw new Error("Этот тип файла нельзя загрузить из соображений безопасности");
  }

  if (kind === "image" && !/^image\/(jpeg|jpg|pjpeg|png|x-png|webp|gif|bmp|avif|heic|heif)$/.test(normalized)) {
    throw new Error("Некорректный тип изображения");
  }
  if (kind === "video" && !/^video\/(mp4|webm|quicktime|ogg|x-matroska|3gpp|x-msvideo|x-m4v)$/.test(normalized)) {
    throw new Error("Некорректный тип видео");
  }
  if (kind === "video_note" && !/^video\/(mp4|webm|quicktime|x-matroska)$/.test(normalized)) {
    throw new Error("Некорректный тип видеокружка");
  }
  if ((kind === "voice" || kind === "audio") && !/^audio\/(webm|ogg|mpeg|mp3|mp4|wav|x-wav|wave|vnd\.wave|aac|x-aac|m4a|x-m4a|flac|x-flac|opus|3gpp|x-mpeg|x-mp3|mid|midi)$/.test(normalized)) {
    throw new Error("Некорректный тип аудио");
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `media:upload:${user.id}`, limit: 30, windowSeconds: 60 });
    // Bound the stream before multipart parsing allocates all files/fields in memory.
    const bytes = await readRequestBody(req, FILE_MAX_BYTES + 1024 * 1024);
    let form: FormData;
    try {
      form = await new Request("http://internal.invalid", { method: "POST", headers: { "Content-Type": req.headers.get("content-type") ?? "" }, body: bytes as BodyInit }).formData();
    } catch { throw new HttpError(400, "Некорректный запрос загрузки"); }
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "").trim();
    const durationRaw = form.get("durationMs");
    const durationMs = durationRaw ? Number.parseInt(String(durationRaw), 10) : null;
    const scopeType = String(form.get("scopeType") ?? "public");
    const scopeId = String(form.get("scopeId") ?? "");
    const clientEncrypted = form.get("clientEncrypted") === "1";
    if (clientEncrypted && scopeType === "public") throw new HttpError(400, "Зашифрованному вложению необходим чат");
    const scope = scopeType === "public"
      ? { scopeType, scopeId: null, expiresAt: null }
      : await resolveUploadScope(scopeType, scopeId, user.id, sessionId);

    if (!allowedKinds.has(kind as "image" | "video" | "voice" | "video_note" | "audio" | "file")) {
      throw new Error("Некорректный тип медиа");
    }
    if (!file || !(file instanceof File)) {
      throw new Error("Файл не найден");
    }

    const maxBytes = getSizeLimit(kind);
    if (file.size > maxBytes) {
      throw new Error("Файл слишком большой");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let mimeType = clientEncrypted ? "application/octet-stream" : resolveMediaMime(file, buffer, kind);
    if (kind === "voice" || kind === "audio") {
      if (mimeType === "video/webm" || mimeType === "video/x-matroska") {
        mimeType = "audio/webm";
      } else if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
        mimeType = "audio/mp4";
      }
    }
    if (clientEncrypted) {
      if (buffer.length < 17 || file.type !== "application/octet-stream") throw new HttpError(400, "Некорректное зашифрованное вложение");
    } else {
      assertSafeMediaMime(kind, mimeType, file.name);
    }

    const objectKey = buildMediaObjectKey({
      kind,
      ownerId: user.id,
      mimeType,
      filename: file.name,
    });

    const uploadResult = await uploadMediaBuffer({
      buffer,
      size: buffer.length,
      mimeType,
      kind,
      ownerId: user.id,
      objectKey,
    });

    const url = buildPublicMediaPath(uploadResult.objectKey);
    let media: { id: string };
    try {
      media = await prisma.mediaAsset.create({
        data: {
          ownerId: user.id,
          kind,
          mimeType,
          size: buffer.length,
          durationMs: Number.isFinite(durationMs) ? durationMs : null,
          objectKey: uploadResult.objectKey,
          bucket: uploadResult.bucket,
          etag: uploadResult.etag ?? null,
          status: "ready",
          ...scope,
          clientEncrypted,
        },
        select: { id: true },
      });
    } catch (error) {
      await deleteMediaObject(uploadResult.bucket, uploadResult.objectKey).catch(() => {});
      throw error;
    }

    const res = jsonOk({ id: media.id, url, expiresAt: scope.expiresAt?.toISOString() ?? null });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
