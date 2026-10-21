import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { applyCors, handleOptions, jsonError, jsonOk } from "@/lib/server/http";
import { getChatListPayload } from "@/lib/server/chat-list";

export async function GET(req: NextRequest) {
  try {
    const { user, sessionId } = await requireUserFromRequest(req);
    const parsedLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(20, Math.min(parsedLimit, 120)) : 60;
    const cursor = req.nextUrl.searchParams.get("cursor")?.trim() ?? null;
    const payload = await getChatListPayload(user.id, limit, cursor, sessionId);
    const res = jsonOk(payload);
    res.headers.set("Cache-Control", "private, no-store");
    return applyCors(req, res);
  } catch (error) {
    return applyCors(req, jsonError(error));
  }
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}
