import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf, ensureCsrfCookie } from "@/lib/server/csrf";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { readJsonBody } from "@/lib/server/request-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { livekitConfigured } from "@/lib/server/livekit";
import { callView, connectionForCall, groupCall, heartbeatCall, joinCall, leaveCall, ownCall, startCall, saveCallParticipantAudio, endedCallOutcome } from "@/lib/server/calls";

export const runtime = "nodejs";
const command = z.union([
  z.object({ action: z.literal("participant-audio"), id: z.uuid(), peerId: z.string().min(1).max(128), volume: z.number().min(0).max(1), muted: z.boolean() }).strict(),
  z.object({ action: z.literal("start"), kind: z.enum(["direct", "group"]), mode: z.enum(["audio", "video"]), link: z.string().trim().min(1).max(64) }).strict(),
  z.object({ action: z.enum(["join", "token", "heartbeat", "leave", "end"]), id: z.uuid() }).strict(),
]);

export async function GET(req: NextRequest) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);
    if (process.env.NODE_ENV === "development" && process.env.CALL_TEST_HELPER_ENABLED === "1") {
      const { startLocalCallTestHelper } = await import("@/lib/server/local-call-test-helper");
      startLocalCallTestHelper();
    }
    if (!livekitConfigured()) return jsonOk({ enabled: false, current: null, groupCall: null });
    await enforceRateLimit({ key: `calls:read:${sessionId}`, limit: 90, windowSeconds: 60 });
    const actor = { userId: user.id, sessionId };
    const current = await ownCall(user.id);
    const link = req.nextUrl.searchParams.get("group");
    const group = link && link.length <= 64 ? await groupCall(link, user.id).catch(error => {
      if (error instanceof HttpError && error.status === 403) return null;
      throw error;
    }) : null;
    const previous = req.nextUrl.searchParams.get("previous");
    const ended = !current && previous && z.uuid().safeParse(previous).success ? await endedCallOutcome(actor, previous).catch(error => {
      if (error instanceof HttpError && error.status === 403) return null;
      throw error;
    }) : null;
    const response = jsonOk({ enabled: true, current: current ? await callView(current, actor) : null, ended,
      groupCall: group ? await callView(group, actor) : null });
    ensureCsrfCookie(req, response);
    return response;
  } catch (error) { return jsonError(error); }
}

export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req);
    const { user, sessionId } = await requireUserFromRequest(req);
    if (!livekitConfigured()) throw new HttpError(503, "Звонки пока не настроены");
    const input = command.parse(await readJsonBody(req, 2048));
    await enforceRateLimit({ key: `calls:action:${sessionId}`, limit: 120, windowSeconds: 60 });
    const actor = { userId: user.id, sessionId };
    if (input.action === "start") {
      await enforceRateLimit({ key: `calls:start:${user.id}`, limit: 5, windowSeconds: 60, message: "Слишком много звонков. Попробуйте чуть позже." });
      const call = await startCall(actor, input.kind, input.mode, input.link);
      return jsonOk({ call: await callView(call, actor) });
    }
    if (!("id" in input)) throw new HttpError(400, "Некорректное действие");
    if (input.action === "participant-audio") {
      await saveCallParticipantAudio(actor, input.id, input.peerId, { volume: input.volume, muted: input.muted });
      return jsonOk({ saved: true });
    }
    if (input.action === "token") return jsonOk(await connectionForCall(actor, input.id));
    if (input.action === "join") return jsonOk({ call: await callView(await joinCall(actor, input.id), actor) });
    if (input.action === "heartbeat") { await heartbeatCall(actor, input.id); return jsonOk({ alive: true }); }
    if (input.action === "leave" || input.action === "end") {
      // The state is committed before the response; cleanup is not fire-and-forget.
      const ended = await leaveCall(actor, input.id, input.action === "end");
      return jsonOk({ ended: true, outcome: ended?.endReason });
    }
    throw new HttpError(400, "Некорректное действие");
  } catch (error) { return jsonError(error); }
}
