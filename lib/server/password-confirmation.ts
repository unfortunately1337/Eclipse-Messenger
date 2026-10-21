import { createHash } from "node:crypto";
import { getVerifiedPasswordHash } from "./password-check";
import { prisma } from "./prisma";
import { redis } from "./redis";
import { HttpError } from "./http";

const CONFIRMATION_SECONDS = 5 * 60;
const key = (userId: string, sessionId: string) => `security:password-confirmed:${userId}:${sessionId}`;
const fingerprint = (hash: string) => createHash("sha256").update(hash).digest("hex");

export async function confirmSessionPassword(userId: string, sessionId: string, password: string) {
  const verifiedHash = await getVerifiedPasswordHash(userId, password);
  if (!verifiedHash) return false;
  await redis.set(key(userId, sessionId), fingerprint(verifiedHash), "EX", CONFIRMATION_SECONDS);
  return true;
}

export async function requireConfirmedSessionPassword(userId: string, sessionId: string) {
  const [confirmed, user] = await Promise.all([
    redis.get(key(userId, sessionId)),
    prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
  ]);
  // A confirmation on another device, before a password change, or after TTL expiry is invalid.
  if (!confirmed || !user || confirmed !== fingerprint(user.passwordHash)) {
    throw new HttpError(403, "Подтвердите текущий пароль ещё раз");
  }
  return user.passwordHash;
}
