import { readJsonBody } from "@/lib/server/request-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { redis } from "@/lib/server/redis";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { HttpError, applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { assertSessionCanUseSensitiveSettings, createSession, destroySessionById } from "@/lib/server/session";
import { qrKeyTransferSchema } from "@/lib/qr-key-transfer";

const approveSchema = z.object({
  qrToken: z.string().uuid(),
  keyTransfer: qrKeyTransferSchema.optional(),
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionData } = await requireUserFromRequest(req);
    assertSessionCanUseSensitiveSettings(sessionData);
    const body = approveSchema.parse(await readJsonBody(req, 384 * 1024));
    const redisKey = `qr-login-token:${body.qrToken}`;

    const rawData = await redis.get(redisKey);
    if (!rawData) {
      throw new HttpError(404, "QR-код истек или не существует");
    }

    const data = JSON.parse(rawData) as { status: string; ownerHash?: string };
    if (data.status !== "pending" || !data.ownerHash) {
      throw new HttpError(409, "Этот QR-код уже использован или устарел. Создайте новый код.");
    }
    const claim = JSON.stringify({ ...data, status: "approving" });
    if (!await redis.compareAndSet(redisKey, rawData, claim, 60)) throw new HttpError(409, "Этот QR-код уже используется");

    // Create session for the logged-in user
    const userAgent = req.headers.get("user-agent");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    let sessionId: string | undefined;
    try {
      sessionId = await createSession(user.id, { userAgent, ip });
      if (!await redis.compareAndSet(redisKey, claim, JSON.stringify({ status: "approved", sessionId, userId: user.id, ownerHash: data.ownerHash, keyTransfer: body.keyTransfer }), 60)) {
        throw new HttpError(409, "QR-код истёк во время подтверждения");
      }
    } catch (error) {
      if (sessionId) await destroySessionById(sessionId).catch(() => {});
      await redis.compareAndSet(redisKey, claim, rawData, 60).catch(() => false);
      throw error;
    }

    const res = jsonOk({ success: true });
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}
