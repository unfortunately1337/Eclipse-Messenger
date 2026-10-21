import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireBot } from "@/lib/server/bot-api-auth";
import { runBotApi } from "@/lib/server/bot-api-methods";
import { HttpError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function handle(req: NextRequest, { params }: { params: Promise<{ method: string }> }) {
  let response: Response;
  try {
    const { method } = await params;
    if (req.method === "GET" && !["getMe", "getUpdates", "getChat", "getFile", "getMyCommands", "getWebhookInfo", "getMyChatSettings", "getChatSettings"].includes(method)) throw new HttpError(405, "Use POST for this method.");
    response = jsonOk(await runBotApi(await requireBot(req), method, req));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 500;
    response = NextResponse.json({ ok: false, error: status === 500 ? "Bot API request failed." : error instanceof ZodError ? "Invalid request parameters." : (error as Error).message, ...(error instanceof ZodError ? { details: error.issues.map(issue => ({ path: issue.path, message: issue.message })) } : {}) }, { status });
    if (status === 429 && error instanceof HttpError) response.headers.set("Retry-After", String((error.details as { retryAfterSeconds?: number })?.retryAfterSeconds ?? 60));
    if (status === 405) response.headers.set("Allow", "POST, OPTIONS");
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}
export const GET = handle;
export const POST = handle;
export function OPTIONS() { return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } }); }
