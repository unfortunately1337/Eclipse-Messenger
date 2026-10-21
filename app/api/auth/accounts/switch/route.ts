import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import {
  getSessionFromRequest,
  getSecondarySessionFromRequest,
  swapAccountSessions,
} from "@/lib/server/session";

const switchSchema = z.object({
  targetUserId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const body = await readJsonBody(req).catch(() => ({}));
    const { targetUserId } = switchSchema.parse(body);

    const primarySession = await getSessionFromRequest(req);
    if (!primarySession) {
      throw new HttpError(401, "Требуется авторизация");
    }

    const secondarySession = await getSecondarySessionFromRequest(req);
    if (!secondarySession) {
      throw new HttpError(400, "Второй аккаунт не подключен");
    }

    if (targetUserId && primarySession.data.userId === targetUserId) {
      const res = jsonOk({ ok: true, activeUserId: primarySession.data.userId });
      ensureCsrfCookie(req, res);
      return applyCors(req, res);
    }

    if (targetUserId && targetUserId !== secondarySession.data.userId) {
      throw new HttpError(400, "Указанный аккаунт не найден среди подключенных");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: secondarySession.data.userId },
      select: { id: true },
    });
    if (!targetUser) {
      throw new HttpError(404, "Второй аккаунт не найден");
    }

    const res = jsonOk({
      ok: true,
      activeUserId: secondarySession.data.userId,
    });

    ensureCsrfCookie(req, res);
    swapAccountSessions(res, secondarySession.sessionId, primarySession.sessionId, secondarySession.data.userId);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
