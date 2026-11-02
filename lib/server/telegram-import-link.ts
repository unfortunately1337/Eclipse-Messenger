import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { telegramRequest } from "./telegram-pack-import";

export const telegramTicketHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function telegramImporterBotId() {
  const id = process.env.TELEGRAM_IMPORT_BOT_TOKEN?.split(":")[0];
  if (!id || !/^\d+$/.test(id)) throw new HttpError(503, "Импорт через Telegram временно недоступен.");
  return id;
}
let identity: { id: string; username: string; until: number } | undefined;
export async function telegramImporterIdentity() {
  const id = telegramImporterBotId();
  if (identity?.id === id && identity.until > Date.now()) return identity;
  const bot = z.object({ id: z.number().int(), username: z.string().regex(/^[A-Za-z0-9_]+$/) }).parse(await telegramRequest("getMe", {}));
  if (String(bot.id) !== id) throw new HttpError(503, "Не удалось проверить Telegram-бота.");
  identity = { id, username: bot.username, until: Date.now() + 300_000 };
  return identity;
}
export async function issueTelegramImportLink(userId: string) {
  const bot = await telegramImporterIdentity(), token = randomBytes(24).toString("base64url");
  await prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`telegram-link:${userId}`}, 0))`;
    await db.telegramImportTicket.deleteMany({ where: { userId } });
    await db.telegramImportTicket.create({ data: { userId, tokenHash: telegramTicketHash(token), expiresAt: new Date(Date.now() + 300_000) } });
  });
  return { url: `https://t.me/${bot.username}?start=import_${token}`, expiresIn: 300 };
}
export async function redeemTelegramImportLink(token: string, telegramUserId: number, updateId: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new HttpError(400, "Откройте новую ссылку из Eclipse: меню импортера → Импорт через Telegram.");
  const account = `${telegramImporterBotId()}:${telegramUserId}`, tokenHash = telegramTicketHash(token);
  return prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`telegram-account:${account}`}, 0))`;
    const ticket = await db.telegramImportTicket.findUnique({ where: { tokenHash } });
    if (!ticket || ticket.expiresAt <= new Date() || ticket.consumedUpdateId && ticket.consumedUpdateId !== updateId) throw new HttpError(400, "Ссылка устарела или уже использована. Откройте новую ссылку из Eclipse.");
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`telegram-link:${ticket.userId}`}, 0))`;
    // Recheck after the account lock: issuing another link invalidates old tickets.
    const current = await db.telegramImportTicket.findUnique({ where: { tokenHash } });
    if (!current || current.expiresAt <= new Date() || current.consumedUpdateId && current.consumedUpdateId !== updateId) throw new HttpError(400, "Ссылка устарела или уже использована. Откройте новую ссылку из Eclipse.");
    const existing = await db.packImporterState.findUnique({ where: { telegramAccount: account } });
    if (existing && existing.userId !== ticket.userId) throw new HttpError(409, "Этот Telegram уже подключён к другому аккаунту Eclipse. Сначала отключите его в том аккаунте.");
    await db.telegramImportTicket.update({ where: { tokenHash }, data: { consumedUpdateId: updateId } });
    await db.packImporterState.upsert({ where: { userId: ticket.userId }, create: { userId: ticket.userId, telegramAccount: account, telegramLinkedAt: new Date() }, update: { telegramAccount: account, telegramLinkedAt: new Date() } });
    return ticket.userId;
  });
}
export async function disconnectTelegramImporter(userId: string) {
  await prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`telegram-link:${userId}`}, 0))`;
    await db.packImporterState.updateMany({ where: { userId }, data: { telegramAccount: null, telegramLinkedAt: null } });
    await db.telegramImportTicket.deleteMany({ where: { userId } });
  });
}
