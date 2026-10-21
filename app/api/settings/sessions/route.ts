import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { notifyEclipseSessionTerminated } from "@/lib/server/eclipse-bot";
import { redis } from "@/lib/server/redis";
import {
  clearSecondarySessionCookie,
  clearSessionCookie,
  destroySessionById,
  getSessionSecurityRestriction,
  getSecondarySessionFromRequest,
  listSessionsForUser,
  promoteSecondarySession,
} from "@/lib/server/session";

const deleteSchema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { user, sessionId, sessionData } = await requireUserFromRequest(req);
    const sessions = await listSessionsForUser(user.id);
    const currentRestriction = getSessionSecurityRestriction(sessionData);
    const res = jsonOk({
      currentSessionId: sessionId,
      currentSessionSecurityRestriction: currentRestriction,
      sessions: sessions.map((item) => ({
        id: item.sessionId,
        createdAt: item.data.createdAt,
        lastSeenAt: item.data.lastSeenAt ?? null,
        userAgent: item.data.userAgent ?? null,
        ip: item.data.ip ?? null,
        securityRestrictedUntil: item.data.securityRestrictedUntil ?? null,
      })),
    });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export async function DELETE(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    const body = deleteSchema.parse(await readJsonBody(req, 128 * 1024));

    const secondarySession = await getSecondarySessionFromRequest(req);
    const userSessionIds = await redis.smembers(`user:sessions:${user.id}`);
    const isOwner = userSessionIds.includes(body.sessionId);
    const isSecondaryOwner = secondarySession ? body.sessionId === secondarySession.sessionId : false;

    if (!isOwner && !isSecondaryOwner) {
      throw new HttpError(403, "У вас нет прав для завершения этой сессии");
    }

    await destroySessionById(body.sessionId);
    const isCurrentRemoved = body.sessionId === sessionId;
    const isSecondaryRemoved = secondarySession ? body.sessionId === secondarySession.sessionId : false;

    const res = jsonOk({
      removedSessionId: body.sessionId,
      currentSessionId: isCurrentRemoved ? (secondarySession?.sessionId ?? null) : sessionId,
      isCurrentRemoved,
      switchedToRemaining: Boolean(isCurrentRemoved && secondarySession),
    });

    if (isCurrentRemoved) {
      if (secondarySession && secondarySession.sessionId !== sessionId) {
        promoteSecondarySession(res, secondarySession.sessionId);
      } else {
        clearSessionCookie(res);
      }
    }
    if (isSecondaryRemoved) {
      clearSecondarySessionCookie(res);
    }
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
