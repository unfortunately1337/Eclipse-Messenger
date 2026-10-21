import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { REGISTER_COOKIE_NAME, REGISTER_TTL_SECONDS } from "@/lib/server/constants";
import { redis } from "@/lib/server/redis";

type PendingRegistration = {
  email: string;
  passwordHash: string;
  createdAt: string;
};

function pendingKey(token: string) {
  return `register:${token}`;
}

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

export async function createPendingRegistration(email: string, passwordHash: string) {
  const token = randomUUID();
  const payload: PendingRegistration = {
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await redis.set(
    pendingKey(token),
    JSON.stringify(payload),
    "EX",
    REGISTER_TTL_SECONDS,
  );

  return token;
}

export async function getPendingRegistration(token: string) {
  const key = pendingKey(token);
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as PendingRegistration;
}

export async function deletePendingRegistration(token: string) {
  const key = pendingKey(token);
  await redis.del(key);
}

export async function consumePendingRegistration(token: string) {
  const key = pendingKey(token);
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  await redis.del(key);
  return JSON.parse(raw) as PendingRegistration;
}

export function setRegistrationCookie(res: NextResponse, token: string) {
  res.cookies.set(REGISTER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: REGISTER_TTL_SECONDS,
  });
}

export function getRegistrationToken(req: NextRequest) {
  return req.cookies.get(REGISTER_COOKIE_NAME)?.value ?? null;
}

export function clearRegistrationCookie(res: NextResponse) {
  res.cookies.set(REGISTER_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}
