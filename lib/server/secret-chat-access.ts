import { HttpError } from "./http";

type Participant = { userId: string; acceptedSessionId: string | null; deviceKeyId?: string | null; devicePublicKey?: string | null };
type SecretChatAccess = {
  expiresAt: Date | null;
  isApproved: boolean;
  participants: Participant[];
};

export function requireSecretChatAccess(
  chat: SecretChatAccess | null,
  userId: string,
  sessionId: string,
  allowPending = false,
) {
  if (!chat || (chat.expiresAt && chat.expiresAt.getTime() <= Date.now())) {
    throw new HttpError(404, "Секретный чат не найден");
  }
  const participant = chat.participants.find((p) => p.userId === userId);
  if (!participant) throw new HttpError(403, "Вы не являетесь участником этого чата");
  if (participant.acceptedSessionId && participant.acceptedSessionId !== sessionId) {
    throw new HttpError(403, "Секретный чат доступен только в сессии, в которой он был принят");
  }
  if (chat.isApproved && (!participant.acceptedSessionId || !chat.expiresAt)) {
    throw new HttpError(403, "Секретный чат недоступен в этой сессии");
  }
  if (!allowPending && !chat.isApproved) {
    throw new HttpError(409, "Ожидаем одобрения запроса");
  }
  return participant;
}
