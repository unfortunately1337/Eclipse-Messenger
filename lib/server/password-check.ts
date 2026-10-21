import argon2 from "argon2";
import { prisma } from "./prisma";
import { enforceRateLimit } from "./rate-limit";

export async function getVerifiedPasswordHash(userId: string, password: string): Promise<string | null> {
  await enforceRateLimit({ key: `settings:password-check:${userId}`, limit: 10, windowSeconds: 300 });
  // Never verify security actions against an auth cache: another worker may
  // still hold the previous password hash after a password change or reset.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return user && await argon2.verify(user.passwordHash, password).catch(() => false) ? user.passwordHash : null;
}

export async function verifyCurrentPassword(userId: string, password: string) {
  return Boolean(await getVerifiedPasswordHash(userId, password));
}
