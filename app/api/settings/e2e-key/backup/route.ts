import { readRequestBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { getUserPrivateKeyBackup, getUserPrivateKeyBackups, setUserPrivateKeyBackup, replaceUserPrivateKeyBackup } from "@/lib/server/e2e-key";
import {
  isValidBase64Canonical,
  isValidPublicKeyBase64,
  isWrappedPrivateKeyBackupPayloadBase64,
} from "@/lib/server/e2e-crypto-validate";

const schema = z.object({
  preserveActive: z.boolean().optional(),
  publicKey: z
    .string()
    .trim()
    .min(20)
    .max(20000)
    .refine((value) => isValidPublicKeyBase64(value), "Invalid public key format"),
  privateKey: z
    .string()
    .trim()
    .min(20)
    .max(20000)
    .refine((value) => isValidBase64Canonical(value), "Invalid private key format"),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const [backup, backups] = await Promise.all([
      getUserPrivateKeyBackup(user.id),
      getUserPrivateKeyBackups(user.id),
    ]);

    const res = jsonOk({
      backup: backup
        ? {
            publicKey: backup.publicKeyBase64,
            privateKey: backup.privateKeyBase64,
          }
        : null,
      backups: backups.map((item) => ({
        publicKey: item.publicKeyBase64,
        privateKey: item.privateKeyBase64,
        isActive: item.isActive,
      })),
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const rawBody = new TextDecoder().decode(await readRequestBody(req, 128 * 1024));
    if (!rawBody.trim()) {
      throw new HttpError(400, "Некорректное тело запроса");
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Некорректное тело запроса");
    }
    const body = schema.parse(parsedBody);
    const isWrappedBackup = isWrappedPrivateKeyBackupPayloadBase64(body.privateKey);
    if (!isWrappedBackup) {
      throw new HttpError(400, "Private key backups must be encrypted on the client");
    }

    const save = body.preserveActive ? replaceUserPrivateKeyBackup : setUserPrivateKeyBackup;
    await save({
      userId: user.id,
      publicKeyBase64: body.publicKey,
      privateKeyBase64: body.privateKey,
    });

    const res = jsonOk({ saved: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
