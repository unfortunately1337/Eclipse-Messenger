import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf } from "@/lib/server/csrf";
import { prisma } from "@/lib/server/prisma";
import { enqueueBotUpdate, readBotContent, apiBotMessage, botVisibleUser } from "@/lib/server/bot-messaging";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { readBotRequestBody } from "@/lib/server/bot-request-body";
export async function POST(req: NextRequest, { params }: { params: Promise<{ link: string }> }) {
  try {
    verifyCsrf(req); const { user } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `bot-callback:${user.id}`, limit: 60, windowSeconds: 60 });
    const args = z.object({ messageId: z.string().max(128), data: z.string().max(64), requestId: z.string().uuid() }).strict().parse(JSON.parse(new TextDecoder().decode(await readBotRequestBody(req, 1024))));
    const bot = await prisma.managedBot.findFirst({ where: { profile: { link: (await params).link, isBot: true, isSystemAccount: false } }, include: { profile: true } });
    const message = bot && await prisma.message.findFirst({ where: { id: args.messageId, senderId: bot.profileId, conversation: { type: "direct", participants: { some: { userId: user.id } } } } });
    const content = readBotContent(message?.botContentEnc);
    if (!bot || !message || !content?.reply_markup?.inline_keyboard.flat().some(button => button.callback_data === args.data)) throw new HttpError(403, "Кнопка недоступна.");
    const id = args.requestId;
    const visible = await botVisibleUser(bot.profileId, user);
    await prisma.$transaction(db => enqueueBotUpdate(db, bot.id, `callback:${id}`, { callback_query: { id, from: { id: user.id, username: visible.link, name: visible.displayName }, data: args.data, message: apiBotMessage(message, message.conversationId, content.text, bot.profile) } }));
    return jsonOk({ id });
  } catch (error) { return jsonError(error); }
}
