import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
export async function GET(req: NextRequest, { params }: { params: Promise<{ link: string }> }) {
  try {
    await requireUserFromRequest(req);
    const bot = await prisma.managedBot.findFirst({ where: { profile: { link: { equals: (await params).link, mode: "insensitive" }, isBot: true, isSystemAccount: false } }, select: { commands: true } });
    if (!bot) throw new HttpError(404, "Бот не найден.");
    return jsonOk({ commands: bot.commands });
  } catch (error) { return jsonError(error); }
}
