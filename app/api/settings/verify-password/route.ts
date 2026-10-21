import { confirmSessionPassword } from "@/lib/server/password-confirmation";
import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";

const schema = z.object({
  password: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    const body = schema.parse(await readJsonBody(req, 128 * 1024));

    const isPasswordValid = await confirmSessionPassword(user.id, sessionId, body.password);
    if (!isPasswordValid) {
      throw new HttpError(401, "Неверный пароль");
    }

    const res = jsonOk({ verified: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
