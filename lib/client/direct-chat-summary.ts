type ChatIdentity = {
  chatType?: string | null;
  link?: string | null;
  conversationId?: string | null;
  peerId?: string | null;
};

export function directChatProfileLink(chat: ChatIdentity & { link: string }, nextLink: string) {
  return chat.link.startsWith("secret-") || chat.conversationId?.startsWith("secret:") ? chat.link : nextLink || chat.link;
}

// A peer can have both a normal dialog and several independent secret chats.
export function matchesOrdinaryDirectChat(
  chat: ChatIdentity,
  target: { requestedLink: string; canonicalLink?: string | null; peerId?: string | null },
) {
  if ((chat.chatType ?? "direct") !== "direct" || chat.link?.startsWith("secret-") || chat.conversationId?.startsWith("secret:")) return false;
  return chat.link === target.requestedLink || Boolean(target.canonicalLink && chat.link === target.canonicalLink) || Boolean(target.peerId && chat.peerId === target.peerId);
}
