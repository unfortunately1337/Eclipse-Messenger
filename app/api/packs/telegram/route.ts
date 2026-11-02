import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf } from "@/lib/server/csrf";
import { jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { disconnectTelegramImporter, issueTelegramImportLink, telegramImporterIdentity } from "@/lib/server/telegram-import-link";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUserFromRequest(req), bot = await telegramImporterIdentity();
    const state = await prisma.packImporterState.findUnique({ where: { userId: user.id } });
    return jsonOk({ linked: Boolean(state?.telegramAccount?.startsWith(`${bot.id}:`)), username: bot.username });
  } catch (error) { return jsonError(error); }
}
export async function POST(req: NextRequest) {
  try {
    verifyCsrf(req); const { user } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `telegram-ticket:${user.id}`, limit: 10, windowSeconds: 300 });
    return jsonOk(await issueTelegramImportLink(user.id));
  } catch (error) { return jsonError(error); }
}
export async function DELETE(req: NextRequest) {
  try {
    verifyCsrf(req); const { user } = await requireUserFromRequest(req);
    await disconnectTelegramImporter(user.id);
    return jsonOk({ linked: false });
  } catch (error) { return jsonError(error); }
}
