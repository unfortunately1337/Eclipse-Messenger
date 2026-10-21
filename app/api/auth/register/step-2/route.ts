import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";
import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import {
  clearRegistrationCookie,
  deletePendingRegistration,
  getPendingRegistration,
  getRegistrationToken,
} from "@/lib/server/register";
import { linkSchema } from "@/lib/server/validation";
import { encryptPublicKeyForDb } from "@/lib/server/e2e-storage";
import { generateDefaultAvatarDataUrl } from "@/lib/server/default-avatar";
import { getOrCreateSavedDialog } from "@/lib/server/chat";
import { generateOtpCode, hashOtpCode } from "@/lib/server/otp";
import { sendLoginCodeEmail } from "@/lib/server/email";
import { EMAIL_CODE_TTL_SECONDS } from "@/lib/server/constants";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  displayName: z.string().trim().min(2).max(60),
  link: linkSchema,
  captchaToken: z.string().optional(),
  publicKey: z.string().min(20).max(20000),
});

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    await enforceRateLimit({
      key: `auth:register-step2:ip:${clientIp(req)}`,
      limit: 15,
      windowSeconds: 60,
      message: "Слишком много запросов регистрации, попробуйте позже",
    });
    const body = schema.parse(await readJsonBody(req));
    const token = getRegistrationToken(req);

    if (!token) {
      throw new HttpError(400, "Сессия регистрации истекла, начните заново");
    }

    const pending = await getPendingRegistration(token);
    if (!pending) {
      throw new HttpError(400, "Сессия регистрации истекла, начните заново");
    }

    const existingChannel = await prisma.channel.findUnique({
      where: { link: body.link },
      select: { id: true },
    });
    if (existingChannel) {
      throw new HttpError(409, "Ссылка уже занята");
    }

    const existingUserByLink = await prisma.user.findFirst({
      where: {
        OR: [
          { link: body.link },
          { link2: body.link },
          { link3: body.link },
          { link4: body.link },
          { link5: body.link },
        ],
      },
      select: { id: true, verified: true, link: true },
    });
    if (existingUserByLink) {
      if (existingUserByLink.verified || existingUserByLink.link !== body.link) {
        throw new HttpError(409, "Ссылка уже занята");
      }
      await prisma.user.delete({ where: { id: existingUserByLink.id } });
    }

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: pending.email },
      select: { id: true, verified: true },
    });
    if (existingUserByEmail) {
      if (existingUserByEmail.verified) {
        throw new HttpError(409, "Email уже используется");
      }
      await prisma.user.delete({ where: { id: existingUserByEmail.id } });
    }

    const publicKeyEnc = encryptPublicKeyForDb(body.publicKey);
    const avatarUrl = generateDefaultAvatarDataUrl(body.displayName, body.link);
    const backgroundUrl = null;
    const user = await prisma.user.create({
      data: {
        email: pending.email,
        verified: false,
        passwordHash: pending.passwordHash,
        displayName: body.displayName,
        link: body.link,
        avatarUrl,
        backgroundUrl,
        publicKey: publicKeyEnc,
      },
      select: {
        id: true,
        email: true,
        link: true,
        displayName: true,
        description: true,
        avatarUrl: true,
        backgroundUrl: true,
        createdAt: true,
      },
    });
    await deletePendingRegistration(token);
    try {
      await getOrCreateSavedDialog(user.id);
    } catch (dialogErr) {
      console.warn("Could not create initial saved dialog:", dialogErr);
    }

    // Generate and send email verification code
    const code = generateOtpCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_SECONDS * 1000);

    if (process.env.NODE_ENV === "development") {
      console.log(`\n--- [DEV ONLY] VERIFICATION CODE FOR ${pending.email}: ${code} ---\n`);
    }

    await prisma.emailCode.deleteMany({ where: { email: pending.email } });
    await prisma.emailCode.create({
      data: {
        email: pending.email,
        code: codeHash,
        expiresAt,
      },
    });

    // Send email verification code in background without blocking response
    sendLoginCodeEmail(pending.email, code, normalizeLocale(req.cookies.get(LOCALE_COOKIE)?.value)).catch((mailErr) => {
      console.warn("Could not send registration email code:", mailErr);
    });

    const res = jsonOk({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
      nextStep: "verifyEmail",
    });

    ensureCsrfCookie(req, res);
    clearRegistrationCookie(res);
    return applyCors(req, res);
  } catch (error) {
    console.error("Register step-2 error:", error);
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return applyCors(req, jsonError(new HttpError(409, "Email или ссылка уже заняты")));
    }

    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
