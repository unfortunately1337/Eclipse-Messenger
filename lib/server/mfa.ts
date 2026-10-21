import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { MFA_COOKIE_NAME, MFA_TTL_SECONDS, TOTP_SETUP_TTL_SECONDS } from "@/lib/server/constants";
import { redis } from "@/lib/server/redis";

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

function challengeKey(challengeId: string) {
  return `mfa:challenge:${challengeId}`;
}

function setupKey(userId: string, sessionId?: string) {
  return sessionId ? `mfa:setup:${userId}:${sessionId}` : `mfa:setup:${userId}`;
}

export async function createMfaChallenge(userId: string) {
  const id = randomUUID();
  await redis.set(challengeKey(id), userId, "EX", MFA_TTL_SECONDS);
  return id;
}

export function setMfaCookie(res: NextResponse, challengeId: string) {
  res.cookies.set(MFA_COOKIE_NAME, challengeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: MFA_TTL_SECONDS,
  });
}

export function clearMfaCookie(res: NextResponse) {
  res.cookies.set(MFA_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export async function consumeMfaChallenge(req: NextRequest) {
  const challengeId = req.cookies.get(MFA_COOKIE_NAME)?.value;
  if (!challengeId) {
    return null;
  }

  const userId = await redis.get(challengeKey(challengeId));
  if (!userId) {
    return null;
  }

  // One winner only, including simultaneous requests on different servers.
  if (!(await redis.compareAndSet(challengeKey(challengeId), userId, "", 1))) return null;
  return { challengeId, userId };
}

export async function setPendingTotpSecret(userId: string, secret: string, sessionId?: string) {
  await redis.set(setupKey(userId, sessionId), secret, "EX", TOTP_SETUP_TTL_SECONDS);
}

export async function getPendingTotpSecret(userId: string, sessionId?: string) {
  return redis.get(setupKey(userId, sessionId));
}

export async function consumePendingTotpSecret(userId: string, expected?: string, sessionId?: string) {
  const key = setupKey(userId, sessionId);
  const secret = await redis.get(key);
  if (!secret || (expected && secret !== expected)) return null;
  // Atomically replace the validated secret; a parallel QR generation must survive.
  if (!(await redis.compareAndSet(key, secret, "", 1))) return null;
  return secret;
}
