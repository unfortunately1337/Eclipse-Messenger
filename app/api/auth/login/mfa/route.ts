import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { clearMfaCookie, consumeMfaChallenge } from "@/lib/server/mfa";
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
import { decryptTotpSecret, verifyTotpToken } from "@/lib/server/totp";
import { getAccountLoginRestriction } from "@/lib/server/account-security";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = schema.parse(await readJsonBody(req));
    await enforceRateLimit({
      key: `auth:mfa:ip:${clientIp(req)}`,
      limit: 12,
      windowSeconds: 10 * 60,
      message: "Слишком много попыток 2FA, попробуйте позже",
    });

    const challenge = await consumeMfaChallenge(req);
    if (!challenge) {
      throw new HttpError(401, "Сессия входа истекла, войдите снова");
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorSecretEnc: true,
      },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecretEnc) {
      throw new HttpError(401, "2FA не настроена");
    }
    await enforceRateLimit({
      key: `auth:mfa:user:${user.id}`,
      limit: 8,
      windowSeconds: 10 * 60,
      message: "Слишком много попыток 2FA для этого аккаунта",
    });

    const loginRestriction = await getAccountLoginRestriction(user.id);
    if (loginRestriction?.restricted) {
      throw new HttpError(
        423,
        "Вход в аккаунт временно ограничен из-за отклоненной сессии.",
        { ttlSeconds: loginRestriction.ttlSeconds },
      );
    }

    const secret = decryptTotpSecret(user.twoFactorSecretEnc);
    const isCodeValid = verifyTotpToken(secret, body.code);
    if (!isCodeValid) {
      throw new HttpError(401, "Неверный код подтверждения");
    }

    const isAddingAccount = req.cookies.get(ADD_ACCOUNT_COOKIE_NAME)?.value === "1";
    const existingSession = await getSessionFromRequest(req);
    const existingSecondarySession = await getSecondarySessionFromRequest(req);

    if (existingSession && existingSession.data.userId === user.id) {
      throw new HttpError(400, "Этот аккаунт уже добавлен");
    }
    if (existingSecondarySession && existingSecondarySession.data.userId === user.id) {
      throw new HttpError(400, "Этот аккаунт уже добавлен");
    }

    const userAgent = req.headers.get("user-agent");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const sessionId = await createSession(user.id, { userAgent, ip });
    const res = jsonOk({
      redirectTo: "/app",
    });
    ensureCsrfCookie(req, res);
    clearMfaCookie(res);
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
