import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_SECONDARY_COOKIE_NAME,
  ADD_ACCOUNT_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/server/constants";
import { redis } from "@/lib/server/redis";
import { notifyEclipseNewLogin } from "@/lib/server/eclipse-bot";
import { triggerRealtimeEvent, userPrivateChannel } from "@/lib/server/realtime";
import { HttpError } from "@/lib/server/http";

type SessionData = {
  userId: string;
  createdAt: string;
  lastSeenAt?: string;
  userAgent?: string | null;
  ip?: string | null;
  securityRestrictedUntil?: string | null;
};

const SESSION_IO_TIMEOUT_MS = 10_000;
const NEW_SESSION_SECURITY_RESTRICTION_SECONDS = 60 * 60 * 24;

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

function userSessionsKey(userId: string) {
  return `user:sessions:${userId}`;
}

function parseSessionData(raw: string): SessionData | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SessionData> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.userId !== "string" || parsed.userId.trim().length === 0) return null;
    if (typeof parsed.createdAt !== "string" || parsed.createdAt.trim().length === 0) return null;
    return {
      userId: parsed.userId,
      createdAt: parsed.createdAt,
      lastSeenAt: typeof parsed.lastSeenAt === "string" ? parsed.lastSeenAt : undefined,
      userAgent: typeof parsed.userAgent === "string" ? parsed.userAgent : null,
      ip: typeof parsed.ip === "string" ? parsed.ip : null,
      securityRestrictedUntil:
        typeof parsed.securityRestrictedUntil === "string" ? parsed.securityRestrictedUntil : null,
    };
  } catch {
    return null;
  }
}

async function readSessionRecords(ids: string[]) {
  const records: Array<string | null> = [];
  // Bound each MGET while avoiding one network round trip per device.
  for (let offset = 0; offset < ids.length; offset += 200) {
    records.push(...await withTimeout(redis.mget(...ids.slice(offset, offset + 200).map(sessionKey)), SESSION_IO_TIMEOUT_MS));
  }
  return records;
}

async function countActiveSessionsForUser(userId: string) {
  const ids = await withTimeout(redis.smembers(userSessionsKey(userId)), SESSION_IO_TIMEOUT_MS);
  const records = await readSessionRecords(ids);
  let count = 0;
  for (const [index, sessionId] of ids.entries()) {
    const raw = records[index];
    const parsed = raw ? parseSessionData(raw) : null;
    if (parsed?.userId === userId) {
      count += 1;
    } else {
      await withTimeout(redis.srem(userSessionsKey(userId), sessionId), SESSION_IO_TIMEOUT_MS).catch(() => 0);
    }
  }
  return count;
}

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

export async function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null },
) {
  const sessionId = randomUUID();
  const key = sessionKey(sessionId);
  const now = new Date().toISOString();
  const existingSessionCount = await countActiveSessionsForUser(userId);
  const securityRestrictedUntil =
    existingSessionCount > 0
      ? new Date(Date.now() + NEW_SESSION_SECURITY_RESTRICTION_SECONDS * 1000).toISOString()
      : null;
  const payload: SessionData = {
    userId,
    createdAt: now,
    lastSeenAt: now,
    userAgent: meta?.userAgent ?? null,
    ip: meta?.ip ?? null,
    securityRestrictedUntil,
  };

  try {
    await withTimeout(redis.set(key, JSON.stringify(payload), "EX", SESSION_TTL_SECONDS), SESSION_IO_TIMEOUT_MS);
  } catch {
    throw new HttpError(503, "Сервис сессий временно недоступен, попробуйте позже");
  }
  try {
    await withTimeout(redis.sadd(userSessionsKey(userId), sessionId), SESSION_IO_TIMEOUT_MS);
  } catch {
    await redis.del(key).catch(() => {});
    throw new HttpError(503, "Не удалось зарегистрировать сессию");
  }
  void triggerRealtimeEvent({
    channel: userPrivateChannel(userId),
    name: "session:created",
    data: {
      sessionId,
      userId,
      createdAt: payload.createdAt,
      lastSeenAt: payload.lastSeenAt ?? payload.createdAt,
      userAgent: payload.userAgent ?? null,
      ip: payload.ip ?? null,
      securityRestrictedUntil: payload.securityRestrictedUntil ?? null,
    },
  }).catch(() => {});

  if (existingSessionCount > 0) {
    void notifyEclipseNewLogin({
      userId,
      sessionId,
      userAgent: payload.userAgent ?? null,
      ip: payload.ip ?? null,
      createdAt: payload.createdAt,
    }).catch(() => {});
  }

  return sessionId;
}

export function getSessionSecurityRestriction(data: SessionData) {
  const restrictedUntil = data.securityRestrictedUntil ?? null;
  if (!restrictedUntil) return null;
  const restrictedUntilMs = Date.parse(restrictedUntil);
  if (!Number.isFinite(restrictedUntilMs) || restrictedUntilMs <= Date.now()) return null;
  return {
    restrictedUntil,
    ttlSeconds: Math.max(0, Math.ceil((restrictedUntilMs - Date.now()) / 1000)),
  };
}

export function assertSessionCanUseSensitiveSettings(data: SessionData) {
  const restriction = getSessionSecurityRestriction(data);
  if (!restriction) return;
  throw new HttpError(
    423,
    "Для новой сессии временно ограничены смена пароля и настройки 2FA. Это защищает аккаунт, если вход был подозрительным.",
    restriction,
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Session store timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getSessionFromRequest(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  let raw: string | null = null;
  try {
    raw = await withTimeout(redis.get(sessionKey(sessionId)), SESSION_IO_TIMEOUT_MS);
  } catch {
    throw new HttpError(503, "Сессия временно недоступна, попробуйте позже");
  }
  if (!raw) {
    return null;
  }

  void redis.expire(sessionKey(sessionId), SESSION_TTL_SECONDS).catch(() => {});
  const data = parseSessionData(raw);
  if (!data) {
    return null;
  }
  if (!await touchSession(sessionId, data)) return null;
  return { sessionId, data };
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  let raw: string | null = null;
  try {
    raw = await withTimeout(redis.get(sessionKey(sessionId)), SESSION_IO_TIMEOUT_MS);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  void redis.expire(sessionKey(sessionId), SESSION_TTL_SECONDS).catch(() => {});
  const data = parseSessionData(raw);
  if (!data) {
    return null;
  }
  if (!await touchSession(sessionId, data)) return null;
  return { sessionId, data };
}

export function setSessionCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export const ACTIVE_USER_ID_COOKIE_NAME = "eclipse.active_user_id";

export function setActiveUserCookie(res: NextResponse, userId: string) {
  res.cookies.set(ACTIVE_USER_ID_COOKIE_NAME, userId, {
    httpOnly: false, // readable by client JS to prevent cross-account hydration desync
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearActiveUserCookie(res: NextResponse) {
  res.cookies.set(ACTIVE_USER_ID_COOKIE_NAME, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
  clearActiveUserCookie(res);
}

export async function getSecondarySessionFromRequest(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_SECONDARY_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  let raw: string | null = null;
  try {
    raw = await withTimeout(redis.get(sessionKey(sessionId)), SESSION_IO_TIMEOUT_MS);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  const data = parseSessionData(raw);
  if (!data) {
    return null;
  }
  return { sessionId, data };
}

export async function getSecondarySessionFromCookies() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_SECONDARY_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  let raw: string | null = null;
  try {
    raw = await withTimeout(redis.get(sessionKey(sessionId)), SESSION_IO_TIMEOUT_MS);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  const data = parseSessionData(raw);
  if (!data) {
    return null;
  }
  return { sessionId, data };
}

export function setSecondarySessionCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(SESSION_SECONDARY_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearSecondarySessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_SECONDARY_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export function setAddAccountCookie(res: NextResponse) {
  res.cookies.set(ADD_ACCOUNT_COOKIE_NAME, "1", {
    httpOnly: false,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 15,
  });
}

export function clearAddAccountCookie(res: NextResponse) {
  res.cookies.set(ADD_ACCOUNT_COOKIE_NAME, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export function swapAccountSessions(
  res: NextResponse,
  newPrimarySid: string,
  newSecondarySid: string,
  newPrimaryUserId?: string,
) {
  setSessionCookie(res, newPrimarySid);
  setSecondarySessionCookie(res, newSecondarySid);
  if (newPrimaryUserId) {
    setActiveUserCookie(res, newPrimaryUserId);
  }
}

export function promoteSecondarySession(res: NextResponse, secondarySid: string, secondaryUserId?: string) {
  setSessionCookie(res, secondarySid);
  clearSecondarySessionCookie(res);
  if (secondaryUserId) {
    setActiveUserCookie(res, secondaryUserId);
  }
}

export async function destroySessionById(sessionId: string) {
  let raw: string | null = null;
  try {
    raw = await withTimeout(redis.get(sessionKey(sessionId)), SESSION_IO_TIMEOUT_MS);
  } catch {
    raw = null;
  }
  const parsed = raw ? parseSessionData(raw) : null;
  await withTimeout(redis.del(sessionKey(sessionId)), SESSION_IO_TIMEOUT_MS);
  if (parsed?.userId) {
    await withTimeout(redis.srem(userSessionsKey(parsed.userId), sessionId), SESSION_IO_TIMEOUT_MS);
    void triggerRealtimeEvent({
      channel: userPrivateChannel(parsed.userId),
      name: "session:destroyed",
      data: {
        sessionId,
        userId: parsed.userId,
        reason: "destroyed",
        destroyedAt: new Date().toISOString(),
      },
    }).catch(() => {});
  }
}

async function touchSession(sessionId: string, data: SessionData) {
  const lastSeen = data.lastSeenAt ? Date.parse(data.lastSeenAt) : 0;
  if (lastSeen && Date.now() - lastSeen < 60_000) {
    return true;
  }
  const updated: SessionData = {
    ...data,
    lastSeenAt: new Date().toISOString(),
  };
  try {
    return await withTimeout(
      redis.setIfExists(sessionKey(sessionId), JSON.stringify(updated), SESSION_TTL_SECONDS),
      SESSION_IO_TIMEOUT_MS,
    );
  } catch {
    throw new HttpError(503, "Сервис сессий временно недоступен");
  }
}

export async function listSessionsForUser(userId: string) {
  const ids = await withTimeout(redis.smembers(userSessionsKey(userId)), SESSION_IO_TIMEOUT_MS);
  if (ids.length === 0) return [];
  let records: Array<string | null>;
  try { records = await readSessionRecords(ids); }
  catch { throw new HttpError(503, "Список сессий временно недоступен"); }
  const sessions: Array<{ sessionId: string; data: SessionData }> = [];
  for (const [index, sessionId] of ids.entries()) {
    const raw = records[index];
    if (!raw) {
      await withTimeout(redis.srem(userSessionsKey(userId), sessionId), SESSION_IO_TIMEOUT_MS);
      void triggerRealtimeEvent({
        channel: userPrivateChannel(userId),
        name: "session:destroyed",
        data: {
          sessionId,
          userId,
          reason: "expired",
          destroyedAt: new Date().toISOString(),
        },
      }).catch(() => {});
      continue;
    }
    const parsed = parseSessionData(raw);
    if (!parsed || parsed.userId !== userId) {
      await withTimeout(redis.srem(userSessionsKey(userId), sessionId), SESSION_IO_TIMEOUT_MS);
      void triggerRealtimeEvent({
        channel: userPrivateChannel(userId),
        name: "session:destroyed",
        data: {
          sessionId,
          userId,
          reason: "invalid",
          destroyedAt: new Date().toISOString(),
        },
      }).catch(() => {});
      continue;
    }
    sessions.push({ sessionId, data: parsed });
  }
  return sessions;
}
