import { NextRequest } from "next/server";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import {
  clearSecondarySessionCookie,
  clearSessionCookie,
  destroySessionById,
  getSessionFromRequest,
  getSecondarySessionFromRequest,
  promoteSecondarySession,
} from "@/lib/server/session";

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const session = await getSessionFromRequest(req);
    if (session) {
      await destroySessionById(session.sessionId);
    }

    const secondarySession = await getSecondarySessionFromRequest(req);
    if (secondarySession && (!session || secondarySession.sessionId !== session.sessionId)) {
      const res = jsonOk({
        loggedOut: true,
        switchedToRemaining: true,
        redirectTo: "/app",
      });
      ensureCsrfCookie(req, res);
      promoteSecondarySession(res, secondarySession.sessionId, secondarySession.data.userId);
      return applyCors(req, res);
    }

    const res = jsonOk({
      loggedOut: true,
      switchedToRemaining: false,
      redirectTo: "/login",
    });
    ensureCsrfCookie(req, res);
    clearSessionCookie(res);
    clearSecondarySessionCookie(res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
