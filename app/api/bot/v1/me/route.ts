import { NextRequest } from "next/server";
import { requireBot } from "@/lib/server/bot-api-auth";
import { botMe } from "@/lib/server/bot-api-methods";
import { HttpError, jsonOk } from "@/lib/server/http";
export async function GET(req: NextRequest) {
  try { return jsonOk(botMe(await requireBot(req))); }
  catch (error) { return Response.json({ ok: false, error: error instanceof HttpError ? error.message : "Bot API unavailable." }, { status: error instanceof HttpError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } }); }
}
