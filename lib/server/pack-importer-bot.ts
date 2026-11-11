import { createHash, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { NextRequest } from "next/server";
import { z } from "zod";
import { IMPORTER_BOT_LINK, IMPORTER_BOT_TITLE, IMPORTER_BOT_AVATAR, type ImportCard, type PackKind } from "@/lib/imported-packs";
import type { EclipseSystemPayload } from "@/lib/eclipse-system";
import { BOT_TRANSPORT } from "@/lib/bot-api";
import { prisma } from "./prisma";
import { getOrCreateDirectConversation } from "./chat";
import { encryptAtRest } from "./db-crypto";
import { readBotContent, notifyBotChat } from "./bot-messaging";
import { requireUserFromRequest } from "./auth";
import { verifyCsrf } from "./csrf";
import { HttpError, jsonOk } from "./http";
import { readBotRequestBody } from "./bot-request-body";
import { enforceRateLimit } from "./rate-limit";
import { enforceMessageRateLimit } from "./message-rate-limit";
import { inspectTelegramPack, preparePackImport } from "./telegram-pack-import";
import { importerNoticePayload } from "@/lib/importer-notice";
import { IMPORTER_EMPTY_TEXT, IMPORTER_HELP_TEXT, IMPORTER_GREETING } from "@/lib/importer-copy";

const BOT_ID = "system:importbot";
const replyId = (requestId: string, suffix = "reply") => `imp-${createHash("sha256").update(`${requestId}:${suffix}`).digest("hex").slice(0, 32)}`;
export async function ensureImporterBotUser() {
  const existing = await prisma.user.findUnique({ where: { id: BOT_ID } });
  if (existing) return existing;
  const passwordHash = await argon2.hash(randomUUID(), { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  return prisma.user.upsert({ where: { id: BOT_ID }, update: {}, create: {
    id: BOT_ID, link: IMPORTER_BOT_LINK, displayName: IMPORTER_BOT_TITLE, avatarUrl: IMPORTER_BOT_AVATAR,
    passwordHash, isBot: true, isSystemAccount: true, isVerified: true, verified: true,
    description: "Импортируйте наборы стикеров и эмодзи из Telegram в свой аккаунт Eclipse.",
  } });
}
export function matchesImporterQuery(query: string) {
  const q = query.trim().replace(/^@/, "").toLowerCase();
  return q.length >= 2 && [IMPORTER_BOT_LINK, "stickers", "emoji", "importer", "стикеры", "эмодзи", "импорт"].some(word => word.includes(q) || q.includes(word));
}
export async function writeImporterReply(conversationId: string, text: string, id: string = randomUUID(), card?: ImportCard, telegramConnect = false) {
  const systemPayload: EclipseSystemPayload | undefined = card || telegramConnect ? {
    title: card?.title ?? "Импорт через Telegram", body: card ? `${card.count} ${card.kind === "emoji" ? "эмодзи" : "стикеров"}` : "",
    eventType: "pack_import", botRole: "assistant", metadata: card ? { packImport: card } : { telegramImportConnect: true },
  } : importerNoticePayload(text) ?? undefined;
  const message = await prisma.message.upsert({ where: { id }, update: {}, create: {
    id, conversationId, senderId: BOT_ID, encryptionScheme: BOT_TRANSPORT,
    botContentEnc: encryptAtRest(JSON.stringify({ text })),
    ...(systemPayload ? { isSystemMessage: true, systemPayload } : {}),
  } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: message.createdAt } });
  await notifyBotChat(conversationId, message.id);
  return message;
}
export async function updateImporterCard(messageId: string, card: ImportCard) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) return;
  const payload: EclipseSystemPayload = {
    title: card.title, body: `${card.count} ${card.kind === "emoji" ? "эмодзи" : "стикеров"}`,
    eventType: "pack_import", botRole: "assistant", metadata: { packImport: card },
  };
  await prisma.message.update({ where: { id: messageId }, data: { systemPayload: payload } });
  await notifyBotChat(message.conversationId, messageId);
}
export const alreadyOwnedPackText = (title: string) => `В вашем аккаунте уже есть набор «${title}».`;
export async function offerImporterPack(userId: string, conversationId: string, pack: { id: string; title: string; kind: string; count: number }, messageId: string) {
  const plan = await preparePackImport(pack.id, userId);
  if (plan.installed && !plan.added) { await writeImporterReply(conversationId, `${alreadyOwnedPackText(plan.source.title)} Новых элементов нет.`, messageId); return false; }
  await writeImporterReply(conversationId, plan.source.title, messageId, plan.card);
  return true;
}
export async function importerUi(_userId: string) {
  const bot = await ensureImporterBotUser();
  return { profileId: bot.id, commands: [], settings: {
    empty_text: IMPORTER_EMPTY_TEXT, input_placeholder: "Сообщение",
    menu: { type: "keyboard", button_text: "Меню", open_by_default: false,
      keyboard: [[{ text: "Импорт через Telegram", message: "/telegram" }], [{ text: "Помощь", message: "/help" }]] },
  } };
}
export async function handleImporterMessage(req: NextRequest) {
  verifyCsrf(req);
  const { user } = await requireUserFromRequest(req);
  if (req.method !== "POST") throw new HttpError(403, "Сообщения импорта нельзя редактировать.");
  const args = z.object({ text: z.string().trim().min(1).max(4096), requestId: z.string().regex(/^[A-Za-z0-9:_-]{8,128}$/), replyToMessageId: z.string().optional() }).strict().parse(JSON.parse(new TextDecoder().decode(await readBotRequestBody(req, 16_384))));
  const bot = await ensureImporterBotUser(), conversationId = await getOrCreateDirectConversation(user.id, bot.id);
  await enforceMessageRateLimit(user.id, `direct:${bot.id}`);
  const id = replyId(user.id + ":" + args.requestId, "user");
  const prior = await prisma.message.findUnique({ where: { id } });
  if (prior && (prior.senderId !== user.id || prior.conversationId !== conversationId || readBotContent(prior.botContentEnc)?.text !== args.text)) throw new HttpError(409, "Этот запрос уже использован.");
  const message = prior ?? await prisma.message.upsert({ where: { id }, update: {}, create: { id, conversationId, senderId: user.id, encryptionScheme: BOT_TRANSPORT, botContentEnc: encryptAtRest(JSON.stringify({ text: args.text })) } });
  if (!prior) {
    await notifyBotChat(conversationId, message.id);
    if (args.text === "/start" || args.text === "/menu" || args.text === "/cancel") {
      await prisma.packImporterState.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: { kind: null } });
      await writeImporterReply(conversationId, IMPORTER_GREETING, replyId(user.id + ":" + args.requestId));
    } else if (["/help", "Помощь"].includes(args.text)) {
      await writeImporterReply(conversationId, IMPORTER_HELP_TEXT, replyId(user.id + ":" + args.requestId));
    } else if (["/telegram", "Импорт через Telegram"].includes(args.text)) {
      await writeImporterReply(conversationId, "Импорт через Telegram", replyId(user.id + ":" + args.requestId), undefined, true);
    } else if (["/emoji", "/stickers", "Эмодзи", "Стикеры"].includes(args.text)) {
      const kind: PackKind = ["/emoji", "Эмодзи"].includes(args.text) ? "emoji" : "sticker";
      await writeImporterReply(conversationId, `Вставьте ссылку на набор ${kind === "emoji" ? "эмодзи" : "стикеров"}\nПример ссылки: https://t.me/${kind === "emoji" ? "addemoji" : "addstickers"}/primer`, replyId(user.id + ":" + args.requestId));
    } else {
      try {
        const pack = await inspectTelegramPack(args.text);
        await offerImporterPack(user.id, conversationId, pack, replyId(user.id + ":" + args.requestId));
      } catch (error) {
        await writeImporterReply(conversationId, error instanceof HttpError ? error.message : "Не удалось прочитать набор. Проверьте ссылку и попробуйте ещё раз.", replyId(user.id + ":" + args.requestId));
      }
    }
  }
  return jsonOk({ message: { id: message.id, senderId: user.id, text: args.text, createdAt: message.createdAt.toISOString(), reactions: [] } });
}
export async function handleImporterCallback(req: NextRequest) {
  verifyCsrf(req); const { user } = await requireUserFromRequest(req);
  await enforceRateLimit({ key: `importer:action:${user.id}`, limit: 30, windowSeconds: 60 });
  const args = z.object({ messageId: z.string().max(128), data: z.enum(["import", "cancel"]), requestId: z.uuid() }).strict().parse(JSON.parse(new TextDecoder().decode(await readBotRequestBody(req, 1024))));
  const message = await prisma.message.findFirst({ where: { id: args.messageId, senderId: BOT_ID, conversation: { participants: { some: { userId: user.id } } } } });
  const payload = message?.systemPayload as EclipseSystemPayload | null;
  const card = payload?.metadata?.packImport;
  if (!message || !card) throw new HttpError(404, "Набор не найден.");
  if (args.data === "cancel") {
    // A confirmed import is durable; old cancel buttons cannot interrupt it.
    if (card.status === "confirm" || card.status === "failed") await updateImporterCard(message.id, { ...card, status: "cancelled" });
  } else {
    if (!["confirm", "failed"].includes(card.status)) return jsonOk({ ok: true });
    const result = await prisma.$transaction(async db => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pack-import:${user.id}`}, 0))`;
      const plan = await preparePackImport(card.packId, user.id, db);
      if (plan.installed && !plan.added) return { job: null, card: plan.card };
      const current = await db.packImportJob.findUnique({ where: { messageId: message.id } });
      if (current) return { job: current, card };
      if (await db.packImportJob.findFirst({ where: { userId: user.id, packId: card.packId, status: { in: ["queued", "importing", "finishing"] } } })) throw new HttpError(409, "Этот набор уже импортируется. Дождитесь завершения.");
      const active = await db.packImportJob.count({ where: { userId: user.id, status: { in: ["queued", "importing", "finishing"] } } });
      if (active >= 3) throw new HttpError(429, "Дождитесь завершения текущего импорта.");
      const job = await db.packImportJob.create({ data: { userId: user.id, packId: card.packId, messageId: message.id, conversationId: message.conversationId, sourceSnapshot: plan.snapshot } });
      return { job, card: plan.card };
    });
    const queued = result.job;
    if (!queued) {
      const count = result.card.packCount ?? result.card.count;
      await updateImporterCard(message.id, { ...result.card, update: false, count, status: "ready", completed: count });
      await writeImporterReply(message.conversationId, `${alreadyOwnedPackText(result.card.title)} Новых элементов нет.`, `import-owned:${message.id}`);
      return jsonOk({ ok: true, alreadyInstalled: true });
    }
    if (queued.status === "ready") { await updateImporterCard(message.id, { ...card, status: "ready", completed: card.count }); return jsonOk({ ok: true }); }
    if (queued.status === "failed") await prisma.packImportJob.update({ where: { id: queued.id }, data: { status: "queued", error: null, leaseId: null, leasedUntil: null } });
    await updateImporterCard(message.id, { ...result.card, status: "queued", error: undefined });
    const { processPackImports } = await import("./pack-import-worker");
    void processPackImports(queued.id).catch(() => {});
  }
  return jsonOk({ ok: true });
}
