import { verifyCurrentPassword } from "@/lib/server/password-check";
import { requireConfirmedSessionPassword } from "@/lib/server/password-confirmation";
import { readJsonBody } from "@/lib/server/request-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { consumePendingTotpSecret, getPendingTotpSecret, setPendingTotpSecret } from "@/lib/server/mfa";
import { prisma } from "@/lib/server/prisma";
import { notifyEclipseTwoFactorDisabled, notifyEclipseTwoFactorEnabled } from "@/lib/server/eclipse-bot";
import { assertSessionCanUseSensitiveSettings } from "@/lib/server/session";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  getTotpQrDataUrl,
  getTotpUri,
  verifyTotpToken,
} from "@/lib/server/totp";

const codeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });

    const res = jsonOk({
      enabled: dbUser?.twoFactorEnabled ?? false,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function PATCH(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId, sessionData } = await requireUserFromRequest(req);
    assertSessionCanUseSensitiveSettings(sessionData);
    await enforceRateLimit({ key: `settings:totp:${user.id}`, limit: 10, windowSeconds: 300 });
    await requireConfirmedSessionPassword(user.id, sessionId);
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });

    if (dbUser?.twoFactorEnabled) {
      throw new HttpError(400, "2FA уже включена");
    }

    const secret = generateTotpSecret();
    await setPendingTotpSecret(user.id, secret, sessionId);
    const label = user.email ?? user.link;
    const uri = getTotpUri(secret, label);
    const qrDataUrl = await getTotpQrDataUrl(uri);

    const res = jsonOk({ qrDataUrl, manualKey: secret, uri });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId, sessionData } = await requireUserFromRequest(req);
    assertSessionCanUseSensitiveSettings(sessionData);
    await enforceRateLimit({ key: `settings:totp:${user.id}`, limit: 10, windowSeconds: 300 });
    const confirmedPasswordHash = await requireConfirmedSessionPassword(user.id, sessionId);
    const body = codeSchema.parse(await readJsonBody(req, 128 * 1024));
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });

    if (dbUser?.twoFactorEnabled) {
      throw new HttpError(400, "2FA уже включена");
    }

    const secret = await getPendingTotpSecret(user.id, sessionId);
    if (!secret) {
      throw new HttpError(400, "Сессия настройки 2FA истекла, сгенерируйте QR заново");
    }

    const ok = verifyTotpToken(secret, body.code);
    if (!ok) {
      throw new HttpError(401, "Неверный код подтверждения");
    }

    const encryptedSecret = encryptTotpSecret(secret);
    if (!(await consumePendingTotpSecret(user.id, secret, sessionId))) {
      throw new HttpError(409, "Секрет настройки изменился, повторите настройку 2FA");
    }

    const enabled = await prisma.user.updateMany({
      where: { id: user.id, twoFactorEnabled: false, passwordHash: confirmedPasswordHash },
      data: {
        twoFactorEnabled: true,
        twoFactorSecretEnc: encryptedSecret,
      },
    });
    if (enabled.count !== 1) throw new HttpError(409, "Настройки безопасности изменились. Повторите настройку 2FA.");

    void notifyEclipseTwoFactorEnabled(user.id).catch(() => {});

    const res = jsonOk({ enabled: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}


const deleteSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/).optional(),
  password: z.string().min(1).max(128).optional(),
}).refine((data) => Boolean(data.code || data.password), {
  message: "Необходимо указать пароль или код 2FA",
});

export async function DELETE(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId, sessionData } = await requireUserFromRequest(req);
    assertSessionCanUseSensitiveSettings(sessionData);
    await enforceRateLimit({ key: `settings:totp:${user.id}`, limit: 10, windowSeconds: 300 });
    const body = deleteSchema.parse(await readJsonBody(req, 128 * 1024));
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, twoFactorSecretEnc: true },
    });

    if (!dbUser?.twoFactorEnabled || !dbUser.twoFactorSecretEnc) {
      throw new HttpError(400, "2FA уже выключена");
    }

    if (body.password) {
      const isPasswordValid = await verifyCurrentPassword(user.id, body.password);
      if (!isPasswordValid) {
        throw new HttpError(401, "Неверный пароль");
      }
    } else if (body.code) {
      const secret = decryptTotpSecret(dbUser.twoFactorSecretEnc);
      const ok = verifyTotpToken(secret, body.code);
      if (!ok) {
        throw new HttpError(401, "Неверный код подтверждения");
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretEnc: null,
      },
      select: { id: true },
    });

    void notifyEclipseTwoFactorDisabled(user.id).catch(() => {});

    const pending = await getPendingTotpSecret(user.id, sessionId);
    if (pending) {
      await consumePendingTotpSecret(user.id, undefined, sessionId);
    }

    const res = jsonOk({ enabled: false });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
