import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/server/auth";
import { verifyCsrf } from "@/lib/server/csrf";
import { prisma } from "@/lib/server/prisma";
import { HttpError, jsonError, jsonOk } from "@/lib/server/http";
import { resolveBotChatSettings } from "@/lib/bot-chat-settings";
import { botCommandsSchema } from "@/lib/bot-api";
import { botVisibleUser, enqueueBotUpdate, requireBotChat } from "@/lib/server/bot-messaging";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { readBotRequestBody } from "@/lib/server/bot-request-body";
import { decryptAtRest } from "@/lib/server/db-crypto";

type Params = { params: Promise<{ link: string }> };
async function findBot(link: string) {
  const bot = await prisma.managedBot.findFirst({ where: { profile: { link: { equals: link, mode: "insensitive" }, isBot: true, isSystemAccount: false } }, select: { id: true, profileId: true, commands: true, chatSettings: true } });
  if (!bot) throw new HttpError(404, "Бот не найден.");
  return bot;
}
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { user } = await requireUserFromRequest(req);
    const bot = await findBot((await params).link);
    const conversationId = req.nextUrl.searchParams.get("chat_id");
    const conversation = conversationId ? await prisma.conversation.findFirst({ where: { id: conversationId, type: "direct", isSystem: false, AND: [{ participants: { some: { userId: user.id } } }, { participants: { some: { userId: bot.profileId } } }] }, select: { botChatSettings: true } }) : null;
    if (conversationId && !conversation) throw new HttpError(403, "Нет доступа к чату.");
    return jsonOk({ profileId: bot.profileId, settings: resolveBotChatSettings(bot.chatSettings, conversation?.botChatSettings), commands: botCommandsSchema.parse(bot.commands) });
  } catch (error) { return jsonError(error); }
}
export async function POST(req: NextRequest, { params }: Params) {
  try {
    verifyCsrf(req);
    const { user } = await requireUserFromRequest(req);
    await enforceRateLimit({ key: `bot-menu:${user.id}`, limit: 60, windowSeconds: 60 });
    const args = z.object({ chat_id: z.string().min(1).max(128), row: z.number().int().min(0).max(7), column: z.number().int().min(0).max(3), request_id: z.string().uuid() }).strict().parse(JSON.parse(new TextDecoder().decode(await readBotRequestBody(req, 1024))));
    const bot = await findBot((await params).link);
    const { chat, peer } = await requireBotChat(bot.profileId, args.chat_id);
    if (peer.id !== user.id) throw new HttpError(403, "Нет доступа к чату.");
    const settings = resolveBotChatSettings(bot.chatSettings, chat.botChatSettings);
    const button = settings.menu.type === "keyboard" ? settings.menu.keyboard[args.row]?.[args.column] : undefined;
    if (!button?.callback_data) throw new HttpError(409, "Меню изменилось. Выберите кнопку в обновлённом меню.");
    const visible = await botVisibleUser(bot.profileId, user);
    const payload = { callback_query: { id: args.request_id, from: { id: user.id, username: visible.link, name: visible.displayName }, chat: { id: chat.id, type: "private" }, data: button.callback_data, source: "menu" } };
    await prisma.$transaction(async db => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-menu-callback:${args.request_id}`}, 0))`;
      const existing = await db.botUpdate.findUnique({ where: { botId_dedupKey: { botId: bot.id, dedupKey: `callback:${args.request_id}` } } });
      if (existing && decryptAtRest(existing.payloadEnc) !== JSON.stringify(payload)) throw new HttpError(409, "Этот запрос уже использован.");
      await enqueueBotUpdate(db, bot.id, `callback:${args.request_id}`, payload);
    });
    return jsonOk({ id: args.request_id });
  } catch (error) { return jsonError(error); }
}
