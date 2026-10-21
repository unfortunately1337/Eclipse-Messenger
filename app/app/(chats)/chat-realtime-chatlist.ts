type RealtimeChatListItem = {
  chatType?: "direct" | "group" | "channel" | "saved" | "eclipse";
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  avatarUrl?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  contactTag?: string | null;
  contactTagVariant?: "default" | "secondary" | "destructive" | "outline";
  lastMessageCipherText?: string | null;
  lastMessageIv?: string | null;
  lastMessageEncryptedKey?: string | null;
  lastMessageKeyVersion?: number | null;
  lastMessageSenderId?: string | null;
  lastMessageSenderAlias?: string | null;
};

const chatTimestampCache = new Map<string, number>();

export function parseChatTimestamp(value: string) {
  const cached = chatTimestampCache.get(value);
  if (cached !== undefined) return cached;
  const ts = Date.parse(value);
  const normalized = Number.isNaN(ts) ? 0 : ts;
  if (chatTimestampCache.size > 6000) {
    chatTimestampCache.clear();
  }
  chatTimestampCache.set(value, normalized);
  return normalized;
}

export function shouldApplyChatPreviewByTimestamp(
  currentLastMessageAt: string | null | undefined,
  incomingLastMessageAt: string,
) {
  if (!currentLastMessageAt) return true;
  return parseChatTimestamp(incomingLastMessageAt) >= parseChatTimestamp(currentLastMessageAt);
}

export function sortChatSummariesByLastMessageAt<T extends { lastMessageAt: string }>(items: T[]) {
  return [...items].sort((a, b) => parseChatTimestamp(b.lastMessageAt) - parseChatTimestamp(a.lastMessageAt));
}

export function buildChatSummaryKey(chat: {
  chatType?: string | null;
  link?: string | null;
  peerId?: string | null;
  conversationId?: string | null;
}): string {
  const link = chat.link || "";
  const conversationId = chat.conversationId || "";
  if (link.startsWith("secret-") || conversationId.startsWith("secret:")) {
    const id = conversationId.startsWith("secret:") ? conversationId.slice(7) : link.slice(7);
    return `secret:${id}`;
  }
  const type = chat.chatType ?? "direct";
  if (type === "saved" || link === "saved") {
    return "saved";
  }
  if (type === "eclipse" || link === "eclipse") {
    return "eclipse";
  }
  if (type === "direct") {
    if (chat.peerId) {
      return `direct:${chat.peerId}`;
    }
    return `direct:${link}`;
  }
  if (type === "group") {
    return `group:${chat.peerId || conversationId || link}`;
  }
  if (type === "channel") {
    return `channel:${chat.peerId || conversationId || link}`;
  }
  return `${type}:${link}`;
}

export function deduplicateChatSummaries<T extends {
  chatType?: "direct" | "group" | "channel" | "saved" | "eclipse" | string;
  conversationId?: string;
  peerId?: string;
  link: string;
  displayName?: string;
  contactAlias?: string | null;
  avatarUrl?: string | null;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount?: number;
}>(chats: T[]): T[] {
  if (!chats || chats.length === 0) return chats;

  const directByPeerId = new Map<string, T>();
  const directByLink = new Map<string, T>();
  const othersByKey = new Map<string, T>();

  for (const source of chats) {
    if (!source) continue;
    const chat = source.conversationId?.startsWith("secret:")
      ? { ...source, link: `secret-${source.conversationId.slice(7)}` }
      : source;
    const isSecret = chat.link?.startsWith("secret-") || chat.conversationId?.startsWith("secret:");
    const type = chat.chatType ?? "direct";

    if (type === "direct" && !isSecret) {
      const peerId = chat.peerId?.trim() || "";
      const normalizedLink = (chat.link || "").trim().toLowerCase();

      const existingByPeer = peerId ? directByPeerId.get(peerId) : undefined;
      const existingByLink = normalizedLink ? directByLink.get(normalizedLink) : undefined;
      const existing = existingByPeer || existingByLink;

      if (existing) {
        const existingTs = parseChatTimestamp(existing.lastMessageAt);
        const incomingTs = parseChatTimestamp(chat.lastMessageAt);
        const keepIncomingNewer = incomingTs > existingTs;
        const primary = keepIncomingNewer ? chat : existing;
        const secondary = keepIncomingNewer ? existing : chat;

        const merged: T = {
          ...secondary,
          ...primary,
          avatarUrl: primary.avatarUrl ?? secondary.avatarUrl ?? null,
          displayName: (primary.contactAlias === undefined ? secondary.contactAlias : primary.contactAlias)?.trim() || primary.displayName || secondary.displayName,
          unreadCount: Math.max(primary.unreadCount ?? 0, secondary.unreadCount ?? 0),
        };

        if (peerId) directByPeerId.set(peerId, merged);
        if (existing.peerId) directByPeerId.set(existing.peerId, merged);
        if (chat.peerId) directByPeerId.set(chat.peerId, merged);

        if (normalizedLink) directByLink.set(normalizedLink, merged);
        const existingLink = (existing.link || "").trim().toLowerCase();
        if (existingLink) directByLink.set(existingLink, merged);
        const primaryLink = (primary.link || "").trim().toLowerCase();
        if (primaryLink) directByLink.set(primaryLink, merged);
      } else {
        if (peerId) directByPeerId.set(peerId, chat);
        if (normalizedLink) directByLink.set(normalizedLink, chat);
      }
    } else {
      const key = buildChatSummaryKey(chat);
      const existing = othersByKey.get(key);
      if (existing) {
        const existingTs = parseChatTimestamp(existing.lastMessageAt);
        const incomingTs = parseChatTimestamp(chat.lastMessageAt);
        const keepIncomingNewer = incomingTs > existingTs;
        const primary = keepIncomingNewer ? chat : existing;
        const secondary = keepIncomingNewer ? existing : chat;

        const merged: T = {
          ...secondary,
          ...primary,
          avatarUrl: primary.avatarUrl ?? secondary.avatarUrl ?? null,
          displayName: (primary.contactAlias === undefined ? secondary.contactAlias : primary.contactAlias)?.trim() || primary.displayName || secondary.displayName,
          unreadCount: Math.max(primary.unreadCount ?? 0, secondary.unreadCount ?? 0),
        };
        othersByKey.set(key, merged);
      } else {
        othersByKey.set(key, chat);
      }
    }
  }

  const seenChats = new Set<T>();
  const result: T[] = [];

  for (const chat of chats) {
    if (!chat) continue;
    const isSecret = chat.link?.startsWith("secret-") || chat.conversationId?.startsWith("secret:");
    const type = chat.chatType ?? "direct";

    if (type === "direct" && !isSecret) {
      const peerId = chat.peerId?.trim() || "";
      const normalizedLink = (chat.link || "").trim().toLowerCase();
      const resolved =
        (peerId ? directByPeerId.get(peerId) : undefined) ||
        (normalizedLink ? directByLink.get(normalizedLink) : undefined) ||
        chat;
      if (!seenChats.has(resolved)) {
        seenChats.add(resolved);
        result.push(resolved);
      }
    } else {
      const key = buildChatSummaryKey(chat);
      const resolved = othersByKey.get(key) || chat;
      if (!seenChats.has(resolved)) {
        seenChats.add(resolved);
        result.push(resolved);
      }
    }
  }

  return result;
}

export function upsertRealtimeAddedChat(
  prev: RealtimeChatListItem[],
  payload: {
    type: "group" | "channel";
    id: string;
    link: string;
    name: string;
    avatarUrl?: string | null;
    createdAt: string;
    previewText?: string | null;
  },
) {
  const previewText = payload.previewText?.trim() || "Вы были добавлены.";
  const isMatchingItem = (chat: RealtimeChatListItem) => {
    if (chat.chatType !== payload.type) return false;
    if (chat.peerId && chat.peerId === payload.id) return true;
    if (chat.conversationId && chat.conversationId === `${payload.type}:${payload.id}`) return true;
    return chat.link === payload.link;
  };
  const existing = prev.find(isMatchingItem);
  const nextItem: RealtimeChatListItem = {
    chatType: payload.type,
    conversationId: `${payload.type}:${payload.id}`,
    peerId: payload.id,
    link: payload.link,
    displayName: payload.name,
    avatarUrl: payload.avatarUrl ?? null,
    lastMessage: previewText,
    lastMessageAt: payload.createdAt,
    lastMessageMine: false,
    contactTag: null,
    contactTagVariant: "outline",
    lastMessageCipherText: null,
    lastMessageIv: null,
    lastMessageEncryptedKey: null,
  };

  if (existing) {
    const updated = prev.map((chat) =>
      chat === existing
        ? {
            ...chat,
            displayName: payload.name,
            link: payload.link,
            avatarUrl: payload.avatarUrl ?? null,
            lastMessage: chat.lastMessage || previewText,
            lastMessageAt: chat.lastMessageAt || payload.createdAt,
          }
        : chat,
    );
    return sortChatSummariesByLastMessageAt(deduplicateChatSummaries(updated));
  }

  const remaining = prev.filter((c) => !isMatchingItem(c));
  return sortChatSummariesByLastMessageAt(deduplicateChatSummaries([nextItem, ...remaining]));
}
