import type { AuthenticatedBot } from "./bot-api-auth";
import { prisma } from "./prisma";
import { decryptAtRest } from "./db-crypto";
import { HttpError } from "./http";
import { enqueueBotUpdate, apiBotMessage, botVisibleUser } from "./bot-messaging";
import { postBotWebhook } from "./bot-webhook-target";

async function importLegacyStarts(bot: AuthenticatedBot) {
  if (bot.legacyUpdatesImported) return;
  await prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-events:${bot.id}`}, 0))`;
    if ((await db.managedBot.findUniqueOrThrow({ where: { id: bot.id } })).legacyUpdatesImported) return;
    const messages = await db.message.findMany({ where: { encryptionScheme: "bot-command-v1", createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, conversation: { type: "direct", participants: { some: { userId: bot.profileId } } } }, include: { sender: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1000 });
    for (const message of messages) await enqueueBotUpdate(db, bot.id, `message:${message.id}`, { message: apiBotMessage(message, message.conversationId, "/start", await botVisibleUser(bot.profileId, message.sender)) });
    await db.managedBot.update({ where: { id: bot.id }, data: { legacyUpdatesImported: true } });
  });
}
export async function getBotUpdates(bot: AuthenticatedBot, offset: number, limit: number, timeout: number, signal: AbortSignal) {
  await importLegacyStarts(bot);
  const deadline = Date.now() + timeout * 1000;
  while (!signal.aborted) {
    const updates = await prisma.$transaction(async db => {
      await db.$queryRaw`SELECT "id" FROM "ManagedBot" WHERE "id" = ${bot.id} FOR UPDATE`;
      const current = await db.managedBot.findUnique({ where: { id: bot.id }, select: { tokenHash: true, webhookUrlEnc: true } });
      if (!current || current.tokenHash !== bot.tokenHash) throw new HttpError(401, "Bot token has been revoked.");
      if (current.webhookUrlEnc) throw new HttpError(409, "Disable the webhook before using getUpdates.");
      if (offset) await db.botUpdate.updateMany({ where: { botId: bot.id, updateId: { lt: offset }, acknowledgedAt: null }, data: { acknowledgedAt: new Date() } });
      return db.botUpdate.findMany({ where: { botId: bot.id, acknowledgedAt: null, updateId: { gte: offset }, expiresAt: { gt: new Date() } }, orderBy: { updateId: "asc" }, take: limit });
    });
    if (updates.length || Date.now() >= deadline) return updates.map(update => ({ update_id: update.updateId, ...JSON.parse(decryptAtRest(update.payloadEnc)) }));
    await new Promise<void>(resolve => { const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); }; const timer = setTimeout(done, 500); signal.addEventListener("abort", done, { once: true }); });
  }
  return [];
}

export async function deliverBotWebhooks() {
  const bots = await prisma.managedBot.findMany({ where: { webhookUrlEnc: { not: null }, updates: { some: { acknowledgedAt: null, expiresAt: { gt: new Date() }, nextAttemptAt: { lte: new Date() }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] } } }, take: 100, orderBy: { updatedAt: "asc" } });
  await Promise.allSettled(bots.map(async bot => {
    const update = await prisma.$transaction(async db => {
      const locks = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ManagedBot" WHERE "id" = ${bot.id} FOR UPDATE SKIP LOCKED`;
      if (!locks.length) return null;
      // Rotate active bots so a batch cannot starve later bots.
      await db.managedBot.update({ where: { id: bot.id }, data: { updatedAt: new Date() } });
      const first = await db.botUpdate.findFirst({ where: { botId: bot.id, acknowledgedAt: null, expiresAt: { gt: new Date() } }, orderBy: { updateId: "asc" } });
      if (!first || first.nextAttemptAt > new Date() || (first.lockedUntil && first.lockedUntil > new Date())) return null;
      return db.botUpdate.update({ where: { id: first.id }, data: { lockedUntil: new Date(Date.now() + 30000), attempts: { increment: 1 } } });
    });
    if (!update) return;
    const config = await prisma.managedBot.findUnique({ where: { id: bot.id } });
    if (!config?.webhookUrlEnc || !config.webhookSecretEnc || config.webhookVersion !== bot.webhookVersion) { await prisma.botUpdate.updateMany({ where: { id: update.id }, data: { lockedUntil: null } }); return; }
    try {
      await postBotWebhook(decryptAtRest(config.webhookUrlEnc), decryptAtRest(config.webhookSecretEnc), { update_id: update.updateId, ...JSON.parse(decryptAtRest(update.payloadEnc)) });
      await prisma.botUpdate.updateMany({ where: { id: update.id, bot: { webhookVersion: config.webhookVersion } }, data: { acknowledgedAt: new Date(), lockedUntil: null, lastError: null } });
    } catch {
      await prisma.botUpdate.updateMany({ where: { id: update.id }, data: { lockedUntil: null, lastError: "Webhook delivery failed", nextAttemptAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(update.attempts, 12))) } });
    }
  }));
  await prisma.botUpdate.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
const state = globalThis as typeof globalThis & { eclipseBotWorker?: ReturnType<typeof setInterval> };
export function startBotWebhookWorker() {
  if (state.eclipseBotWorker) return;
  let running = false;
  state.eclipseBotWorker = setInterval(() => { if (running) return; running = true; void deliverBotWebhooks().catch(() => {}).finally(() => { running = false; }); }, 2000);
  state.eclipseBotWorker.unref();
}
