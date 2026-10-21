import { getVerifiedPasswordHash } from "@/lib/server/password-check";
import { readJsonBody } from "@/lib/server/request-body";
import argon2 from "argon2";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest, invalidateUserCache } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { notifyEclipsePasswordChanged } from "@/lib/server/eclipse-bot";
import { updatePasswordAndE2EBackups } from "@/lib/server/e2e-password-change";
import { isValidPublicKeyBase64, isWrappedPrivateKeyBackupPayloadBase64 } from "@/lib/server/e2e-crypto-validate";
import { assertSessionCanUseSensitiveSettings } from "@/lib/server/session";
import { passwordSchema } from "@/lib/server/validation";

const schema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
  e2eBackups: z.array(z.object({
    publicKey: z.string().min(20).max(20000).refine(isValidPublicKeyBase64, "Invalid public key"),
    privateKey: z.string().min(20).max(20000).refine(value => isWrappedPrivateKeyBackupPayloadBase64(value) && Buffer.from(value, "base64").toString("utf8").startsWith("pwv1:"), "Password-encrypted backup required"),
  })).max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionData } = await requireUserFromRequest(req);
    assertSessionCanUseSensitiveSettings(sessionData);
    const body = schema.parse(await readJsonBody(req, 384 * 1024));

    if (body.newPassword !== body.confirmPassword) {
      throw new HttpError(400, "Пароли не совпадают");
    }

    const oldPasswordHash = await getVerifiedPasswordHash(user.id, body.oldPassword);
    if (!oldPasswordHash) {
      throw new HttpError(401, "Текущий пароль неверный");
    }

    const passwordHash = await argon2.hash(body.newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await updatePasswordAndE2EBackups({ userId: user.id, oldPasswordHash, passwordHash, backups: body.e2eBackups });

    invalidateUserCache(user.id);

    void notifyEclipsePasswordChanged(user.id).catch(() => {});

    const res = jsonOk({ changed: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
