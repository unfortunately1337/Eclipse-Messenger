import { NextRequest } from "next/server";
import { requireBot } from "@/lib/server/bot-api-auth";
import { downloadBotFile } from "@/lib/server/bot-api-methods";
import { HttpError } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { return await downloadBotFile(await requireBot(req), (await params).id); }
  catch (error) { return Response.json({ ok: false, error: "File unavailable." }, { status: error instanceof HttpError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } }); }
}
