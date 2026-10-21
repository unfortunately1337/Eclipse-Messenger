import { HttpError } from "@/lib/server/http";
import { redis } from "@/lib/server/redis";

type EnforceRateLimitInput = {
  key: string;
  limit: number;
  windowSeconds: number;
  message?: string;
};

export async function enforceRollingRateLimit(input: EnforceRateLimitInput) {
  let retryAfterSeconds: number;
  try { retryAfterSeconds = await redis.consumeRollingLimit(input.key, input.limit, input.windowSeconds, Date.now()); }
  catch { throw new HttpError(503, "Сервис ограничения запросов временно недоступен"); }
  if (retryAfterSeconds > 0) throw new HttpError(429, input.message ?? "Too many requests", { retryAfterSeconds });
}

export async function enforceRateLimit(input: EnforceRateLimitInput) {
  const { key, limit, windowSeconds } = input;
  const message = input.message ?? "Too many requests";

  let nextCount: number;
  try { nextCount = await redis.incrementWithExpiry(key, windowSeconds); }
  catch { throw new HttpError(503, "Сервис ограничения запросов временно недоступен"); }

  if (nextCount > limit) {
    const ttl = await redis.ttl(key).catch(() => -1);
    throw new HttpError(429, message, {
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    });
  }
}
