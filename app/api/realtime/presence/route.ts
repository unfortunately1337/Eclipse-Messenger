import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { ensureCsrfCookie, verifyCsrf } from "@/lib/server/csrf";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { readJsonBody } from "@/lib/server/request-body";
import { refreshPresenceSnapshot } from "@/lib/server/presence";

const schema = z.object({ userIds: z.array(z.string().trim().min(1).max(128)).max(200).default([]) });

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    const body = schema.parse(await readJsonBody(req, 32 * 1024));
    await enforceRateLimit({ key: `presence:poll:${user.id}`, limit: 60, windowSeconds: 60 });
    const snapshot = await refreshPresenceSnapshot(user.id, body.userIds);
    const res = jsonOk(snapshot);
    ensureCsrfCookie(req, res);
    return applyCors(req, res);
  } catch (error) { return applyCors(req, jsonError(error)); }
}

export function OPTIONS(req: NextRequest) { return handleOptions(req); }
