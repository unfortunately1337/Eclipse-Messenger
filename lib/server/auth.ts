import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { getSessionFromCookies, getSessionFromRequest } from "@/lib/server/session";

const userCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 2000;

export function invalidateUserCache(userId: string) {
  for (const key of userCache.keys()) {
    if (key === userId || key.startsWith(`${userId}:`)) {
      userCache.delete(key);
    }
  }
}

async function findUserWithRetry<TSelect extends Prisma.UserSelect>(
  userId: string,
  select: TSelect,
) {
  // Check short-lived local cache first to avoid hitting remote DB on every sub-request
  const cacheKey = `${userId}:${JSON.stringify(Object.keys(select).sort())}`;
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  if (cached) userCache.delete(cacheKey);

  let attempts = 0;
  while (attempts < 3) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select,
      });
      if (user) {
        for (const [key, value] of userCache) { if (value.expiry <= Date.now()) userCache.delete(key); }
        if (userCache.size >= MAX_CACHE_ENTRIES) userCache.delete(userCache.keys().next().value!);
        userCache.set(cacheKey, { data: user, expiry: Date.now() + CACHE_TTL_MS });
      }
      return user;
    } catch (error) {
      attempts += 1;
      const isRecoverable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P1017" || error.code === "P1001" || error.code === "P2024");

      if (isRecoverable && attempts < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempts * 250));
        continue;
      }
      throw error;
    }
  }
  return null;
}

export async function requireUserFromRequest(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    throw new HttpError(401, "Требуется авторизация");
  }

  type RequestUser = Prisma.UserGetPayload<{
    select: {
      id: true;
      email: true;
      verified: true;
      link: true;
      link2: true;
      link3: true;
      link4: true;
      link5: true;
      displayName: true;
      emojiStatusId: true;
      description: true;
      presenceVisibility: true;
      avatarUrl: true;
      backgroundUrl: true;
      musicUrl: true;
      musicTitle: true;
      musicAuthor: true;
      musicCoverUrl: true;
      createdAt: true;
      updatedAt: true;
      passwordHash: true;
    };
  }>;
  let user: RequestUser | null;
  try {
    user = await findUserWithRetry(session.data.userId, {
      id: true,
      email: true,
      verified: true,
      link: true,
      link2: true,
      link3: true,
      link4: true,
      link5: true,
      displayName: true,
      emojiStatusId: true,
      description: true,
      presenceVisibility: true,
      avatarUrl: true,
      backgroundUrl: true,
      musicUrl: true,
      musicTitle: true,
      musicAuthor: true,
      musicCoverUrl: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new HttpError(401, "Session is invalid");
    }
    throw error;
  }

  if (!user) {
    throw new HttpError(401, "Сессия недействительна");
  }

  const pathname = req.nextUrl.pathname;
  const allowUnverified = pathname === "/api/auth/me";
  if (!allowUnverified && (!user.verified || !user.email)) {
    throw new HttpError(403, "Подтвердите email, чтобы продолжить");
  }

  return { user, sessionId: session.sessionId, sessionData: session.data };
}

export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }

  const user = await findUserWithRetry(session.data.userId, {
    id: true,
    email: true,
    verified: true,
    link: true,
    displayName: true,
    emojiStatusId: true,
    description: true,
    avatarUrl: true,
    backgroundUrl: true,
    musicUrl: true,
    musicTitle: true,
    musicAuthor: true,
    musicCoverUrl: true,
    createdAt: true,
  });

  if (!user) {
    return null;
  }

  return user;
}

export async function getUserFromRequest(req: NextRequest) {
  try {
    return await requireUserFromRequest(req);
  } catch {
    return null;
  }
}
