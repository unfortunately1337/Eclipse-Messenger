type ActiveConversationLike = {
  chatType?: "direct" | "group" | "channel" | "saved" | "eclipse";
  group?: { link: string };
  channel?: { link: string };
};

type MessageLike<TReactions = unknown> = {
  id: string;
  reactions?: TReactions;
};

export function matchesRealtimeConversation(
  active: ActiveConversationLike | null,
  chatType: "direct" | "group" | "channel" | "saved" | "eclipse" | undefined,
  groupLink?: string,
): boolean {
  if (chatType === "group") {
    if (active?.chatType !== "group") return false;
    if (groupLink && active.group?.link !== groupLink) return false;
    return true;
  }

  if (chatType === "channel") {
    if (active?.chatType !== "channel") return false;
    if (groupLink && active.channel?.link !== groupLink) return false;
    return true;
  }

  if (chatType === "saved") {
    return active?.chatType === "saved";
  }

  if (chatType === "eclipse") {
    return active?.chatType === "eclipse";
  }

  return !active?.chatType || active.chatType === "direct";
}

export function applyMessageReactionUpdate<T extends MessageLike<TReactions>, TReactions>(
  messages: T[],
  messageId: string,
  reactions: TReactions,
): T[] {
  return messages.map((message) => (message.id === messageId ? { ...message, reactions } : message));
}

export function mergeReadMessageIds(prev: Set<string>, messageIds: string[]): Set<string> {
  const next = new Set(prev);
  messageIds.forEach((id) => next.add(id));
  return next;
}
