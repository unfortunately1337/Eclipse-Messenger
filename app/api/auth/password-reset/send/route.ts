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
import { prisma } from "@/lib/server/prisma";
import { sendPasswordResetCodeEmail } from "@/lib/server/email";
import { emailSchema } from "@/lib/server/validation";
import { generateOtpCode, hashOtpCode } from "@/lib/server/otp";
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
      key: `auth:password-reset:send:ip:${clientIp(req)}`,
      limit: 8,
      windowSeconds: 10 * 60,
      message: "Слишком много запросов сброса пароля",
    });
    await enforceRateLimit({
      key: `auth:password-reset:send:email:${body.email}`,
      limit: 3,
      windowSeconds: 10 * 60,
      message: "Код уже отправлен, попробуйте позже",
    });
    const now = Date.now();

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });

    if (!user) {
      const res = jsonOk({ sent: true, expiresIn: EMAIL_CODE_TTL_SECONDS });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const last = await prisma.emailCode.findFirst({
      where: { email: body.email },
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
      console.log(`\n--- [DEV ONLY] PASSWORD RESET CODE FOR ${body.email}: ${code} ---\n`);
    }

    await prisma.emailCode.deleteMany({ where: { email: body.email } });
    await prisma.emailCode.create({
      data: {
        email: body.email,
        code: codeHash,
        expiresAt,
      },
      select: { id: true },
    });

    try {
      await sendPasswordResetCodeEmail(body.email, code, normalizeLocale(req.cookies.get(LOCALE_COOKIE)?.value));
    } catch (error) {
      await prisma.emailCode.deleteMany({ where: { email: body.email } });
      throw error;
    }

    const res = jsonOk({ sent: true, expiresIn: EMAIL_CODE_TTL_SECONDS });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
