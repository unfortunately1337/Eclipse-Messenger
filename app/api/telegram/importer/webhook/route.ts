import { NextRequest } from "next/server";
import { enqueueTelegramImportUpdate, verifyTelegramImporterWebhook } from "@/lib/server/telegram-import-receiver";
import { readJsonBody } from "@/lib/server/request-body";
import { HttpError } from "@/lib/server/http";
import { ZodError } from "zod";

export async function GET() {
  const configured = /^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_IMPORT_WEBHOOK_SECRET ?? "") && Boolean(process.env.TELEGRAM_IMPORT_BOT_TOKEN);
  return Response.json({ service: "eclipse-telegram-importer", configured }, { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    verifyTelegramImporterWebhook(req.headers.get("x-telegram-bot-api-secret-token"));
    await enqueueTelegramImportUpdate(await readJsonBody(req, 64 * 1024));
    return Response.json({ ok: true });
  } catch (error) {
    // Never log incoming linking tokens, message contents, or Telegram credentials.
    const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 503;
    return Response.json({ ok: false }, { status });
  }
}
