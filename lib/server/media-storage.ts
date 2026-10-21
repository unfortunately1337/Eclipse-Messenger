import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import { Readable, Transform } from "stream";
import fs from "fs";
import path from "path";
import { buildMediaObjectKey } from "@/lib/server/media-keys";
import { buildS3Endpoint, getMediaStorageConfig, type MediaStorageConfig } from "@/lib/server/media-config";

const MEDIA_ENCRYPTION_SCHEME = "aes-256-gcm-v1";
const LEGACY_MEDIA_ENCRYPTION_SCHEME = "aes-256-ctr-v1";
const MEDIA_GCM_IV_BYTES = 12;
const MEDIA_CTR_IV_BYTES = 16;

const LOCAL_MEDIA_DIR = path.resolve(process.cwd(), ".data", "media");

function ensureLocalMediaDir() {
  try {
    fs.mkdirSync(LOCAL_MEDIA_DIR, { recursive: true });
  } catch {}
}

async function saveLocalMediaFile(objectKey: string, encryptedBuffer: Buffer, metadata: Record<string, string>, mimeType: string) {
  ensureLocalMediaDir();
  const safeFilename = objectKey.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(LOCAL_MEDIA_DIR, safeFilename);
  const metaPath = `${filePath}.json`;
  await fs.promises.writeFile(filePath, encryptedBuffer);
  await fs.promises.writeFile(metaPath, JSON.stringify({ metadata, mimeType }));
}

async function getLocalMediaFile(objectKey: string) {
  const candidateKeys = [
    objectKey,
    objectKey.startsWith("media/") ? objectKey.slice("media/".length) : `media/${objectKey}`,
    `media/${objectKey.replace(/^media\//, "")}`,
  ];
  for (const k of candidateKeys) {
    const safeFilename = k.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(LOCAL_MEDIA_DIR, safeFilename);
    const metaPath = `${filePath}.json`;
    if (fs.existsSync(filePath)) {
      try {
        const encryptedBuffer = await fs.promises.readFile(filePath);
        let metadata: Record<string, string> | undefined;
        let mimeType: string | undefined;
        if (fs.existsSync(metaPath)) {
          try {
            const parsed = JSON.parse(await fs.promises.readFile(metaPath, "utf-8"));
            metadata = parsed.metadata;
            mimeType = parsed.mimeType;
          } catch {}
        }
        return { encryptedBuffer, metadata, mimeType, resolvedKey: k };
      } catch {}
    }
  }
  return null;
}

export type MediaUploadResult = {
  bucket: string;
  objectKey: string;
  etag?: string;
  size: number;
  mimeType: string;
};

export class MediaRangeNotSatisfiableError extends Error {
  totalLength?: number;

  constructor(totalLength?: number) {
    super("Requested range is not satisfiable");
    this.name = "MediaRangeNotSatisfiableError";
    this.totalLength = totalLength;
  }
}

let cachedClient: S3Client | null = null;
let cachedMediaEncryptionKey: Buffer | null = null;

function getMediaEncryptionKey() {
  if (cachedMediaEncryptionKey) return cachedMediaEncryptionKey;
  const raw =
    process.env.MEDIA_ENCRYPTION_KEY?.trim() ||
    process.env.E2E_DB_ENCRYPTION_KEY?.trim() ||
    process.env.E2E_BACKUP_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (!raw && process.env.NODE_ENV === "production") throw new Error("A media encryption key must be configured in production");
  cachedMediaEncryptionKey = createHash("sha256").update(raw || "eclipse-fallback-media-encryption-key-2026").digest();
  return cachedMediaEncryptionKey;
}

function deriveObjectEncryptionKey(objectKey: string) {
  return createHmac("sha256", getMediaEncryptionKey()).update(objectKey).digest();
}

function buildEncryptionMetadata(iv: Buffer, tag: Buffer) {
  return {
    "eclipse-encryption": MEDIA_ENCRYPTION_SCHEME,
    "eclipse-iv": iv.toString("base64"),
    "eclipse-tag": tag.toString("base64"),
  };
}

type MediaEncryptionMetadata =
  | { scheme: typeof MEDIA_ENCRYPTION_SCHEME; iv: Buffer; tag: Buffer }
  | { scheme: typeof LEGACY_MEDIA_ENCRYPTION_SCHEME; iv: Buffer };

function readEncryptionMetadata(metadata?: Record<string, string>): MediaEncryptionMetadata | null {
  if (!metadata) return null;
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const lower = k.toLowerCase();
    normalized[lower] = v;
    if (lower.startsWith("x-amz-meta-")) {
      normalized[lower.slice("x-amz-meta-".length)] = v;
    }
  }
  const scheme = normalized["eclipse-encryption"];
  if (scheme !== MEDIA_ENCRYPTION_SCHEME && scheme !== LEGACY_MEDIA_ENCRYPTION_SCHEME) return null;
  const encoded = normalized["eclipse-iv"];
  if (!encoded) throw new Error("Encrypted media IV is missing");
  const iv = Buffer.from(encoded, "base64");
  if (scheme === MEDIA_ENCRYPTION_SCHEME) {
    if (iv.length !== MEDIA_GCM_IV_BYTES) {
      throw new Error("Encrypted media IV is invalid");
    }
    const encodedTag = normalized["eclipse-tag"];
    if (!encodedTag) throw new Error("Encrypted media tag is missing");
    const tag = Buffer.from(encodedTag, "base64");
    if (tag.length !== 16) {
      throw new Error("Encrypted media tag is invalid");
    }
    return { scheme, iv, tag };
  }
  if (iv.length !== MEDIA_CTR_IV_BYTES) {
    throw new Error("Encrypted media IV is invalid");
  }
  return { scheme, iv };
}

function addCounterBlocks(iv: Buffer, blocks: number) {
  if (blocks <= 0) return iv;
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
  const value = (BigInt(`0x${iv.toString("hex")}`) + BigInt(blocks)) & mask;
  return Buffer.from(value.toString(16).padStart(32, "0"), "hex");
}

function stripLeadingBytes(count: number) {
  let remaining = count;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (remaining >= chunk.length) {
        remaining -= chunk.length;
        callback();
        return;
      }
      const visible = remaining > 0 ? chunk.subarray(remaining) : chunk;
      remaining = 0;
      callback(null, visible);
    },
  });
}

const s3ClientCache = new Map<string, S3Client>();

function getClientForEndpoint(endpoint: string, config: MediaStorageConfig): S3Client {
  let client = s3ClientCache.get(endpoint);
  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
    s3ClientCache.set(endpoint, client);
  }
  return client;
}

function getCandidateEndpoints(config: MediaStorageConfig): string[] {
  const primary = buildS3Endpoint(config);
  if (primary) {
    return [primary];
  }
  return ["http://127.0.0.1:9000"];
}

async function executeS3Command<T>(fn: (client: S3Client) => Promise<T>): Promise<T> {
  const config = getMediaStorageConfig();
  const endpoints = getCandidateEndpoints(config);
  let lastError: unknown;
  for (const endpoint of endpoints) {
    const client = getClientForEndpoint(endpoint, config);
    try {
      const result = await Promise.race([
        fn(client),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("S3 request timeout")), 3500)),
      ]);
      return result;
    } catch (err: any) {
      lastError = err;
      if (
        err?.name === "NoSuchKey" ||
        err?.name === "NotFound" ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        throw err;
      }
      const isNetworkErr =
        err?.code === "ECONNREFUSED" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ENOTFOUND" ||
        err?.code === "EHOSTUNREACH" ||
        err?.name === "TimeoutError" ||
        /timeout|fetch failed|network error/i.test(err?.message || "");
      if (isNetworkErr) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function normalizeRangeHeader(rangeHeader: string, totalLength: number) {
  const trimmed = rangeHeader.trim();
  if (!trimmed.startsWith("bytes=")) return null;
  const raw = trimmed.slice("bytes=".length).trim();
  if (!raw || raw.includes(",")) return null;
  const [startRaw, endRaw] = raw.split("-", 2);
  const hasStart = Boolean(startRaw);
  const hasEnd = Boolean(endRaw);
  if (!hasStart && !hasEnd) return null;

  let start = 0;
  let end = Math.max(0, totalLength - 1);

  if (!hasStart && hasEnd) {
    const suffixLength = Number.parseInt(endRaw ?? "", 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(totalLength - suffixLength, 0);
  } else {
    start = Number.parseInt(startRaw ?? "", 10);
    if (!Number.isFinite(start) || start < 0 || start >= totalLength) {
      throw new MediaRangeNotSatisfiableError(totalLength);
    }
    if (hasEnd) {
      end = Number.parseInt(endRaw ?? "", 10);
      if (!Number.isFinite(end) || end < start) {
        throw new MediaRangeNotSatisfiableError(totalLength);
      }
      end = Math.min(end, totalLength - 1);
    }
  }

  if (start > end || start >= totalLength) {
    throw new MediaRangeNotSatisfiableError(totalLength);
  }

  return { header: `bytes=${start}-${end}`, start, end };
}

const ensuredBuckets = new Set<string>();
export async function ensureBucketExists(bucket: string) {
  if (ensuredBuckets.has(bucket)) return;
  try {
    await executeS3Command((client) => client.send(new HeadBucketCommand({ Bucket: bucket })));
    ensuredBuckets.add(bucket);
  } catch {
    try {
      await executeS3Command((client) => client.send(new CreateBucketCommand({ Bucket: bucket })));
      ensuredBuckets.add(bucket);
    } catch (createErr) {
      console.warn(`Could not auto-create bucket ${bucket}:`, createErr);
    }
  }
}

export async function uploadMediaBuffer(input: {
  buffer: Buffer;
  size: number;
  mimeType: string;
  kind: string;
  ownerId: string;
  objectKey?: string;
})
: Promise<MediaUploadResult> {
  const config = getMediaStorageConfig();
  const objectKey = input.objectKey ?? buildMediaObjectKey({
    kind: input.kind,
    ownerId: input.ownerId,
    mimeType: input.mimeType,
  });
  const iv = randomBytes(MEDIA_GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveObjectEncryptionKey(objectKey), iv);
  const encryptedBuffer = Buffer.concat([cipher.update(input.buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const metadata = buildEncryptionMetadata(iv, tag);

  // Always save locally as immediate and reliable storage
  let locallyStored = false;
  try {
    await saveLocalMediaFile(objectKey, encryptedBuffer, metadata, input.mimeType);
    locallyStored = true;
  } catch (err) {
    console.warn("Could not save to local media storage:", err);
  }

  // Finish all writes before publishing metadata; cleanup must not race a late PUT.
  await (async () => {
    try {
      await ensureBucketExists(config.bucket);
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: encryptedBuffer,
        ContentType: input.mimeType,
        ContentLength: encryptedBuffer.length,
        Metadata: metadata,
      });
      await executeS3Command((client) => client.send(command));
    } catch (s3Err) {
      if (!locallyStored) throw s3Err;
      console.warn("S3 upload failed (local copy preserved)");
    }
  })();

  return {
    bucket: config.bucket,
    objectKey,
    etag: "local",
    size: input.size,
    mimeType: input.mimeType,
  };
}

export async function uploadMediaStream(input: {
  body: Readable;
  size: number;
  mimeType: string;
  kind: string;
  ownerId: string;
  objectKey?: string;
})
: Promise<MediaUploadResult> {
  const buffer = await readableToBuffer(input.body);
  return uploadMediaBuffer({
    buffer,
    size: input.size,
    mimeType: input.mimeType,
    kind: input.kind,
    ownerId: input.ownerId,
    objectKey: input.objectKey,
  });
}

export async function deleteMediaObject(bucket: string, objectKey: string, options: { strict?: boolean } = {}) {
  const unlink = async (file: string) => {
    try { await fs.promises.unlink(file); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && options.strict) throw error;
    }
  };
  try {
    const candidateKeys = [
      objectKey,
      objectKey.startsWith("media/") ? objectKey.slice("media/".length) : `media/${objectKey}`,
      `media/${objectKey.replace(/^media\//, "")}`,
    ];
    for (const k of candidateKeys) {
      const safeFilename = k.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = path.join(LOCAL_MEDIA_DIR, safeFilename);
      const metaPath = `${filePath}.json`;
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
      if (fs.existsSync(metaPath)) {
        await unlink(metaPath);
      }
    }
  } catch (error) { if (options.strict) throw error; }
  try {
    await executeS3Command((client) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })));
  } catch (error) { if (options.strict) throw error; }
}

export async function mediaObjectExists(bucket: string, objectKey: string) {
  const local = await getLocalMediaFile(objectKey);
  if (local) return true;
  try {
    await executeS3Command((client) => client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey })));
    return true;
  } catch {
    return false;
  }
}

export function inferContentType(key: string, fallback: string = "application/octet-stream", hintKind?: string) {
  const ext = key.split(".").pop()?.toLowerCase().split("?")[0] || "";
  // Images
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "svg") return "image/svg+xml";

  // Audio / Voice
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  if (ext === "ogg" || ext === "oga") {
    if (hintKind === "video") return "video/ogg";
    return "audio/ogg";
  }
  if (ext === "opus") return "audio/opus";
  if (ext === "webm") {
    if (hintKind === "video" || hintKind === "video_note") return "video/webm";
    return "audio/webm";
  }
  if (ext === "flac") return "audio/flac";
  if (ext === "mid" || ext === "midi") return "audio/midi";

  // Video
  if (ext === "mp4" || ext === "m4v") {
    if (hintKind === "voice" || hintKind === "audio") return "audio/mp4";
    return "video/mp4";
  }
  if (ext === "mov") return "video/quicktime";
  if (ext === "ogv") return "video/ogg";
  if (ext === "mkv") return "video/x-matroska";
  if (ext === "3gp") return "video/3gpp";
  if (ext === "avi") return "video/x-msvideo";

  // Documents
  if (ext === "pdf") return "application/pdf";
  if (ext === "zip") return "application/zip";

  return fallback;
}

export function sniffMediaBuffer(
  buffer: Buffer,
  hintKind?: string,
): { mimeType: string; kind: "image" | "video" | "audio" } | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mimeType: "image/jpeg", kind: "image" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { mimeType: "image/png", kind: "image" };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { mimeType: "image/gif", kind: "image" };
  }

  // RIFF container (WAV or WebP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  ) {
    const format = buffer.toString("ascii", 8, 12);
    if (format === "WEBP") {
      return { mimeType: "image/webp", kind: "image" };
    }
    if (format === "WAVE") {
      return { mimeType: "audio/wav", kind: "audio" };
    }
  }

  // MP3 with ID3v2 header: "ID3"
  if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { mimeType: "audio/mpeg", kind: "audio" };
  }

  // MP3 without ID3: frame sync 0xFF followed by 111b (0xE0)
  if (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    return { mimeType: "audio/mpeg", kind: "audio" };
  }

  // FLAC: "fLaC"
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x66 &&
    buffer[1] === 0x4C &&
    buffer[2] === 0x61 &&
    buffer[3] === 0x43
  ) {
    return { mimeType: "audio/flac", kind: "audio" };
  }

  // Ogg container: "OggS"
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x4F &&
    buffer[1] === 0x47 &&
    buffer[2] === 0x47 &&
    buffer[3] === 0x53
  ) {
    if (hintKind === "video") {
      return { mimeType: "video/ogg", kind: "video" };
    }
    return { mimeType: "audio/ogg", kind: "audio" };
  }

  // MP4 / M4A / MOV / QuickTime container: "ftyp" at offset 4
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    if (brand.startsWith("m4a") || brand.startsWith("m4b") || brand.startsWith("m4p")) {
      return { mimeType: "audio/mp4", kind: "audio" };
    }
    if (hintKind === "voice" || hintKind === "audio") {
      return { mimeType: "audio/mp4", kind: "audio" };
    }
    if (brand.startsWith("qt")) {
      return { mimeType: "video/quicktime", kind: "video" };
    }
    return { mimeType: "video/mp4", kind: "video" };
  }

  // Matroska / WebM EBML: 1A 45 DF A3
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1A &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xDF &&
    buffer[3] === 0xA3
  ) {
    if (hintKind === "voice" || hintKind === "audio") {
      return { mimeType: "audio/webm", kind: "audio" };
    }
    if (hintKind === "video_note") {
      return { mimeType: "video/webm", kind: "video" };
    }
    const slice = buffer.subarray(0, Math.min(buffer.length, 128)).toString("latin1");
    if (slice.includes("webm")) {
      return { mimeType: "video/webm", kind: "video" };
    }
    return { mimeType: "video/x-matroska", kind: "video" };
  }

  // BMP: "BM"
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return { mimeType: "image/bmp", kind: "image" };
  }

  return null;
}

export async function getMediaObjectStream(bucket: string, objectKey: string, rangeHeader?: string | null) {
  // Check local disk cache / storage first
  const local = await getLocalMediaFile(objectKey);
  if (local) {
    const finalContentType =
      local.mimeType && local.mimeType !== "application/octet-stream"
        ? local.mimeType
        : inferContentType(local.resolvedKey, "application/octet-stream");
    const encryptionMetadata = readEncryptionMetadata(local.metadata);
    let decrypted = local.encryptedBuffer;
    if (encryptionMetadata?.scheme === MEDIA_ENCRYPTION_SCHEME) {
      const decipher = createDecipheriv("aes-256-gcm", deriveObjectEncryptionKey(local.resolvedKey), encryptionMetadata.iv);
      decipher.setAuthTag(encryptionMetadata.tag);
      decrypted = Buffer.concat([decipher.update(local.encryptedBuffer), decipher.final()]);
    }

    if (rangeHeader && decrypted.length > 0) {
      const requestedRange = normalizeRangeHeader(rangeHeader, decrypted.length);
      if (requestedRange) {
        const slice = decrypted.subarray(requestedRange.start, requestedRange.end + 1);
        return {
          body: Readable.toWeb(Readable.from(slice)),
          contentType: finalContentType,
          contentLength: slice.length,
          etag: "local",
          cacheControl: "public, max-age=31536000, immutable",
          contentRange: `bytes ${requestedRange.start}-${requestedRange.end}/${decrypted.length}`,
          acceptRanges: "bytes",
          statusCode: 206,
          totalLength: decrypted.length,
        };
      }
    }

    return {
      body: Readable.toWeb(Readable.from(decrypted)),
      contentType: finalContentType,
      contentLength: decrypted.length,
      etag: "local",
      cacheControl: "public, max-age=31536000, immutable",
      contentRange: undefined,
      acceptRanges: "bytes",
      statusCode: 200,
      totalLength: decrypted.length,
    };
  }
  const candidateKeys = Array.from(
    new Set([
      objectKey,
      objectKey.startsWith("media/") ? objectKey.slice("media/".length) : `media/${objectKey}`,
      `media/${objectKey.replace(/^media\//, "")}`,
    ]),
  );

  let targetKey = objectKey;
  let requestRange: string | undefined;
  let totalLength: number | undefined;
  let requestedRange: { header: string; start: number; end: number } | null = null;
  let encryptionMetadata: MediaEncryptionMetadata | null = null;

  if (rangeHeader) {
    let head = null;
    for (const key of candidateKeys) {
      try {
        head = await executeS3Command((client) => client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })));
        targetKey = key;
        break;
      } catch (err: any) {
        if (err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
          continue;
        }
        throw err;
      }
    }
    if (head) {
      totalLength = typeof head.ContentLength === "number" ? head.ContentLength : undefined;
      if (typeof totalLength === "number" && totalLength > 0) {
        requestedRange = normalizeRangeHeader(rangeHeader, totalLength);
        encryptionMetadata = readEncryptionMetadata(head.Metadata);
        if (requestedRange) {
          // If file is larger than 50MB, use remote range request to avoid buffering large files in memory
          if (totalLength > 50 * 1024 * 1024) {
            if (encryptionMetadata?.scheme === LEGACY_MEDIA_ENCRYPTION_SCHEME) {
              const alignedStart = Math.floor(requestedRange.start / MEDIA_CTR_IV_BYTES) * MEDIA_CTR_IV_BYTES;
              requestRange = `bytes=${alignedStart}-${requestedRange.end}`;
            } else if (encryptionMetadata?.scheme === MEDIA_ENCRYPTION_SCHEME) {
              requestedRange = null;
              requestRange = undefined;
            } else {
              requestRange = requestedRange.header;
            }
          } else {
            // For files <= 50MB (stories, avatars, videos, photos), download full file to local disk cache
            requestRange = undefined;
          }
        }
      } else if (typeof totalLength === "number" && totalLength <= 0) {
        throw new MediaRangeNotSatisfiableError(totalLength);
      }
    }
  }

  let result = null;
  let resolvedKey = targetKey;
  for (const key of candidateKeys) {
    try {
      result = await executeS3Command((client) =>
        client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: requestRange,
          }),
        ),
      );
      resolvedKey = key;
      break;
    } catch (err: any) {
      if (err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
        continue;
      }
      throw err;
    }
  }

  if (!result || !result.Body) {
    throw new Error("Media body is not readable");
  }

  encryptionMetadata ??= readEncryptionMetadata(result.Metadata);
  const nodeBody =
    result.Body instanceof Readable
      ? result.Body
      : Readable.fromWeb(result.Body as unknown as Parameters<typeof Readable.fromWeb>[0]);

  const rawContentType = result.ContentType || "";
  const finalContentType =
    rawContentType && rawContentType !== "application/octet-stream" && rawContentType !== "binary/octet-stream"
      ? rawContentType
      : inferContentType(resolvedKey, "application/octet-stream");

  const actualTotalLength = totalLength ?? (typeof result.ContentLength === "number" ? result.ContentLength : undefined);

  // If this is a full object fetch (or <= 50MB), buffer and cache on local disk
  if (!requestRange && (!actualTotalLength || actualTotalLength <= 50 * 1024 * 1024)) {
    const rawBuffer = await readableToBuffer(nodeBody);

    // Save to local disk cache so all future reads & range requests hit local disk in 0ms
    try {
      await saveLocalMediaFile(resolvedKey, rawBuffer, result.Metadata || {}, finalContentType);
    } catch (err) {
      console.warn("Failed to save media to local disk cache:", err);
    }

    let decrypted = rawBuffer;
    if (encryptionMetadata?.scheme === MEDIA_ENCRYPTION_SCHEME) {
      const decipher = createDecipheriv("aes-256-gcm", deriveObjectEncryptionKey(resolvedKey), encryptionMetadata.iv);
      decipher.setAuthTag(encryptionMetadata.tag);
      decrypted = Buffer.concat([decipher.update(rawBuffer), decipher.final()]);
    }

    if (rangeHeader && decrypted.length > 0) {
      const parsedRange = normalizeRangeHeader(rangeHeader, decrypted.length);
      if (parsedRange) {
        const slice = decrypted.subarray(parsedRange.start, parsedRange.end + 1);
        return {
          body: Readable.toWeb(Readable.from(slice)),
          contentType: finalContentType,
          contentLength: slice.length,
          etag: result.ETag ?? "local",
          cacheControl: "public, max-age=31536000, immutable",
          contentRange: `bytes ${parsedRange.start}-${parsedRange.end}/${decrypted.length}`,
          acceptRanges: "bytes",
          statusCode: 206,
          totalLength: decrypted.length,
        };
      }
    }

    return {
      body: Readable.toWeb(Readable.from(decrypted)),
      contentType: finalContentType,
      contentLength: decrypted.length,
      etag: result.ETag ?? "local",
      cacheControl: result.CacheControl ?? "public, max-age=31536000, immutable",
      contentRange: undefined,
      acceptRanges: "bytes",
      statusCode: 200,
      totalLength: decrypted.length,
    };
  }

  // Fallback for large files (> 50MB) with remote range streaming
  if (encryptionMetadata?.scheme === MEDIA_ENCRYPTION_SCHEME) {
    const encrypted = await readableToBuffer(nodeBody);
    const decipher = createDecipheriv("aes-256-gcm", deriveObjectEncryptionKey(resolvedKey), encryptionMetadata.iv);
    decipher.setAuthTag(encryptionMetadata.tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    try {
      await saveLocalMediaFile(resolvedKey, encrypted, result.Metadata || {}, finalContentType);
    } catch {}

    if (rangeHeader && decrypted.length > 0) {
      const parsedRange = normalizeRangeHeader(rangeHeader, decrypted.length);
      if (parsedRange) {
        const slice = decrypted.subarray(parsedRange.start, parsedRange.end + 1);
        return {
          body: Readable.toWeb(Readable.from(slice)),
          contentType: finalContentType,
          contentLength: slice.length,
          etag: result.ETag ?? undefined,
          cacheControl: "public, max-age=31536000, immutable",
          contentRange: `bytes ${parsedRange.start}-${parsedRange.end}/${decrypted.length}`,
          acceptRanges: "bytes",
          statusCode: 206,
          totalLength: decrypted.length,
        };
      }
    }

    return {
      body: Readable.toWeb(Readable.from(decrypted)),
      contentType: finalContentType,
      contentLength: decrypted.length,
      etag: result.ETag ?? undefined,
      cacheControl: result.CacheControl ?? "public, max-age=31536000, immutable",
      contentRange: undefined,
      acceptRanges: "bytes",
      statusCode: 200,
      totalLength: decrypted.length,
    };
  }

  let output = nodeBody;
  let contentLength = result.ContentLength ?? undefined;
  let contentRange = result.ContentRange ?? undefined;
  if (encryptionMetadata?.scheme === LEGACY_MEDIA_ENCRYPTION_SCHEME) {
    const requestedStart = requestedRange?.start ?? 0;
    const requestedEnd = requestedRange?.end;
    const alignedStart = Math.floor(requestedStart / MEDIA_CTR_IV_BYTES) * MEDIA_CTR_IV_BYTES;
    const decipherIv = addCounterBlocks(encryptionMetadata.iv, alignedStart / MEDIA_CTR_IV_BYTES);
    output = output.pipe(createDecipheriv("aes-256-ctr", deriveObjectEncryptionKey(resolvedKey), decipherIv));
    const leadingBytes = requestedStart - alignedStart;
    if (leadingBytes > 0) {
      output = output.pipe(stripLeadingBytes(leadingBytes));
    }
    if (typeof requestedEnd === "number") {
      contentLength = requestedEnd - requestedStart + 1;
      if (typeof actualTotalLength === "number") {
        contentRange = `bytes ${requestedStart}-${requestedEnd}/${actualTotalLength}`;
      }
    }
  }
  const body = Readable.toWeb(output);
  return {
    body,
    contentType: finalContentType,
    contentLength,
    etag: result.ETag ?? undefined,
    cacheControl: result.CacheControl ?? undefined,
    contentRange,
    acceptRanges: result.AcceptRanges ?? "bytes",
    statusCode: result.ContentRange ? 206 : 200,
    totalLength: actualTotalLength,
  };
}

export function buildPublicMediaPath(objectKey: string) {
  return `/media/${objectKey}`;
}

async function readableToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
