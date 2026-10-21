import { deduplicateChatSummaries, shouldApplyChatPreviewByTimestamp, sortChatSummariesByLastMessageAt } from "./chat-realtime-chatlist";

type ChatSummaryLike = {
  chatType?: "direct" | "group" | "channel" | "saved" | "eclipse";
  conversationId: string;
  peerId: string;
  link: string;
  displayName: string;
  contactAlias?: string | null;
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
  peerReadAt?: string | null;
  unreadCount?: number;
  isGroupOwner?: boolean;
  systemPayload?: any;
};

type SharedIncomingPreviewParams = {
  link: string;
  createdAt: string;
  previewText: string;
  isOwnMessage: boolean;
  chatType: "group" | "channel";
  senderId: string;
  senderAlias?: string | null;
  cipherText?: string | null;
  iv?: string | null;
  keyVersion?: number | null;
};

type DirectIncomingPreviewParams = {
  id: string;
  link: string;
  createdAt: string;
  previewText: string;
  isOwnMessage: boolean;
  senderId: string;
  displayName: string;
  systemPayload?: any;
};

type SharedEditedPreviewParams = {
  link: string;
  createdAt: string;
  previewText: string;
  includeSenderPrefix: boolean;
  senderId: string;
  senderAlias?: string | null;
  cipherText?: string | null;
  iv?: string | null;
  keyVersion?: number | null;
};

type DirectEditedPreviewParams = {
  link: string;
  createdAt: string;
  previewText: string;
};

export function applyIncomingSharedChatPreview<T extends ChatSummaryLike>(
  chats: T[],
  params: SharedIncomingPreviewParams,
): T[] {
  let changed = false;
  const next = chats.map((chat) => {
    if (chat.link !== params.link) return chat;
    if (!shouldApplyChatPreviewByTimestamp(chat.lastMessageAt, params.createdAt)) {
      return chat;
    }
    changed = true;
    return {
      ...chat,
      lastMessage: params.previewText,
      lastMessageAt: params.createdAt,
      lastMessageMine: params.isOwnMessage,
      lastMessageCipherText: params.cipherText ?? null,
      lastMessageIv: params.iv ?? null,
      lastMessageKeyVersion: params.keyVersion ?? null,
      lastMessageSenderId: params.chatType === "group" ? params.senderId : chat.lastMessageSenderId ?? null,
      lastMessageSenderAlias:
        params.chatType === "group" ? (params.senderAlias ? params.senderAlias : chat.lastMessageSenderAlias ?? null) : null,
    };
  });

  return changed ? sortChatSummariesByLastMessageAt(next) : chats;
}

export function applyIncomingDirectChatPreview<T extends ChatSummaryLike>(
  chats: T[],
  params: DirectIncomingPreviewParams,
): T[] {
  const isMatchingDirectChat = (chat: ChatSummaryLike) => {
    const isDirect = (chat.chatType ?? "direct") === "direct" && !chat.link?.startsWith("secret-") && !chat.conversationId?.startsWith("secret:");
    if (!isDirect) return false;
    if (params.senderId && chat.peerId && chat.peerId === params.senderId) return true;
    return chat.link === params.link;
  };

  const existingIndex = chats.findIndex(isMatchingDirectChat);
  if (existingIndex >= 0) {
    const existing = chats[existingIndex];
    const shouldUpdatePreview = shouldApplyChatPreviewByTimestamp(existing.lastMessageAt, params.createdAt);
    const updated: T = {
      ...existing,
      link: params.link,
      displayName: existing.contactAlias?.trim() || params.displayName || existing.displayName,
      lastMessage: shouldUpdatePreview ? params.previewText : existing.lastMessage,
      lastMessageAt: shouldUpdatePreview ? params.createdAt : existing.lastMessageAt,
      lastMessageMine: shouldUpdatePreview ? params.isOwnMessage : existing.lastMessageMine,
      systemPayload: shouldUpdatePreview ? (params.systemPayload ?? null) : (existing.systemPayload ?? null),
    };
    const remaining = chats.filter((c, idx) => idx !== existingIndex && !isMatchingDirectChat(c));
    return sortChatSummariesByLastMessageAt(deduplicateChatSummaries([updated, ...remaining]));
  }

  const remaining = chats.filter((c) => !isMatchingDirectChat(c));
  const newChat = {
    chatType: "direct",
    conversationId: `realtime:${params.id}`,
    peerId: params.senderId,
    link: params.link,
    displayName: params.displayName,
    avatarUrl: null,
    lastMessage: params.previewText,
    lastMessageAt: params.createdAt,
    lastMessageMine: params.isOwnMessage,
    systemPayload: params.systemPayload ?? null,
  } as T;

  return sortChatSummariesByLastMessageAt(deduplicateChatSummaries([newChat, ...remaining]));
}

export function applyEditedSharedChatPreview<T extends ChatSummaryLike>(
  chats: T[],
  params: SharedEditedPreviewParams,
): T[] {
  return chats.map((chat) => {
    if (chat.link !== params.link || chat.lastMessageAt !== params.createdAt) {
      return chat;
    }

    return {
      ...chat,
      lastMessage:
        params.includeSenderPrefix && params.senderAlias ? `${params.senderAlias}: ${params.previewText}` : params.previewText,
      lastMessageCipherText: params.cipherText ?? chat.lastMessageCipherText ?? null,
      lastMessageIv: params.iv ?? chat.lastMessageIv ?? null,
      lastMessageKeyVersion: params.keyVersion ?? chat.lastMessageKeyVersion ?? null,
      lastMessageSenderId: params.includeSenderPrefix ? params.senderId : chat.lastMessageSenderId,
      lastMessageSenderAlias: params.includeSenderPrefix ? params.senderAlias || chat.lastMessageSenderAlias || null : chat.lastMessageSenderAlias,
    };
  });
}

export function applyEditedDirectChatPreview<T extends ChatSummaryLike>(
  chats: T[],
  params: DirectEditedPreviewParams,
): T[] {
  return chats.map((chat) =>
    chat.link === params.link && chat.lastMessageAt === params.createdAt
      ? { ...chat, lastMessage: params.previewText }
      : chat,
  );
}
