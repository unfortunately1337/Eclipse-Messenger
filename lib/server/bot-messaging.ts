import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { BOT_TRANSPORT, botContentSchema, type BotContent } from "@/lib/bot-api";
import { prisma } from "./prisma";
import { encryptAtRest } from "./db-crypto";
import { getPrivacySettings, shouldHideUsername } from "./privacy-settings";
import { HttpError } from "./http";
import { invalidateChatListPayloadCache } from "./chat-list";
import { triggerRealtimeEvent, userPrivateChannel } from "./realtime";

type Db = Prisma.TransactionClient;
import { readBotContent } from "./bot-content";
export { readBotContent };
export async function botVisibleUser(viewerId: string, user: { id: string; link: string; displayName: string; isBot?: boolean }) {
  const privacy = await getPrivacySettings(user.id);
  return { ...user, link: shouldHideUsername(viewerId, user.id, privacy) ? "" : user.link, isBot: user.isBot ?? false };
}
export async function enqueueBotUpdate(db: Db, botId: string, dedupKey: string, payload: unknown) {
  // Lock the bot before allocating its sequence, including competing webhook/poll writers.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-events:${botId}`}, 0))`;
  if (await db.botUpdate.findUnique({ where: { botId_dedupKey: { botId, dedupKey } } })) return;
  const bot = await db.managedBot.update({ where: { id: botId }, data: { nextUpdateId: { increment: 1 } }, select: { nextUpdateId: true } });
  await db.botUpdate.create({ data: { botId, updateId: bot.nextUpdateId, dedupKey, payloadEnc: encryptAtRest(JSON.stringify(payload)), expiresAt: new Date(Date.now() + 7 * 86400000) } });
}
export async function requireBotChat(botProfileId: string, chatId: string, db: Db = prisma) {
  const chat = await db.conversation.findFirst({ where: { id: chatId, type: "direct", isSystem: false, participants: { some: { userId: botProfileId } } }, include: { participants: { include: { user: { select: { id: true, link: true, displayName: true, isBot: true, isSystemAccount: true } } } } } });
  const peer = chat?.participants.find(participant => participant.userId !== botProfileId)?.user;
  if (!chat || chat.participants.length !== 2 || !peer || peer.isBot || peer.isSystemAccount) throw new HttpError(403, "The bot has no access to this chat.");
  // A bot can reply only after the user has initiated contact; knowing an ID is insufficient.
  if (!await db.message.findFirst({ where: { conversationId: chatId, senderId: peer.id }, select: { id: true } })) throw new HttpError(403, "The user must start the bot first.");
  return { chat, peer };
}
export function apiBotMessage(message: { id: string; senderId: string; createdAt: Date; replyToMessageId: string | null }, chatId: string, text: string, from: { id: string; link: string; displayName: string; isBot: boolean }) {
  let media: unknown;
  if (text.startsWith("__eclipse_media__:")) media = JSON.parse(text.slice("__eclipse_media__:".length));
  return { message_id: message.id, chat: { id: chatId, type: "private" }, from: { id: from.id, username: from.link, name: from.displayName, is_bot: from.isBot }, date: Math.floor(message.createdAt.getTime() / 1000), ...(media ? { media } : { text }), ...(message.replyToMessageId ? { reply_to_message_id: message.replyToMessageId } : {}) };
}
export async function notifyBotChat(conversationId: string, messageId?: string) {
  const participants = await prisma.conversationParticipant.findMany({ where: { conversationId }, select: { userId: true } });
  await invalidateChatListPayloadCache(participants.map(participant => participant.userId));
  await Promise.allSettled(participants.map(participant => triggerRealtimeEvent({ channel: userPrivateChannel(participant.userId), name: "bot:changed", data: { conversationId, messageId } })));
}
export async function writeBotMessage(input: { botId: string; botProfileId: string; conversationId: string; senderId: string; content: BotContent; requestId?: string; replyToMessageId?: string; incoming: boolean }) {
  const content = botContentSchema.parse(input.content);
  const id = input.requestId ?? randomUUID();
  const sender = input.incoming ? await botVisibleUser(input.botProfileId, await prisma.user.findUniqueOrThrow({ where: { id: input.senderId }, select: { id: true, link: true, displayName: true, isBot: true } })) : null;
  const message = await prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-message:${id}`}, 0))`;
    const existing = await db.message.findUnique({ where: { id } });
    if (existing) {
      if (existing.senderId !== input.senderId || existing.conversationId !== input.conversationId || existing.encryptionScheme !== BOT_TRANSPORT || JSON.stringify(readBotContent(existing.botContentEnc)) !== JSON.stringify(content) || existing.replyToMessageId !== (input.replyToMessageId ?? null)) throw new HttpError(409, "Request ID already used with different content.");
      return existing;
    }
    if (!input.incoming) await requireBotChat(input.botProfileId, input.conversationId, db);
    if (input.replyToMessageId && !await db.message.findFirst({ where: { id: input.replyToMessageId, conversationId: input.conversationId } })) throw new HttpError(400, "Reply message does not belong to this chat.");
    const created = await db.message.create({ data: { id, conversationId: input.conversationId, senderId: input.senderId, encryptionScheme: BOT_TRANSPORT, botContentEnc: encryptAtRest(JSON.stringify(content)), replyToMessageId: input.replyToMessageId ?? null } });
    await db.conversation.update({ where: { id: input.conversationId }, data: { updatedAt: created.createdAt } });
    await db.conversationParticipant.updateMany({ where: { conversationId: input.conversationId, userId: input.senderId }, data: { lastReadAt: created.createdAt } });
    if (input.incoming) {
      await enqueueBotUpdate(db, input.botId, `message:${id}`, { message: apiBotMessage(created, input.conversationId, content.text, sender!) });
    }
    return created;
  });
  await notifyBotChat(input.conversationId, message.id);
  return message;
}
