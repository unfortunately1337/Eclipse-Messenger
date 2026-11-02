import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import sharp from "sharp";
import { z } from "zod";
import { HttpError } from "./http";
import { prisma } from "./prisma";
import { uploadMediaBuffer } from "./media-storage";
import { parseTelegramPackLink, type PackKind } from "@/lib/imported-packs";

const photo = z.object({ file_id: z.string(), file_size: z.number().optional() });
export const telegramStickerSchema = z.object({
  file_id: z.string(), file_unique_id: z.string(), emoji: z.string().optional(),
  is_animated: z.boolean(), is_video: z.boolean(), file_size: z.number().optional(),
  thumbnail: photo.optional(), needs_repainting: z.boolean().optional(),
});
export const telegramSetSchema = z.object({
  name: z.string().min(1).max(64), title: z.string().min(1).max(128),
  sticker_type: z.enum(["regular", "mask", "custom_emoji"]),
  stickers: z.array(telegramStickerSchema).min(1).max(512),
});
export type TelegramSet = z.infer<typeof telegramSetSchema>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 24);
export const packIdForName = (name: string) => `pack-${hash(name.toLowerCase())}`;
export const packItemId = (packId: string, uniqueId: string) => `tg-${hash(`${packId}:${uniqueId}`)}`;

function telegramToken() {
  const token = process.env.TELEGRAM_IMPORT_BOT_TOKEN?.trim();
  if (!token) throw new HttpError(503, "Импорт временно недоступен. Попробуйте позже.");
  return token;
}
async function telegramFetch(url: string, init: RequestInit, timeout: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeout) });
      if (response.status < 500 || attempt === 1) return response;
      await response.body?.cancel();
    } catch {
      if (attempt === 1) throw new HttpError(502, "Не удалось связаться с Telegram. Попробуйте ещё раз.");
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new HttpError(502, "Telegram временно недоступен. Попробуйте ещё раз.");
}
async function boundedResponse(response: Response, maximum: number): Promise<Buffer> {
  if (!response.ok || !response.body) throw new HttpError(502, "Telegram временно недоступен. Попробуйте ещё раз.");
  if (Number(response.headers.get("content-length")) > maximum) throw new HttpError(413, "Файл набора слишком большой.");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > maximum) throw new HttpError(413, "Файл набора слишком большой.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function telegramRequest(method: "getStickerSet" | "getFile" | "getMe" | "getCustomEmojiStickers" | "sendMessage" | "getWebhookInfo" | "getUpdates", data: Record<string, string>): Promise<unknown> {
  const response = await telegramFetch(`https://api.telegram.org/bot${telegramToken()}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }, 20_000);
  // Never expose upstream errors or request URLs: they may include the bot credential.
  if (response.status === 429) throw new HttpError(429, "Telegram просит немного подождать. Повторите импорт позже.");
  if (response.status === 400 || response.status === 404) throw new HttpError(404, "Набор не найден. Проверьте ссылку.");
  const result = JSON.parse((await boundedResponse(response, 2 * 1024 * 1024)).toString()) as { ok?: boolean; result?: unknown };
  if (!result.ok || !result.result) throw new HttpError(502, "Не удалось получить набор из Telegram.");
  return result.result;
}
export async function inspectTelegramPack(text: string, selectedKind?: PackKind | null) {
  const link = parseTelegramPackLink(text);
  if (!link) throw new HttpError(400, "Пришлите ссылку t.me/addemoji/… или t.me/addstickers/…");
  if (selectedKind && selectedKind !== link.kind) throw new HttpError(400, selectedKind === "emoji" ? "Вы выбрали эмодзи. Пришлите ссылку t.me/addemoji/…" : "Вы выбрали стикеры. Пришлите ссылку t.me/addstickers/…");
  const source = telegramSetSchema.parse(await telegramRequest("getStickerSet", { name: link.name }));
  const kind: PackKind = source.sticker_type === "custom_emoji" ? "emoji" : "sticker";
  if (source.name.toLowerCase() !== link.name.toLowerCase() || source.sticker_type === "mask" || kind !== link.kind) throw new HttpError(400, "Тип набора не соответствует ссылке.");
  const unique = [...new Map(source.stickers.map(sticker => [sticker.file_unique_id, sticker])).values()];
  source.stickers = unique;
  if (unique.reduce((bytes, item) => bytes + (item.file_size ?? 0), 0) > 64 * 1024 * 1024) throw new HttpError(413, "Этот набор слишком большой для импорта.");
  const existing = await prisma.importedPack.findUnique({ where: { sourceName: source.name.toLowerCase() } });
  if (existing && existing.kind !== kind) throw new HttpError(400, "Тип набора не соответствует ссылке.");
  return prisma.importedPack.upsert({
    where: { sourceName: source.name.toLowerCase() },
    create: { id: packIdForName(source.name), sourceName: source.name.toLowerCase(), title: source.title, kind, count: unique.length, sourceSnapshot: source },
    // Only refresh the source here. Published files/title/count stay usable
    // until the user confirms and the worker commits the update atomically.
    update: { sourceSnapshot: source },
  });
}

export const packImportSnapshotSchema = z.object({ source: telegramSetSchema, baseItemIds: z.array(z.string()).max(4096), update: z.boolean() });
export type PackImportSnapshot = z.infer<typeof packImportSnapshotSchema>;
export async function preparePackImport(packId: string, userId: string, db: Pick<typeof prisma, "importedPack" | "importedPackItem" | "userImportedPack"> = prisma) {
  const pack = await db.importedPack.findUnique({ where: { id: packId } });
  if (!pack) throw new HttpError(404, "Набор не найден.");
  const source = telegramSetSchema.parse(pack.sourceSnapshot);
  const [published, member] = await Promise.all([
    db.importedPackItem.findMany({ where: { packId, published: true }, select: { id: true, sourceUniqueId: true } }),
    db.userImportedPack.findUnique({ where: { userId_packId: { userId, packId } } }),
  ]);
  const known = new Set(published.map(item => item.sourceUniqueId));
  const added = source.stickers.filter(item => !known.has(item.file_unique_id)).length;
  const update = Boolean(member), baseItemIds = published.map(item => item.id);
  if (published.length + added > 4096) throw new HttpError(413, "Набор достиг максимального размера.");
  return { pack, source, added, installed: update, snapshot: { source, baseItemIds, update } satisfies PackImportSnapshot,
    card: { packId, title: source.title, kind: pack.kind as PackKind, count: update ? added : published.length + added, packCount: published.length + added, update, status: "confirm" as const, completed: 0 } };
}
async function downloadTelegramFile(fileId: string, maximum: number) {
  const file = z.object({ file_path: z.string().regex(/^[A-Za-z0-9_./-]+$/), file_size: z.number().optional() }).parse(await telegramRequest("getFile", { file_id: fileId }));
  if (file.file_path.includes("..") || (file.file_size ?? 0) > maximum) throw new HttpError(413, "Файл набора слишком большой.");
  try {
    const response = await telegramFetch(`https://api.telegram.org/file/bot${telegramToken()}/${file.file_path}`, {}, 25_000);
    return await boundedResponse(response, maximum);
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(502, "Не удалось скачать файл из Telegram."); }
}
export function validateTgs(buffer: Buffer) {
  let data: { assets?: Array<{ p?: unknown; u?: unknown }>; layers?: unknown[]; ip?: number; op?: number; fr?: number; w?: number; h?: number };
  try { data = JSON.parse(gunzipSync(buffer, { maxOutputLength: 2 * 1024 * 1024 }).toString()); }
  catch { throw new HttpError(400, "Неподдерживаемая анимация в наборе."); }
  if (!data.fr || !data.op || data.ip === undefined || data.op <= data.ip || (data.op - data.ip) / data.fr > 20 ||
    !data.w || !data.h || data.w > 1024 || data.h > 1024 || (data.layers?.length ?? 0) > 1500 ||
    data.assets?.some(asset => asset.p || asset.u)) throw new HttpError(400, "Неподдерживаемая анимация в наборе.");
  // Telegram artwork may contain exporter-generated expression strings. Preserve
  // its baked keyframes but never execute supplied JavaScript in the client.
  return gzipSync(JSON.stringify(data, (key, value) => key === "x" && typeof value === "string" ? undefined : value));
}
export async function refreshTelegramFiles(snapshot: unknown): Promise<TelegramSet> {
  const original = telegramSetSchema.parse(snapshot);
  const fresh = telegramSetSchema.parse(await telegramRequest("getStickerSet", { name: original.name }));
  if (fresh.name.toLowerCase() !== original.name.toLowerCase() || fresh.sticker_type !== original.sticker_type) throw new HttpError(400, "Набор изменился. Пришлите ссылку ещё раз.");
  const files = new Map(fresh.stickers.map(item => [item.file_unique_id, item]));
  // Telegram file_id belongs to the bot that obtained it. Renew it after a
  // credential change without changing the artwork identities or pack order.
  return { ...original, stickers: original.stickers.map(item => {
    const current = files.get(item.file_unique_id);
    if (!current) throw new HttpError(400, "Набор изменился. Пришлите ссылку ещё раз.");
    return current;
  }) };
}
export async function importTelegramItem(packId: string, sticker: TelegramSet["stickers"][number], ordinal: number, ownerId: string) {
  const id = packItemId(packId, sticker.file_unique_id);
  const existing = await prisma.importedPackItem.findUnique({ where: { id } });
  if (existing) return existing;
  const format = sticker.is_animated ? "tgs" : sticker.is_video ? "webm" : "webp";
  // Static artwork already contains a full-resolution preview. Animated/video
  // previews are independent network requests and can load beside the original.
  const downloads = await Promise.allSettled([
    downloadTelegramFile(sticker.file_id, 8 * 1024 * 1024),
    format !== "webp" && sticker.thumbnail ? downloadTelegramFile(sticker.thumbnail.file_id, 512 * 1024) : Promise.resolve(null),
  ] as const);
  if (downloads[0].status === "rejected") throw downloads[0].reason;
  if (downloads[1].status === "rejected") throw downloads[1].reason;
  let bytes = downloads[0].value;
  if (format === "tgs") bytes = validateTgs(bytes);
  else if (format === "webm") {
    if (bytes.subarray(0, 4).toString("hex") !== "1a45dfa3") throw new HttpError(400, "Некорректный видео-стикер.");
  } else bytes = await sharp(bytes, { limitInputPixels: 1024 * 1024 }).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
  const thumbnailBytes = format === "webp" ? bytes : downloads[1].value;
  if (!thumbnailBytes) throw new HttpError(400, "В наборе отсутствует превью анимации.");
  const thumbnail = await sharp(thumbnailBytes, { limitInputPixels: 1024 * 1024 }).resize(128, 128, { fit: "inside", withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  const digest = createHash("sha256").update(bytes).digest("hex");
  const [original, thumb] = await Promise.all([
    uploadMediaBuffer({ buffer: bytes, size: bytes.length, mimeType: format === "tgs" ? "application/x-tgsticker" : format === "webm" ? "video/webm" : "image/webp", kind: "sticker", ownerId, objectKey: `packs/${digest}.${format}` }),
    uploadMediaBuffer({ buffer: thumbnail, size: thumbnail.length, mimeType: "image/webp", kind: "image", ownerId, objectKey: `packs/${digest}.thumb.webp` }),
  ]);
  return prisma.importedPackItem.upsert({ where: { id }, update: {}, create: {
    id, packId, sourceUniqueId: sticker.file_unique_id, ordinal, emoji: sticker.emoji ?? "✨", format,
    adaptive: sticker.needs_repainting ?? false,
    bucket: original.bucket, objectKey: original.objectKey, thumbnailKey: thumb.objectKey,
  } });
}
