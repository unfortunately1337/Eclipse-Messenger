import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { redis } from "@/lib/server/redis";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { createQrOwner } from "@/lib/server/qr-login-owner";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    await enforceRateLimit({ key: "auth:qr:generate", limit: 600, windowSeconds: 60 });
    const qrToken = randomUUID();
    const redisKey = `qr-login-token:${qrToken}`;

    // Store in Redis with a 5-minute expiry (300 seconds)
    const res = jsonOk({ qrToken });
    const ownerHash = createQrOwner(req, res);
    await redis.set(redisKey, JSON.stringify({ status: "pending", ownerHash }), "EX", 300);
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}
