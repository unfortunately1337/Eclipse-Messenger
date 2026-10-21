import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { restrictAccountLoginsForSecurity } from "@/lib/server/account-security";
import { notifyEclipseSuspiciousActivity } from "@/lib/server/eclipse-bot";
import { destroySessionById } from "@/lib/server/session";

const schema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId: currentSessionId } = await requireUserFromRequest(req);
    const body = schema.parse(await readJsonBody(req, 128 * 1024));

    if (body.sessionId !== currentSessionId) {
      await destroySessionById(body.sessionId);
    }
    await restrictAccountLoginsForSecurity(user.id);
    void notifyEclipseSuspiciousActivity(
      user.id,
      "Обнаружен вход, который вы не подтвердили. Мы ограничили новые входы на 24 часа.",
    ).catch(() => {});

    const res = jsonOk({
      rejectedSessionId: body.sessionId,
      loginRestrictedForSeconds: 60 * 60 * 24,
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
