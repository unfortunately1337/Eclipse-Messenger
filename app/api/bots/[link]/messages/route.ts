import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf } from "@/lib/server/csrf";
import { prisma } from "@/lib/server/prisma";
import { getOrCreateDirectConversation, findDirectConversation } from "@/lib/server/chat";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { readBotRequestBody } from "@/lib/server/bot-request-body";
import { writeBotMessage, readBotContent, notifyBotChat, enqueueBotUpdate, apiBotMessage, botVisibleUser } from "@/lib/server/bot-messaging";
import { encryptAtRest, decryptAtRest } from "@/lib/server/db-crypto";
import { BOT_TRANSPORT } from "@/lib/bot-api";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { canUserStartConversation, getPrivacySettings } from "@/lib/server/privacy-settings";

const schema = z.object({ text: z.string().min(1).max(65536), requestId: z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/), replyToMessageId: z.string().max(128).optional(), messageId: z.string().max(128).optional() }).strict();
async function validateBotMedia(text: string, conversationId: string) {
  if (!text.startsWith("__eclipse_media__:")) return;
  let media: Record<string, unknown>;
  try { media = JSON.parse(text.slice("__eclipse_media__:".length)); } catch { throw new HttpError(400, "Некорректное вложение."); }
  if (!media || !["image", "video", "voice", "file", "sticker", "album", "poll", "music", "story_reply"].includes(String(media.type))) throw new HttpError(400, "Некорректное вложение.");
  if (["image", "video", "voice", "file", "sticker"].includes(String(media.type)) && typeof media.src !== "string") throw new HttpError(400, "Некорректное вложение.");
  if (media.type === "album" && (!Array.isArray(media.items) || media.items.length < 2 || media.items.some(item => !item || !["image", "video"].includes(item.kind)))) throw new HttpError(400, "Некорректный альбом.");
  const sources = media.type === "album" && Array.isArray(media.items) ? media.items.map(item => item?.src) : media.src ? [media.src] : [];
  if (sources.length > 6) throw new HttpError(400, "Слишком много вложений.");
  for (const src of sources) {
    if (typeof src !== "string") throw new HttpError(400, "Некорректное вложение.");
    if (media.type === "sticker" && /^\/stickers\/[A-Za-z0-9_./-]+$/.test(src) && !src.includes("..")) continue;
    if (!src.startsWith("/media/") || src.includes("#")) throw new HttpError(400, "Вложение должно быть загружено в чат бота.");
    const asset = await prisma.mediaAsset.findFirst({ where: { objectKey: decodeURIComponent(src.slice(7)), scopeType: "conversation", scopeId: conversationId, status: "ready", clientEncrypted: false } });
    if (!asset) throw new HttpError(403, "Вложение принадлежит другому чату.");
  }
}
async function handle(req: NextRequest, { params }: { params: Promise<{ link: string }> }) {
  try {
    verifyCsrf(req); const { user } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `bot-user-message:${user.id}`, limit: 60, windowSeconds: 60 });
    const bot = await prisma.managedBot.findFirst({ where: { profile: { link: { equals: (await params).link, mode: "insensitive" }, isBot: true, isSystemAccount: false } }, include: { profile: true } });
    if (!bot) throw new HttpError(404, "Бот не найден.");
    if (!canUserStartConversation(user.id, bot.profileId, await getPrivacySettings(bot.profileId))) throw new HttpError(403, "Бот ограничил новые сообщения.");
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder().decode(await readBotRequestBody(req, 100000))); } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Некорректный запрос."); }
    const args = schema.parse(payload);
    if (req.method === "PATCH" && !args.messageId) throw new HttpError(400, "Укажите сообщение для изменения.");
    const conversationId = req.method === "PATCH" ? await findDirectConversation(user.id, bot.profileId) : await getOrCreateDirectConversation(user.id, bot.profileId);
    if (!conversationId) throw new HttpError(404, "Чат не найден.");
    await validateBotMedia(args.text, conversationId);
    let message;
    if (req.method === "PATCH") {
      const visibleUser = await botVisibleUser(bot.profileId, user);
      message = await prisma.$transaction(async db => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-events:${bot.id}`}, 0))`;
        const prior = await db.botUpdate.findUnique({ where: { botId_dedupKey: { botId: bot.id, dedupKey: `edit:${args.requestId}` } } });
        if (prior) {
          const event = JSON.parse(decryptAtRest(prior.payloadEnc)).edited_message;
          if (event.message_id !== args.messageId || (event.text ?? "__eclipse_media__:" + JSON.stringify(event.media)) !== args.text) throw new HttpError(409, "Идентификатор запроса уже использован.");
          return db.message.findUniqueOrThrow({ where: { id: args.messageId } });
        }
        const existing = await db.message.findFirst({ where: { id: args.messageId, conversationId, senderId: user.id, encryptionScheme: BOT_TRANSPORT } });
        if (!existing || existing.createdAt < new Date(Date.now() - 86400000)) throw new HttpError(403, "Это сообщение нельзя изменить.");
        const changed = await db.message.update({ where: { id: existing.id }, data: { botContentEnc: encryptAtRest(JSON.stringify({ text: args.text })) } });
        await enqueueBotUpdate(db, bot.id, `edit:${args.requestId}`, { edited_message: apiBotMessage(changed, conversationId, args.text, visibleUser) });
        return changed;
      });
      await notifyBotChat(conversationId, message.id);
    } else message = await writeBotMessage({ botId: bot.id, botProfileId: bot.profileId, conversationId, senderId: user.id, content: { text: args.text }, requestId: args.requestId, replyToMessageId: args.replyToMessageId, incoming: true });
    return jsonOk({ message: { id: message.id, senderId: message.senderId, text: readBotContent(message.botContentEnc)?.text, createdAt: message.createdAt.toISOString(), replyToMessageId: message.replyToMessageId, reactions: [] } });
  } catch (error) { return jsonError(error); }
}
export const POST = handle;
export const PATCH = handle;
