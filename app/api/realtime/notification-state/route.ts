import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { setNotificationView } from "@/lib/server/notification-view";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { readJsonBody } from "@/lib/server/request-body";

const schema = z.object({
  userId: z.string().min(1).max(128),
  tabId: z.uuid(),
  chatId: z.string().trim().min(1).max(128).nullable(),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    const body = schema.parse(await readJsonBody(req, 2048));
    if (body.userId !== user.id) throw new HttpError(409, "Account changed");
    await enforceRateLimit({ key: `notifications:view:${user.id}:${sessionId}`, limit: 180, windowSeconds: 60 });
    await setNotificationView(user.id, sessionId, body.tabId, body.chatId);
    const res = jsonOk({ ok: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) { return applyCors(req, jsonError(error)); }
}

export function OPTIONS(req: NextRequest) { return handleOptions(req); }
