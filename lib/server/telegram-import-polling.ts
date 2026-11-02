import { randomUUID } from "node:crypto";
import { z } from "zod";
import { redis } from "./redis";
import { telegramRequest } from "./telegram-pack-import";
import { telegramImporterBotId } from "./telegram-import-link";
import { enqueueTelegramImportUpdate, telegramImportUpdateSchema } from "./telegram-import-receiver";

const state = globalThis as typeof globalThis & { telegramImportPollTimer?: ReturnType<typeof setInterval>; telegramImportPolling?: boolean; telegramImportWebhookCheck?: { bot: string; until: number; active: boolean } };
export async function pollTelegramImporter() {
  if (state.telegramImportPolling) return;
  state.telegramImportPolling = true;
  const owner = randomUUID();
  let held = false, lock = "";
  try {
    const bot = telegramImporterBotId(); lock = `telegram-import:poll:${bot}`;
    held = await redis.setIfAbsent(lock, owner, 45); if (!held) return;
    if (!state.telegramImportWebhookCheck || state.telegramImportWebhookCheck.bot !== bot || state.telegramImportWebhookCheck.until < Date.now()) {
      const info = z.object({ url: z.string() }).parse(await telegramRequest("getWebhookInfo", {}));
      state.telegramImportWebhookCheck = { bot, active: Boolean(info.url), until: Date.now() + 30_000 };
    }
    // A developer instance must never take updates away from the deployed webhook.
    if (state.telegramImportWebhookCheck.active) return;
    const key = `telegram-import:offset:${bot}`, raw = await redis.get(key);
    let offset = raw && /^\d{1,16}$/.test(raw) ? Number(raw) : 0;
    const updates = z.array(z.unknown()).max(100).parse(await telegramRequest("getUpdates", { offset: String(offset), timeout: "10", limit: "25", allowed_updates: '["message"]' }));
    for (const input of updates) {
      const envelope = z.object({ update_id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).safeParse(input);
      if (!envelope.success) continue;
      if (!await redis.compareAndSet(lock, owner, owner, 45)) return;
      // Unsupported message payloads cannot permanently block all later updates.
      const valid = telegramImportUpdateSchema.safeParse(input);
      if (valid.success) await enqueueTelegramImportUpdate(valid.data);
      offset = Math.max(offset, envelope.data.update_id + 1);
    }
    if (await redis.compareAndSet(lock, owner, owner, 45)) await redis.set(key, String(offset));
  } finally {
    if (held) await redis.compareAndDelete(lock, owner).catch(() => {});
    state.telegramImportPolling = false;
  }
}
export function startTelegramImportPolling() {
  if (process.env.NODE_ENV !== "development" || process.env.TELEGRAM_IMPORT_RECEIVER_MODE !== "polling" || !process.env.TELEGRAM_IMPORT_BOT_TOKEN || state.telegramImportPollTimer) return;
  state.telegramImportPollTimer = setInterval(() => { void pollTelegramImporter().catch(() => {}); }, 2000);
  state.telegramImportPollTimer.unref();
}
