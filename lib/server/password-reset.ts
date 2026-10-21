import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PASSWORD_RESET_COOKIE_NAME, PASSWORD_RESET_TTL_SECONDS } from "@/lib/server/constants";
import { redis } from "@/lib/server/redis";

type PendingPasswordReset = {
  userId: string;
  email: string;
  createdAt: string;
};

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

function passwordResetKey(token: string) {
  return `password-reset:${token}`;
}

export async function createPasswordReset(userId: string, email: string) {
  const token = randomUUID();
  const payload: PendingPasswordReset = {
    userId,
    email,
    createdAt: new Date().toISOString(),
  };

  await redis.set(passwordResetKey(token), JSON.stringify(payload), "EX", PASSWORD_RESET_TTL_SECONDS);
  return token;
}

export async function getPasswordReset(token: string) {
  const raw = await redis.get(passwordResetKey(token));
  if (!raw) return null;
  return JSON.parse(raw) as PendingPasswordReset;
}

export async function consumePasswordReset(token: string) {
  const key = passwordResetKey(token);
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  return JSON.parse(raw) as PendingPasswordReset;
}

export function setPasswordResetCookie(res: NextResponse, token: string) {
  res.cookies.set(PASSWORD_RESET_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: PASSWORD_RESET_TTL_SECONDS,
  });
}

export function clearPasswordResetCookie(res: NextResponse) {
  res.cookies.set(PASSWORD_RESET_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export function getPasswordResetToken(req: NextRequest) {
  return req.cookies.get(PASSWORD_RESET_COOKIE_NAME)?.value ?? null;
}
