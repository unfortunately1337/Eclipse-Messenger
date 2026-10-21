import { readJsonBody } from "@/lib/server/request-body";
import argon2 from "argon2";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { createMfaChallenge, setMfaCookie } from "@/lib/server/mfa";
import { prisma } from "@/lib/server/prisma";
import { ADD_ACCOUNT_COOKIE_NAME } from "@/lib/server/constants";
import {
  clearAddAccountCookie,
  createSession,
  destroySessionById,
  getSessionFromRequest,
  getSecondarySessionFromRequest,
  setSecondarySessionCookie,
  setSessionCookie,
  setActiveUserCookie,
} from "@/lib/server/session";
import { emailSchema } from "@/lib/server/validation";
import { getAccountLoginRestriction } from "@/lib/server/account-security";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  isAddingAccount: z.boolean().optional(),
});

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = schema.parse(await readJsonBody(req));
    const ip = clientIp(req);
    await enforceRateLimit({
      key: `auth:login:ip:${ip}`,
      limit: 30,
      windowSeconds: 60,
      message: "Слишком много попыток входа, попробуйте позже",
    });
    await enforceRateLimit({
      key: `auth:login:email:${body.email}`,
      limit: 10,
      windowSeconds: 10 * 60,
      message: "Слишком много попыток входа для этого email",
    });
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        verified: true,
        passwordHash: true,
        twoFactorEnabled: true,
      },
    });

    const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlfc2FsdF9mb3JfdGltaW5n$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const passwordHashToVerify = user?.passwordHash ?? dummyHash;
    const isPasswordValid = await argon2.verify(passwordHashToVerify, body.password).catch(() => false);

    if (!user || !isPasswordValid) {
      throw new HttpError(401, "Неверный email или пароль");
    }

    if (!user.verified) {
      throw new HttpError(403, "Подтвердите email, чтобы войти");
    }

    const loginRestriction = await getAccountLoginRestriction(user.id);
    if (loginRestriction?.restricted) {
      throw new HttpError(
        423,
        "Вход в аккаунт временно ограничен из-за отклоненной сессии. Попробуйте позже или используйте уже доверенное устройство.",
        { ttlSeconds: loginRestriction.ttlSeconds },
      );
    }

    const isAddingAccount = Boolean(
      body.isAddingAccount || req.cookies.get(ADD_ACCOUNT_COOKIE_NAME)?.value === "1",
    );
    const existingSession = await getSessionFromRequest(req);
    const existingSecondarySession = await getSecondarySessionFromRequest(req);

    if (existingSession && existingSession.data.userId === user.id) {
      throw new HttpError(400, "Этот аккаунт уже добавлен");
    }
    if (existingSecondarySession && existingSecondarySession.data.userId === user.id) {
      throw new HttpError(400, "Этот аккаунт уже добавлен");
    }

    if (user.twoFactorEnabled) {
      const challengeId = await createMfaChallenge(user.id);
      const res = jsonOk({
        requiresTwoFactor: true,
      });
      ensureCsrfCookie(req, res);
      setMfaCookie(res, challengeId);
      return applyCors(req, res);
    }

    const userAgent = req.headers.get("user-agent");
    const sessionId = await createSession(user.id, { userAgent, ip });
    const res = jsonOk({
      redirectTo: "/app",
    });

    ensureCsrfCookie(req, res);
    setSessionCookie(res, sessionId);
    setActiveUserCookie(res, user.id);

    if (isAddingAccount && existingSession) {
      if (existingSecondarySession) {
        void destroySessionById(existingSecondarySession.sessionId).catch(() => {});
      }
      setSecondarySessionCookie(res, existingSession.sessionId);
      clearAddAccountCookie(res);
    }
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
