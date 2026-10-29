import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { reconcileCall, assertCallAccess } from "@/lib/server/calls";
import { prisma } from "@/lib/server/prisma";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `calls:notification:${sessionId}`, limit: 60, windowSeconds: 60 });
    const id = z.uuid().parse(req.nextUrl.searchParams.get("id"));
    const call = await reconcileCall(id);
    if (!call) throw new HttpError(410, "Звонок завершён");
    await assertCallAccess(call, user.id);
    if (call.kind !== "direct" || call.callerId === user.id) throw new HttpError(403, "Уведомление недоступно");
    const caller = await prisma.user.findUnique({ where: { id: call.callerId }, select: { displayName: true, link: true } });
    if (!caller) throw new HttpError(410, "Звонок завершён");
    const contact = await prisma.contact.findUnique({ where: { ownerId_peerId: { ownerId: user.id, peerId: call.callerId } }, select: { alias: true } });
    return jsonOk({ recipientId: user.id, state: call.status === "ringing" ? "ringing" : call.endReason === "missed" ? "missed" : "closed",
      senderName: contact?.alias || caller.displayName, deepLink: `/app?chat=${encodeURIComponent(caller.link)}&chatType=direct` });
  } catch (error) { return jsonError(error); }
}
