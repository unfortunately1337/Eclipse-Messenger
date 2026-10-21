import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { redis } from "@/lib/server/redis";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { requireQrOwner } from "@/lib/server/qr-login-owner";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { ADD_ACCOUNT_COOKIE_NAME } from "@/lib/server/constants";
import type { QrKeyTransfer } from "@/lib/qr-key-transfer";
import {
  clearAddAccountCookie,
  getSessionFromRequest,
  setSecondarySessionCookie,
  setSessionCookie,
  setActiveUserCookie,
} from "@/lib/server/session";

const statusSchema = z.object({
  qrToken: z.string().uuid(),
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const rawBody = await readJsonBody(req).catch(() => null);
    if (!rawBody) {
      return applyCors(req, jsonOk({ status: "pending" }));
    }
    const body = statusSchema.parse(rawBody);
    const redisKey = `qr-login-token:${body.qrToken}`;

    const rawData = await redis.get(redisKey);
    if (!rawData) {
      return applyCors(req, jsonOk({ status: "expired" }));
    }

    const data = JSON.parse(rawData) as { status: string; sessionId?: string; userId?: string; ownerHash?: string; keyTransfer?: QrKeyTransfer };
    requireQrOwner(req, data.ownerHash);

    if (data.status === "approved" && data.sessionId) {
      const isAddingAccount = req.cookies.get(ADD_ACCOUNT_COOKIE_NAME)?.value === "1";
      const existingSession = await getSessionFromRequest(req);

      const res = jsonOk({ status: "approved", userId: data.userId, keyTransfer: data.keyTransfer });
      ensureCsrfCookie(req, res);
      setSessionCookie(res, data.sessionId);
      if (data.userId) {
        setActiveUserCookie(res, data.userId);
      }

      if (isAddingAccount && existingSession && (!data.userId || existingSession.data.userId !== data.userId)) {
        setSecondarySessionCookie(res, existingSession.sessionId);
        clearAddAccountCookie(res);
      }
      return applyCors(req, res);
    }

    const res = jsonOk({ status: "pending" });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}
