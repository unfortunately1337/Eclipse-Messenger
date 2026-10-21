import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { requireSecretChatAccess } from "./secret-chat-access";
import type { MessagePins, PinScope } from "@/lib/message-pins";

export const pinScopeSchema = z.object({
  chatType: z.enum(["direct", "saved", "eclipse", "group", "channel", "secret"]),
  chatId: z.string().min(1).max(128),
});
export const pinMutationSchema = pinScopeSchema.extend({ messageId: z.string().min(1).max(128), pinned: z.boolean() });

async function resolveAccess(tx: Prisma.TransactionClient, scope: PinScope, userId: string, sessionId: string, notify = false) {
  if (scope.chatType === "secret") {
    const chat = await tx.secretChat.findUnique({ where: { id: scope.chatId }, include: { participants: true } });
    requireSecretChatAccess(chat, userId, sessionId);
    return { canManage: true, recipients: chat!.participants.map(member => member.userId), hiddenType: "secret" };
  }
  if (scope.chatType === "group" || scope.chatType === "channel") {
    const group = scope.chatType === "group";
    const entity = group
      ? await tx.group.findUnique({ where: { id: scope.chatId } })
      : await tx.channel.findUnique({ where: { id: scope.chatId } });
    if (!entity) throw new HttpError(404, "Чат не найден");
    // Serialize pin writes with role revocation, which locks these same membership rows.
    if (notify) {
      if (group) await tx.$queryRaw`SELECT "id" FROM "GroupMember" WHERE "groupId" = ${scope.chatId} AND "userId" = ${userId} FOR UPDATE`;
      else await tx.$queryRaw`SELECT "id" FROM "ChannelSubscriber" WHERE "channelId" = ${scope.chatId} AND "userId" = ${userId} FOR UPDATE`;
    }
    const member = group
      ? await tx.groupMember.findUnique({ where: { groupId_userId: { groupId: scope.chatId, userId } }, select: { role: true, canPinMessages: true } })
      : await tx.channelSubscriber.findUnique({ where: { channelId_userId: { channelId: scope.chatId, userId } }, select: { role: true, canPinMessages: true } });
    const owner = entity.ownerId === userId;
    if (!owner && !member && !entity.isPublic) throw new HttpError(403, "У вас нет доступа к этому чату");
    const members = !notify ? [] : group
      ? await tx.groupMember.findMany({ where: { groupId: scope.chatId }, select: { userId: true } })
      : await tx.channelSubscriber.findMany({ where: { channelId: scope.chatId }, select: { userId: true } });
    return { canManage: owner || (member?.role === "admin" && member.canPinMessages), recipients: [...new Set([entity.ownerId, ...members.map(item => item.userId)])], hiddenType: scope.chatType };
  }
  const chat = await tx.conversation.findUnique({ where: { id: scope.chatId }, include: { participants: { select: { userId: true } } } });
  if (!chat || !chat.participants.some(item => item.userId === userId)) throw new HttpError(403, "У вас нет доступа к этому чату");
  // A caller cannot disguise another conversation's hidden messages as saved/system content.
  const hiddenType = chat.type === "saved" ? "saved" : chat.isSystem ? "eclipse" : "direct";
  return { canManage: true, recipients: chat.participants.map(item => item.userId), hiddenType };
}

function scopedWhere(scope: PinScope) {
  if (scope.chatType === "group") return { groupId: scope.chatId };
  if (scope.chatType === "channel") return { channelId: scope.chatId };
  if (scope.chatType === "secret") return { secretChatId: scope.chatId };
  return { conversationId: scope.chatId };
}

async function hiddenIds(tx: Prisma.TransactionClient, userId: string, chatType: string, ids: string[]) {
  if (!ids.length) return [];
  const hidden = await tx.hiddenChatMessage.findMany({ where: { userId, chatType, messageId: { in: ids } }, select: { messageId: true } });
  return hidden.map(row => row.messageId);
}

export async function readMessagePins(scope: PinScope, userId: string, sessionId: string): Promise<MessagePins> {
  return prisma.$transaction(async tx => {
    const access = await resolveAccess(tx, scope, userId, sessionId);
    const where = { ...scopedWhere(scope), pinnedAt: { not: null } };
    const args = { where, select: { id: true, createdAt: true, pinnedAt: true }, orderBy: [{ pinnedAt: "desc" as const }, { id: "desc" as const }] };
    const rows = scope.chatType === "group" ? await tx.groupMessage.findMany(args)
      : scope.chatType === "channel" ? await tx.channelPost.findMany(args)
      : scope.chatType === "secret" ? await tx.secretChatMessage.findMany(args) : await tx.message.findMany(args);
    const excluded = new Set(await hiddenIds(tx, userId, access.hiddenType, rows.map(row => row.id)));
    return { canManage: access.canManage, pins: rows.filter(row => !excluded.has(row.id)).map(row => ({ id: row.id, createdAt: row.createdAt.toISOString(), pinnedAt: row.pinnedAt!.toISOString() })) };
  });
}

export async function writeMessagePin(scope: PinScope, messageId: string, pinned: boolean, userId: string, sessionId: string) {
  return prisma.$transaction(async tx => {
    const access = await resolveAccess(tx, scope, userId, sessionId, true);
    if (!access.canManage) throw new HttpError(403, "Нет права закреплять сообщения");
    const hidden = await tx.hiddenChatMessage.findFirst({ where: { userId, chatType: access.hiddenType, messageId }, select: { id: true } });
    if (hidden) throw new HttpError(404, "Сообщение не найдено");
    const where = { ...scopedWhere(scope), id: messageId };
    // All four models share these columns. updateMany keeps scope validation in the write itself.
    const query = { where, select: { id: true } };
    const exists = scope.chatType === "group" ? await tx.groupMessage.findFirst(query)
      : scope.chatType === "channel" ? await tx.channelPost.findFirst(query)
      : scope.chatType === "secret" ? await tx.secretChatMessage.findFirst(query) : await tx.message.findFirst(query);
    if (!exists) throw new HttpError(404, "Сообщение не найдено");
    const update = { where: { ...where, ...(pinned ? { pinnedAt: null } : {}) }, data: { pinnedAt: pinned ? new Date() : null } };
    if (scope.chatType === "group") await tx.groupMessage.updateMany(update);
    else if (scope.chatType === "channel") await tx.channelPost.updateMany(update);
    else if (scope.chatType === "secret") await tx.secretChatMessage.updateMany(update);
    else await tx.message.updateMany(update);
    return { recipients: access.recipients };
  });
}
