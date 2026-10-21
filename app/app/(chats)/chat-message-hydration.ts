import { apiRequest } from "@/lib/client/http";

type ExactDirectMessageResponse = {
  chatType?: "direct";
  messages: Array<{
    id: string;
    senderId: string;
    cipherText: string | null;
    iv: string | null;
    encryptedKey: string | null;
    replyToMessageId?: string | null;
    createdAt: string;
    isSystemMessage?: boolean;
    systemPayload?: any;
    reactions?: Array<{ emoji: string; count: number; reacted: boolean; avatarUrl?: string | null }>;
  }>;
};

type ExactGroupMessageResponse = {
  chatType?: "group";
  messages: Array<{
    id: string;
    senderId: string;
    text?: string | null;
    cipherText?: string | null;
    iv?: string | null;
    keyVersion?: number | null;
    replyToMessageId?: string | null;
    createdAt: string;
    senderDisplayName?: string;
    reactions?: Array<{ emoji: string; count: number; reacted: boolean; avatarUrl?: string | null }>;
  }>;
};

type ExactChannelMessageResponse = {
  chatType?: "channel";
  messages: Array<{
    id: string;
    senderId: string;
    text?: string | null;
    cipherText?: string | null;
    iv?: string | null;
    keyVersion?: number | null;
    replyToMessageId?: string | null;
    createdAt: string;
    viewsCount: string;
    reactions?: Array<{ emoji: string; count: number; reacted: boolean; avatarUrl?: string | null }>;
  }>;
};

export async function fetchExactDirectMessage(link: string, messageId: string) {
  const data = await apiRequest<ExactDirectMessageResponse>(
    `/api/chats/${encodeURIComponent(link)}?chatType=direct&messageId=${encodeURIComponent(messageId)}`,
    { method: "GET", cache: "no-store" },
  );
  if (data.chatType !== "direct") return null;
  return data.messages.find((message) => message.id === messageId) ?? null;
}

export async function fetchExactSharedMessage(chatType: "group" | "channel", link: string, messageId: string) {
  const data = await apiRequest<ExactGroupMessageResponse | ExactChannelMessageResponse>(
    `/api/chats/${encodeURIComponent(link)}?chatType=${chatType}&messageId=${encodeURIComponent(messageId)}`,
    { method: "GET", cache: "no-store" },
  );
  if (data.chatType !== chatType) return null;
  return data.messages.find((message) => message.id === messageId) ?? null;
}
