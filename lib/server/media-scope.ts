import { prisma } from "./prisma";
import { HttpError } from "./http";
import { requireSecretChatAccess } from "./secret-chat-access";
import { findDirectConversation, getOrCreateDirectConversation } from "./chat";
import { canUserStartConversation, getPrivacySettings } from "./privacy-settings";

export type MediaScope = { scopeType: string; scopeId: string | null; expiresAt: Date | null };

export async function resolveUploadScope(type: string, id: string, userId: string, sessionId: string): Promise<MediaScope> {
  if (type === "direct") {
    if (!await prisma.user.findUnique({ where: { id }, select: { id: true } })) throw new HttpError(404, "Пользователь не найден");
    const existing = await findDirectConversation(userId, id);
    if (!existing && !canUserStartConversation(userId, id, await getPrivacySettings(id))) throw new HttpError(403, "Пользователь ограничил новые сообщения");
    return { scopeType: "conversation", scopeId: existing ?? await getOrCreateDirectConversation(userId, id), expiresAt: null };
  }
  return requireMediaScope({ scopeType: type, scopeId: id, expiresAt: null }, userId, sessionId, true);
}

// The same check protects uploads and every download, including HEAD/ranges.
export async function requireMediaScope(scope: MediaScope, userId: string, sessionId: string, writing = false) {
  if (scope.expiresAt && scope.expiresAt.getTime() <= Date.now()) throw new HttpError(404, "Файл недоступен");
  const id = scope.scopeId;
  if (!id) throw new HttpError(403, "Нет доступа к файлу");
  if (scope.scopeType === "secret") {
    const chat = await prisma.secretChat.findUnique({ where: { id }, include: { participants: true } });
    requireSecretChatAccess(chat, userId, sessionId);
    return { ...scope, expiresAt: chat!.expiresAt };
  }
  if (scope.scopeType === "conversation") {
    const member = await prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId: id, userId } } });
    if (member) return scope;
  }
  if (scope.scopeType === "group") {
    const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId } } });
    if (member && (!writing || member.role === "owner" || member.role === "admin" || member.canPostMessages)) return scope;
  }
  if (scope.scopeType === "channel") {
    const channel = await prisma.channel.findUnique({ where: { id }, select: { ownerId: true } });
    if (channel?.ownerId === userId) return scope;
    const member = await prisma.channelSubscriber.findUnique({ where: { channelId_userId: { channelId: id, userId } } });
    if (member && (!writing || member.canPostMessages)) return scope;
  }
  if (scope.scopeType === "saved" && id === userId) return scope;
  throw new HttpError(403, "Нет доступа к файлу");
}
