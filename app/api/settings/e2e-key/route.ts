import { readRequestBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { getUserPublicKey, setUserPrivateKeyBackup, setUserPublicKey } from "@/lib/server/e2e-key";
import {
  isValidBase64Canonical,
  isValidPublicKeyBase64,
  isWrappedPrivateKeyBackupPayloadBase64,
} from "@/lib/server/e2e-crypto-validate";

const schema = z.object({
  publicKey: z
    .string()
    .trim()
    .min(20)
    .max(20000)
    .refine((value) => isValidBase64Canonical(value), "Invalid public key format")
    .refine((value) => isValidPublicKeyBase64(value), "Invalid public key contents"),
  privateKeyBackup: z
    .string()
    .trim()
    .min(20)
    .max(20000)
    .refine((value) => isValidBase64Canonical(value), "Invalid private key backup format")
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req);
    const publicKey = await getUserPublicKey(user.id);

    const res = jsonOk({ publicKey: publicKey ?? null });
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
    if (body.privateKeyBackup) {
      const isWrappedBackup = isWrappedPrivateKeyBackupPayloadBase64(body.privateKeyBackup);
      if (!isWrappedBackup) {
        throw new HttpError(400, "Private key backups must be encrypted on the client");
      }
      await setUserPrivateKeyBackup({
        userId: user.id,
        publicKeyBase64: body.publicKey,
        privateKeyBase64: body.privateKeyBackup,
      });
    } else {
      await setUserPublicKey(user.id, body.publicKey);
    }

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
