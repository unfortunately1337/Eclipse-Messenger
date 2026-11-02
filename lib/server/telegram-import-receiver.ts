import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { encryptAtRest, decryptAtRest } from "./db-crypto";
import { HttpError } from "./http";
import { enforceRateLimit } from "./rate-limit";
import { inspectTelegramPack, telegramRequest } from "./telegram-pack-import";
import { redeemTelegramImportLink, telegramImporterBotId } from "./telegram-import-link";
import { ensureImporterBotUser, writeImporterReply, offerImporterPack } from "./pack-importer-bot";
import { getOrCreateDirectConversation } from "./chat";
import { parseTelegramPackLink, type PackKind } from "@/lib/imported-packs";
import { localizeSystemText } from "@/lib/i18n/translate";
import { maybeInviteToEclipseChannel } from "./telegram-channel-invite";

const entity = z.object({ type: z.string().max(64), custom_emoji_id: z.string().regex(/^\d{1,32}$/).optional() });
export const telegramImportUpdateSchema = z.object({
  update_id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  message: z.object({
    message_id: z.number().int(),
    from: z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), is_bot: z.boolean().optional(), language_code: z.string().max(35).optional() }),
    chat: z.object({ id: z.number().int(), type: z.string() }),
    text: z.string().max(16_384).optional(), caption: z.string().max(4096).optional(),
    entities: z.array(entity).max(300).optional(), caption_entities: z.array(entity).max(300).optional(),
    sticker: z.object({ set_name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).optional(), type: z.enum(["regular", "custom_emoji", "mask"]).optional() }).optional(),
  }).optional(),
});
export type TelegramImportUpdate = z.infer<typeof telegramImportUpdateSchema>;
export function verifyTelegramImporterWebhook(header: string | null) {
  const secret = process.env.TELEGRAM_IMPORT_WEBHOOK_SECRET;
  if (!secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) throw new HttpError(503, "Telegram receiver is not configured");
  const received = Buffer.from(header ?? ""), expected = Buffer.from(secret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new HttpError(403, "Forbidden");
}
export async function enqueueTelegramImportUpdate(input: unknown) {
  const update = telegramImportUpdateSchema.parse(input), message = update.message;
  if (!message || message.chat.type !== "private" || message.from.is_bot || message.chat.id !== message.from.id) return;
  const id = `tg-${telegramImporterBotId()}-${update.update_id}`;
  // Persist only the supported fields. Forwarded names and unrelated media never enter storage.
  await prisma.telegramImportUpdate.upsert({ where: { id }, create: { id, payloadEnc: encryptAtRest(JSON.stringify(update)) }, update: {} });
}
export async function detectTelegramImportPacks(message: NonNullable<TelegramImportUpdate["message"]>) {
  const packs = new Map<string, { name: string; kind: PackKind }>();
  const add = (name: string, kind: PackKind) => { if (/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)) packs.set(name.toLowerCase(), { name, kind }); };
  if (message.sticker?.set_name && message.sticker.type !== "mask") add(message.sticker.set_name, message.sticker.type === "custom_emoji" ? "emoji" : "sticker");
  const link = parseTelegramPackLink(message.text ?? message.caption ?? ""); if (link) add(link.name, link.kind);
  const ids = [...new Set([...(message.entities ?? []), ...(message.caption_entities ?? [])].filter(e => e.type === "custom_emoji" && e.custom_emoji_id).map(e => e.custom_emoji_id!))].slice(0, 20);
  if (ids.length) {
    const stickers = z.array(z.object({ set_name: z.string().optional(), type: z.string().optional() })).max(200).parse(await telegramRequest("getCustomEmojiStickers", { custom_emoji_ids: JSON.stringify(ids) }));
    for (const sticker of stickers) if (sticker.set_name && sticker.type === "custom_emoji") add(sticker.set_name, "emoji");
  }
  return [...packs.values()].slice(0, 5);
}
async function tellTelegram(chatId: number, text: string, languageCode?: string) {
  // These replies contain only importer instructions or public pack metadata.
  await telegramRequest("sendMessage", { chat_id: String(chatId), text: localizeSystemText(text, languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en") }).catch(() => {});
}
async function linkedAccountText(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { link: true } });
  if (!user) throw new HttpError(404, "Аккаунт Eclipse не найден. Подключите Telegram ещё раз.");
  return `Ваш аккаунт привязан к @${user.link} в Eclipse.\nОтправьте стикер, кастомный эмодзи или ссылку на набор для импорта в Eclipse.`;
}
export async function notifyTelegramImportFailed(payloadEnc: string) {
  try {
    const message = telegramImportUpdateSchema.parse(JSON.parse(decryptAtRest(payloadEnc))).message;
    if (message) await tellTelegram(message.from.id, "Не удалось получить набор после нескольких попыток. Отправьте стикер или эмодзи ещё раз немного позже.", message.from.language_code);
  } catch { /* A malformed or removed payload cannot be retried. */ }
}
export async function receiveTelegramImportUpdate(id: string, payloadEnc: string) {
  const message = telegramImportUpdateSchema.parse(JSON.parse(decryptAtRest(payloadEnc))).message;
  if (!message || message.chat.type !== "private" || message.from.is_bot || message.chat.id !== message.from.id) return;
  const chatId = message.from.id;
  const reply = (text: string) => tellTelegram(chatId, text, message.from.language_code);
  try {
    await enforceRateLimit({ key: `telegram-import:${telegramImporterBotId()}:${chatId}`, limit: 15, windowSeconds: 60 });
    const start = message.text?.match(/^\/start(?:@\w+)?\s+import_([A-Za-z0-9_-]+)$/);
    if (start) {
      const userId = await redeemTelegramImportLink(start[1], chatId, id);
      const bot = await ensureImporterBotUser(), conversationId = await getOrCreateDirectConversation(userId, bot.id);
      await writeImporterReply(conversationId, "Telegram подключён. Отправьте служебному боту стикер или сообщение с кастомным эмодзи — найденный набор появится здесь для подтверждения импорта.", `telegram-linked:${id}`);
      await reply(await linkedAccountText(userId));
      return;
    }
    const account = `${telegramImporterBotId()}:${chatId}`;
    const state = await prisma.packImporterState.findUnique({ where: { telegramAccount: account } });
    if (!state) { await reply("Сначала откройте @importbot в Eclipse и выберите в меню «Импорт через Telegram». Перейдите по кнопке из Eclipse, чтобы подключить нужный аккаунт."); return; }
    if (/^\/start(?:@\w+)?$/.test(message.text ?? "")) { await reply(await linkedAccountText(state.userId)); return; }
    const packs = await detectTelegramImportPacks(message);
    if (!packs.length) { await reply("Пришлите стикер из набора или сообщение с кастомным эмодзи. Обычные эмодзи, фотографии и отдельно загруженные файлы не содержат названия набора. Также можно прислать ссылку t.me/addstickers/… или t.me/addemoji/…"); return; }
    const bot = await ensureImporterBotUser(), conversationId = await getOrCreateDirectConversation(state.userId, bot.id);
    const found: string[] = [];
    for (const candidate of packs) {
      const pack = await inspectTelegramPack(`https://t.me/${candidate.kind === "emoji" ? "addemoji" : "addstickers"}/${candidate.name}`);
      // Disconnecting stops queued updates from adding new confirmation cards.
      const current = await prisma.packImporterState.findUnique({ where: { userId: state.userId } });
      if (current?.telegramAccount !== account) return;
      if (await offerImporterPack(state.userId, conversationId, pack, `telegram-pack:${id}:${pack.id}`)) found.push(pack.title);
    }
    await reply(!found.length ? "Эти наборы уже есть в вашем аккаунте Eclipse." : found.length === 1 ? `Набор «${found[0]}» найден. Вернитесь в Eclipse и нажмите «Импортировать».` : `Найдены наборы: «${found.join("», «")}». Вернитесь в Eclipse и нажмите «Импортировать» в нужных карточках.`);
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) { await reply(error.message); return; }
    throw error;
  } finally {
    await maybeInviteToEclipseChannel(chatId, message.from.language_code);
  }
}
