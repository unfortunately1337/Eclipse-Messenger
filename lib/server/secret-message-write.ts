import { prisma } from "./prisma";
import { HttpError } from "./http";
import { requireSecretChatAccess } from "./secret-chat-access";

export async function writeSecretMessage(input: {
  chatId: string; userId: string; sessionId: string; messageId: string; textEnc: string;
}) {
  return prisma.$transaction(async tx => {
    // Serialize against approval, expiry changes and deletion of this chat.
    await tx.$queryRaw`SELECT "id" FROM "SecretChat" WHERE "id" = ${input.chatId} FOR UPDATE`;
    const chat = await tx.secretChat.findUnique({
      where: { id: input.chatId }, include: { participants: true },
    });
    const ownPart = requireSecretChatAccess(chat, input.userId, input.sessionId);
    if (!chat) throw new HttpError(404, "Секретный чат не найден");
    if (chat.participants.length !== 2 || (chat.cryptoVersion === 2 &&
        chat.participants.some(p => !p.deviceKeyId || !p.devicePublicKey))) {
      throw new HttpError(409, "Ключи устройств ещё не согласованы");
    }
    const existing = await tx.secretChatMessage.findUnique({ where: { id: input.messageId } });
    if (existing && (existing.secretChatId !== input.chatId || existing.senderId !== input.userId || existing.textEnc !== input.textEnc)) {
      throw new HttpError(409, "Идентификатор сообщения уже использован");
    }
    const message = existing ?? await tx.secretChatMessage.create({ data: {
      id: input.messageId, secretChatId: input.chatId, senderId: input.userId, textEnc: input.textEnc,
    } });
    return { message, isNew: !existing, ownPart, peerPart: chat.participants.find(p => p.userId !== input.userId)!, cryptoVersion: chat.cryptoVersion };
  }).catch((error: unknown) => {
    // Two different chats do not share the row lock but still share the global
    // message ID namespace. A collision must not leak another chat's envelope.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new HttpError(409, "Идентификатор сообщения уже использован");
    }
    throw error;
  });
}
