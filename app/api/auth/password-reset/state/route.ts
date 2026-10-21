import { NextRequest } from "next/server";
import { ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { getPasswordReset, getPasswordResetToken } from "@/lib/server/password-reset";

export async function GET(req: NextRequest) {
  try {
    const token = getPasswordResetToken(req);
    if (!token) {
      const res = jsonOk({ ready: false });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    const pending = await getPasswordReset(token);
    const res = jsonOk(pending ? { ready: true, email: pending.email } : { ready: false });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
