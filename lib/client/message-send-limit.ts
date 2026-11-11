import { ApiRequestError } from "./api-error";

export type MessageSendFailure = { kind: "rate_limit"; retryAt: number };
type Details = { code?: string; retryAfterSeconds?: number; scope?: string };
const cooldowns = new Map<string, number>();

export function messageRateLimit(error: unknown, now = Date.now()): { retryAt: number; scope: string } | null {
  if (!(error instanceof ApiRequestError) || error.status !== 429) return null;
  const details = error.details as Details | undefined;
  if (details?.code !== "MESSAGE_RATE_LIMIT") return null;
  const seconds = typeof details.retryAfterSeconds === "number" && Number.isFinite(details.retryAfterSeconds)
    ? Math.max(1, Math.min(3600, details.retryAfterSeconds)) : 5;
  return { retryAt: now + seconds * 1000, scope: details.scope === "account" ? "account" : "chat" };
}
export function rememberMessageCooldown(account: string, target: string, limit: { retryAt: number; scope: string }) {
  const key = limit.scope === "account" ? account : `${account}:${target}`;
  cooldowns.set(key, Math.max(cooldowns.get(key) ?? 0, limit.retryAt));
}
export function assertMessageCooldown(account: string, target: string, now = Date.now()) {
  const retryAt = Math.max(cooldowns.get(account) ?? 0, cooldowns.get(`${account}:${target}`) ?? 0);
  if (retryAt > now) throw new ApiRequestError("Подождите немного перед отправкой", 429, {
    code: "MESSAGE_RATE_LIMIT", retryAfterSeconds: (retryAt - now) / 1000,
    scope: (cooldowns.get(account) ?? 0) >= retryAt ? "account" : "chat",
  });
  for (const [key, expires] of cooldowns) if (expires <= now) cooldowns.delete(key);
}
export function clearMessageCooldowns() { cooldowns.clear(); }
