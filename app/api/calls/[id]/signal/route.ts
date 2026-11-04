import { after, NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf } from "@/lib/server/csrf";
import { jsonError, jsonOk } from "@/lib/server/http";
import { readJsonBody } from "@/lib/server/request-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { sessionCallForActor } from "@/lib/server/calls";
import { callSignalSchema } from "@/lib/server/call-signaling-schema";
import { readP2PSignals, sendP2PSignal } from "@/lib/server/call-p2p";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, context: Context) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);
    const id = z.uuid().parse((await context.params).id);
    const clientId = z.uuid().parse(req.nextUrl.searchParams.get("clientId"));
    const after = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(req.nextUrl.searchParams.get("after") ?? 0);
    await enforceRateLimit({ key: `calls:p2p:read:${sessionId}`, limit: 240, windowSeconds: 60 });
    const actor = { userId: user.id, sessionId };
    const call = await sessionCallForActor(actor, id);
    return jsonOk(await readP2PSignals(call, actor, clientId, after));
  } catch (error) { return jsonError(error); }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    const id = z.uuid().parse((await context.params).id);
    const input = callSignalSchema.parse(await readJsonBody(req, 96 * 1024));
    await enforceRateLimit({ key: `calls:p2p:write:${sessionId}`, limit: 600, windowSeconds: 60 });
    const actor = { userId: user.id, sessionId };
    const call = await sessionCallForActor(actor, id);
    await sendP2PSignal(call, actor, input, notify => after(notify));
    return jsonOk({ delivered: true });
  } catch (error) { return jsonError(error); }
}
