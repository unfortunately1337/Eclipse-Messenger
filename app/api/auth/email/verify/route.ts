import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { EMAIL_CODE_TTL_SECONDS, ADD_ACCOUNT_COOKIE_NAME } from "@/lib/server/constants";
import {
  clearEmailMigrationCookie,
  consumeEmailMigration,
  getEmailMigrationToken,
} from "@/lib/server/email-migration";
import { prisma } from "@/lib/server/prisma";
import {
  createSession,
  setSessionCookie,
  setActiveUserCookie,
  getSessionFromRequest,
  setSecondarySessionCookie,
  clearAddAccountCookie,
} from "@/lib/server/session";
import { emailSchema } from "@/lib/server/validation";
import { hashOtpCode } from "@/lib/server/otp";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: emailSchema,
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
      key: `auth:email-verify:ip:${clientIp(req)}`,
      limit: 20,
      windowSeconds: 10 * 60,
      message: "Слишком много попыток проверки email",
    });
    await enforceRateLimit({
      key: `auth:email-verify:email:${body.email}`,
      limit: 8,
      windowSeconds: 10 * 60,
      message: "Слишком много попыток проверки этого email",
    });
    const now = new Date();
    const codeHash = hashOtpCode(body.code);

    const record = await prisma.emailCode.findFirst({
      where: {
        email: body.email,
        code: codeHash,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!record) {
      throw new HttpError(401, "Неверный или истекший код");
    }

    const migrationToken = getEmailMigrationToken(req);
    const session = await getSessionFromRequest(req);
    let userId: string | null = null;
    let shouldCreateSession = true;

    const isAddingAccount = Boolean(
      req.cookies.get(ADD_ACCOUNT_COOKIE_NAME)?.value === "1"
    );

    if (migrationToken) {
      const migration = await consumeEmailMigration(migrationToken);
      if (!migration) {
        throw new HttpError(401, "Сессия входа истекла, войдите снова");
      }

      const user = await prisma.user.findUnique({
        where: { id: migration.userId },
        select: { id: true, email: true, verified: true },
      });

      if (!user) {
        throw new HttpError(404, "Аккаунт не найден");
      }

      if (user.email && user.email !== body.email) {
        throw new HttpError(409, "Email уже указан для этого аккаунта");
      }

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });

      if (existing && existing.id !== user.id) {
        throw new HttpError(409, "Email уже используется");
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: body.email,
          verified: true,
        },
        select: { id: true },
      });

      userId = user.id;
    } else if (session && !isAddingAccount) {
      const user = await prisma.user.findUnique({
        where: { id: session.data.userId },
        select: { id: true, email: true, verified: true },
      });

      if (!user) {
        throw new HttpError(404, "Аккаунт не найден");
      }

      if (!user.verified || !user.email) {
        if (user.email && user.email !== body.email) {
          throw new HttpError(409, "Email уже указан для этого аккаунта");
        }

        const existing = await prisma.user.findUnique({
          where: { email: body.email },
          select: { id: true },
        });

        if (existing && existing.id !== user.id) {
          throw new HttpError(409, "Email уже используется");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            email: body.email,
            verified: true,
          },
          select: { id: true },
        });

        userId = user.id;
        shouldCreateSession = false;
      } else {
        throw new HttpError(400, "Email для вашего аккаунта уже подтверждён");
      }
    } else {
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true, verified: true },
      });

      if (!user) {
        throw new HttpError(401, "Неверный или истекший код");
      }

      if (session && session.data.userId === user.id) {
        throw new HttpError(400, "Этот аккаунт уже добавлен на этом устройстве");
      }

      if (user.verified) {
        throw new HttpError(400, "Этот аккаунт уже зарегистрирован и подтверждён. Пожалуйста, войдите с паролем.");
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { verified: true },
        select: { id: true },
      });

      userId = user.id;
      shouldCreateSession = true;
    }

    await prisma.emailCode.deleteMany({ where: { email: body.email } });

    const res = jsonOk({
      redirectTo: "/app",
      userId,
      expiresIn: EMAIL_CODE_TTL_SECONDS,
    });
    ensureCsrfCookie(req, res);

    if (shouldCreateSession) {
      if (!userId) {
        throw new HttpError(500, "Не удалось определить пользователя");
      }
      const userAgent = req.headers.get("user-agent");
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const sessionId = await createSession(userId, { userAgent, ip });
      setSessionCookie(res, sessionId);
      setActiveUserCookie(res, userId);

      if (isAddingAccount && session && session.data.userId !== userId) {
        setSecondarySessionCookie(res, session.sessionId);
        clearAddAccountCookie(res);
      }
    }

    if (migrationToken) {
      clearEmailMigrationCookie(res);
    }

    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
