import type { AuthenticatedBot } from "./bot-api-auth";
import { botChatSettingsSchema, resolveBotChatSettings } from "@/lib/bot-chat-settings";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { requireBotChat } from "./bot-messaging";
import { triggerRealtimeEvent, userPrivateChannel } from "./realtime";

export const BOT_CHAT_SETTINGS_METHODS = ["setMyChatSettings", "getMyChatSettings", "setChatSettings", "getChatSettings"] as const;
export async function notifyBotSettings(profileId: string, conversationId?: string) {
  const peers = await prisma.conversationParticipant.findMany({
    where: { userId: { not: profileId }, conversation: { type: "direct", ...(conversationId ? { id: conversationId } : {}), participants: { some: { userId: profileId } } } },
    select: { userId: true, conversationId: true },
  });
  await Promise.allSettled(peers.map(peer => triggerRealtimeEvent({ channel: userPrivateChannel(peer.userId), name: "bot:ui-changed", data: { profileId, conversationId: peer.conversationId } })));
}
export async function runBotChatSettingsMethod(bot: AuthenticatedBot, method: string, input: unknown) {
  if (method === "getMyChatSettings") {
    z.object({}).strict().parse(input);
    return resolveBotChatSettings(bot.chatSettings);
  }
  if (method === "setMyChatSettings") {
    const settings = botChatSettingsSchema.parse(input);
    await prisma.$transaction(async db => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-ui:${bot.id}`}, 0))`;
      const current = await db.managedBot.findUniqueOrThrow({ where: { id: bot.id }, select: { chatSettings: true } });
      const merged = { ...botChatSettingsSchema.parse(current.chatSettings), ...settings };
      await db.managedBot.update({ where: { id: bot.id }, data: { chatSettings: merged as Prisma.InputJsonValue } });
    });
    await notifyBotSettings(bot.profileId);
    return true;
  }
  const args = z.object({ chat_id: z.string().min(1).max(128), ...(method === "setChatSettings" ? { settings: botChatSettingsSchema.nullable() } : {}) }).strict().parse(input);
  const { chat } = await requireBotChat(bot.profileId, args.chat_id);
  if (method === "getChatSettings") return resolveBotChatSettings(bot.chatSettings, chat.botChatSettings);
  const settings = (args as { settings: unknown }).settings;
  await prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bot-chat-ui:${chat.id}`}, 0))`;
    await requireBotChat(bot.profileId, args.chat_id, db);
    const current = await db.conversation.findUniqueOrThrow({ where: { id: chat.id }, select: { botChatSettings: true } });
    const merged = settings === null ? Prisma.DbNull : { ...(botChatSettingsSchema.safeParse(current.botChatSettings).data ?? {}), ...botChatSettingsSchema.parse(settings) };
    await db.conversation.update({ where: { id: chat.id }, data: { botChatSettings: merged as Prisma.InputJsonValue | typeof Prisma.DbNull } });
  });
  await notifyBotSettings(bot.profileId, chat.id);
  return true;
}
