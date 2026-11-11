import { HttpError } from "./http";
import { redis } from "./redis";

type Reservation = { at: number; target: string };
const WINDOW_MS = 60_000;

/** One bounded account ledger, updated with CAS: all workers/devices share quotas. */
export async function enforceMessageRateLimit(userId: string, target: string, now = Date.now()) {
  const key = `rate:message:v2:${userId}`;
  for (let attempt = 0; attempt < 30; attempt++) {
    let raw: string | null;
    try { raw = await redis.get(key); }
    catch { throw new HttpError(503, "Сервис отправки временно недоступен"); }
    let reservations: Reservation[];
    try { reservations = raw ? JSON.parse(raw) : []; }
    catch { throw new HttpError(503, "Сервис отправки временно недоступен"); }
    const recent = reservations.filter(entry => entry.at > now - WINDOW_MS).sort((a, b) => a.at - b.at);
    const chat = recent.filter(entry => entry.target === target);
    const limits = [
      { entries: recent, limit: 90, window: WINDOW_MS, scope: "account" },
      { entries: chat.filter(entry => entry.at > now - 30_000), limit: 30, window: 30_000, scope: "chat" },
      { entries: chat.filter(entry => entry.at > now - 5_000), limit: 8, window: 5_000, scope: "chat" },
    ];
    let wait = 0, scope = "chat";
    for (const rule of limits) {
      if (rule.entries.length < rule.limit) continue;
      const next = rule.entries[rule.entries.length - rule.limit].at + rule.window - now;
      if (next > wait) { wait = next; scope = rule.scope; }
    }
    if (wait > 0) throw new HttpError(429, "Подождите немного перед отправкой", {
      code: "MESSAGE_RATE_LIMIT", retryAfterSeconds: Math.max(1, Math.ceil(wait / 1000)), scope,
    });
    recent.push({ at: now, target });
    try {
      const next = JSON.stringify(recent);
      const written = raw === null ? await redis.setIfAbsent(key, next, 65) : await redis.compareAndSet(key, raw, next, 65);
      if (written) return;
    } catch { throw new HttpError(503, "Сервис отправки временно недоступен"); }
  }
  throw new HttpError(503, "Повторите отправку сообщения");
}
