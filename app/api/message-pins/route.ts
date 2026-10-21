import { after, NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf, ensureCsrfCookie } from "@/lib/server/csrf";
import { applyCors, jsonOk, jsonError, handleOptions } from "@/lib/server/http";
import { readJsonBody } from "@/lib/server/request-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { readMessagePins, writeMessagePin, pinScopeSchema, pinMutationSchema } from "@/lib/server/message-pins";
import { triggerRealtimeChannels, userPrivateChannel } from "@/lib/server/realtime";

export async function GET(req: NextRequest) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);
    const scope = pinScopeSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const response = jsonOk(await readMessagePins(scope, user.id, sessionId));
    ensureCsrfCookie(req, response);
    return applyCors(req, response);
  } catch (error) { return applyCors(req, jsonError(error)); }
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `message-pins:${user.id}`, limit: 90, windowSeconds: 60 });
    const { messageId, pinned, ...scope } = pinMutationSchema.parse(await readJsonBody(req, 4096));
    const result = await writeMessagePin(scope, messageId, pinned, user.id, sessionId);
    after(async () => {
      try { await triggerRealtimeChannels({ channels: result.recipients.map(userPrivateChannel), name: "message:pins-updated", data: scope }); }
      catch (error) { console.warn("Pinned message notification failed:", error); }
    });
    const response = jsonOk(await readMessagePins(scope, user.id, sessionId));
    ensureCsrfCookie(req, response);
    return applyCors(req, response);
  } catch (error) { return applyCors(req, jsonError(error)); }
}

export function OPTIONS(req: NextRequest) { return handleOptions(req); }
