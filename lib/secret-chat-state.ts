export const ACTIVE_SECRET_CHAT_NOTICE = "У вас уже есть активный секретный чат с этим пользователем";

export function hasActiveSecretChatWithPeer(chats: Array<{
  conversationId?: string | null;
  link?: string | null;
  peerId?: string | null;
  expiresAt?: string | null;
}>, peerId: string, now = Date.now()) {
  return chats.some(chat => chat.peerId === peerId
    && (chat.conversationId?.startsWith("secret:") || chat.link?.startsWith("secret-"))
    && (!chat.expiresAt || Date.parse(chat.expiresAt) > now));
}
