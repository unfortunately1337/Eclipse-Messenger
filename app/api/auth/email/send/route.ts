import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";
import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import {
  EMAIL_CODE_RESEND_COOLDOWN_SECONDS,
  EMAIL_CODE_TTL_SECONDS,
} from "@/lib/server/constants";
import { getEmailMigration, getEmailMigrationToken } from "@/lib/server/email-migration";
import { sendLoginCodeEmail } from "@/lib/server/email";
import { prisma } from "@/lib/server/prisma";
import { emailSchema } from "@/lib/server/validation";
import { generateOtpCode, hashOtpCode } from "@/lib/server/otp";
import { getSessionFromRequest } from "@/lib/server/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: emailSchema,
});

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = schema.parse(await readJsonBody(req));
    await enforceRateLimit({
      key: `auth:email-send:ip:${clientIp(req)}`,
      limit: 12,
      windowSeconds: 10 * 60,
      message: "Слишком много запросов кода, попробуйте позже",
    });
    await enforceRateLimit({
      key: `auth:email-send:email:${body.email}`,
      limit: 3,
      windowSeconds: 10 * 60,
      message: "Код уже отправлен, попробуйте позже",
    });
    const now = Date.now();

    const migrationToken = getEmailMigrationToken(req);
    const targetEmail = body.email;
    const session = await getSessionFromRequest(req);

    if (migrationToken) {
      const migration = await getEmailMigration(migrationToken);
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

      if (user.email && user.verified) {
        throw new HttpError(409, "Email уже подтверждён. Используйте вход по email");
      }

      if (user.email && user.email !== targetEmail) {
        throw new HttpError(409, "Email уже указан для этого аккаунта");
      }

      const existing = await prisma.user.findUnique({
        where: { email: targetEmail },
        select: { id: true },
      });

      if (existing && existing.id !== user.id) {
        throw new HttpError(409, "Email уже используется");
      }
    } else if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.data.userId },
        select: { id: true, email: true, verified: true },
      });

      if (!user) {
        throw new HttpError(404, "Аккаунт не найден");
      }

      if (user.email && user.verified) {
        throw new HttpError(409, "Email уже подтверждён. Используйте вход по email");
      }

      if (user.email && user.email !== targetEmail) {
        throw new HttpError(409, "Email уже указан для этого аккаунта");
      }

      const existing = await prisma.user.findUnique({
        where: { email: targetEmail },
        select: { id: true },
      });

      if (existing && existing.id !== user.id) {
        throw new HttpError(409, "Email уже используется");
      }
    } else {
      const user = await prisma.user.findUnique({
        where: { email: targetEmail },
        select: { id: true, verified: true },
      });

      if (!user) {
        const res = jsonOk({ sent: true, expiresIn: EMAIL_CODE_TTL_SECONDS });
        ensureCsrfCookie(req, res);
        return applyCors(req, res);
      }
    }

    const last = await prisma.emailCode.findFirst({
      where: { email: targetEmail },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (last && now - last.createdAt.getTime() < EMAIL_CODE_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new HttpError(429, "Код уже отправлен, попробуйте позже");
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(now + EMAIL_CODE_TTL_SECONDS * 1000);

    if (process.env.NODE_ENV === "development") {
      console.log(`\n--- [DEV ONLY] VERIFICATION CODE FOR ${targetEmail}: ${code} ---\n`);
    }

    await prisma.emailCode.deleteMany({ where: { email: targetEmail } });
    await prisma.emailCode.create({
      data: {
        email: targetEmail,
        code: codeHash,
        expiresAt,
      },
      select: { id: true },
    });

    try {
      await sendLoginCodeEmail(targetEmail, code, normalizeLocale(req.cookies.get(LOCALE_COOKIE)?.value));
    } catch (error) {
      console.warn("Could not send email code via SMTP:", error);
      if (process.env.NODE_ENV === "development" || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn(`[AUTH OTP CODE] Verification code for ${targetEmail}: ${code}`);
      } else {
        await prisma.emailCode.deleteMany({ where: { email: targetEmail } });
        throw error;
      }
    }

    const res = jsonOk({
      sent: true,
      expiresIn: EMAIL_CODE_TTL_SECONDS,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    console.error("auth/email/send failed", error);
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
