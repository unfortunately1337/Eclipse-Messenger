import { redis } from "@/lib/server/redis";

const ACCOUNT_LOGIN_RESTRICTION_TTL_SECONDS = 60 * 60 * 24;

function accountLoginRestrictionKey(userId: string) {
  return `account:login-restricted:${userId}`;
}

export async function restrictAccountLoginsForSecurity(userId: string) {
  await redis.set(
    accountLoginRestrictionKey(userId),
    JSON.stringify({ restrictedAt: new Date().toISOString() }),
    "EX",
    ACCOUNT_LOGIN_RESTRICTION_TTL_SECONDS,
  );
}

export async function getAccountLoginRestriction(userId: string) {
  const key = accountLoginRestrictionKey(userId);
  const raw = await redis.get(key);
  if (!raw) return null;

  const ttlSeconds = await redis.ttl(key);
  return {
    restricted: true,
    ttlSeconds: Math.max(0, ttlSeconds),
  };
}
