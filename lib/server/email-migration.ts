import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { EMAIL_MIGRATION_COOKIE_NAME, EMAIL_MIGRATION_TTL_SECONDS } from "@/lib/server/constants";
import { redis } from "@/lib/server/redis";

type PendingEmailMigration = {
  userId: string;
  createdAt: string;
};

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

function migrationKey(token: string) {
  return `email:migration:${token}`;
}

export async function createEmailMigration(userId: string) {
  const token = randomUUID();
  const payload: PendingEmailMigration = {
    userId,
    createdAt: new Date().toISOString(),
  };

  await redis.set(
    migrationKey(token),
    JSON.stringify(payload),
    "EX",
    EMAIL_MIGRATION_TTL_SECONDS,
  );

  return token;
}

export async function getEmailMigration(token: string) {
  const raw = await redis.get(migrationKey(token));
  if (!raw) return null;
  return JSON.parse(raw) as PendingEmailMigration;
}

export async function consumeEmailMigration(token: string) {
  const key = migrationKey(token);
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  return JSON.parse(raw) as PendingEmailMigration;
}

export function setEmailMigrationCookie(res: NextResponse, token: string) {
  res.cookies.set(EMAIL_MIGRATION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: EMAIL_MIGRATION_TTL_SECONDS,
  });
}

export function clearEmailMigrationCookie(res: NextResponse) {
  res.cookies.set(EMAIL_MIGRATION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export function getEmailMigrationToken(req: NextRequest) {
  return req.cookies.get(EMAIL_MIGRATION_COOKIE_NAME)?.value ?? null;
}
