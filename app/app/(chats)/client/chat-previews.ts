"use client";

import { dateLocale, translate as t } from "@/lib/i18n/translate";
import { readForwardedContent } from "@/lib/client/message-forwarding";
import { getStickerEmojiBySrc } from "@/lib/client/stickers";
import { type ChatSummary, type ChatListPreviewMeta } from "../types";
import { ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT, MEDIA_PREFIX } from "../chat-message-transport";
import { buildChatSummaryKey, deduplicateChatSummaries, parseChatTimestamp, sortChatSummariesByLastMessageAt } from "../chat-realtime-chatlist";
import { normalizeLastMessagePreview, normalizeMojibakeTokens, parseMessageContentCached } from "./message-content";
import { NORMALIZED_PREVIEW_CACHE_MAX, CHAT_LIST_PREVIEW_META_CACHE_MAX } from "./config";

export const normalizedPreviewCache = new Map<string, string>();

/** Sidebar labels are presentation only. Retain attachment metadata when a
 * realtime event updates a summary, so unopened chats can show its thumbnail. */
export function retainChatPreviewContent(value: string) {
  const content = readForwardedContent(value)?.content ?? value;
  if (content.trim().startsWith(MEDIA_PREFIX) && parseMessageContentCached(content, false).kind !== "text") return value;
  return normalizeLastMessagePreviewCached(value);
}

export function normalizeLastMessagePreviewCached(value: string) {
  const key = value || "";
  const cacheKey = `${dateLocale()}|${key}`;
  if (key.length > 1024) {
    return normalizeLastMessagePreview(key);
  }
  const cached = normalizedPreviewCache.get(cacheKey);
  if (cached) return cached;
  const normalized = normalizeLastMessagePreview(key);
  if (normalizedPreviewCache.size > NORMALIZED_PREVIEW_CACHE_MAX) {
    normalizedPreviewCache.clear();
  }
  normalizedPreviewCache.set(cacheKey, normalized);
  return normalized;
}

export const chatListPreviewMetaCache = new Map<string, ChatListPreviewMeta>();

export function resolveChatListPreviewMetaCached(input: unknown) {
  const key = typeof input === "string" ? input : (input && typeof input === "object" && "text" in input && typeof (input as any).text === "string" ? (input as any).text : "");
  const cacheKey = `${dateLocale()}|${key}`;
  const cached = chatListPreviewMetaCache.get(cacheKey);
  if (cached) return cached;
  const resolved = resolveChatListPreviewMeta(key);
  if (chatListPreviewMetaCache.size > CHAT_LIST_PREVIEW_META_CACHE_MAX) {
    chatListPreviewMetaCache.clear();
  }
  chatListPreviewMetaCache.set(cacheKey, resolved);
  return resolved;
}

export function isSharedChat(chat: ChatSummary) {
  return chat.chatType === "group" || chat.chatType === "channel";
}

export function hasEncryptedPreview(chat: ChatSummary) {
  if (chat.chatType === "direct" || chat.chatType === "saved" || chat.chatType === "eclipse" || !chat.chatType) {
    return Boolean(chat.lastMessageCipherText && chat.lastMessageIv && chat.lastMessageEncryptedKey);
  }
  if (isSharedChat(chat)) {
    return Boolean(
      chat.lastMessageCipherText &&
      chat.lastMessageIv &&
      typeof chat.lastMessageKeyVersion === "number" &&
      Number.isFinite(chat.lastMessageKeyVersion),
    );
  }
  return false;
}

export function resolveSharedChatIdFromSummary(chat: ChatSummary) {
  if (!isSharedChat(chat)) return null;
  const prefix = chat.chatType === "group" ? "group:" : "channel:";
  if (chat.conversationId?.startsWith(prefix)) {
    return chat.conversationId.slice(prefix.length);
  }
  return null;
}

export function normalizeChatSummaryPreview(chat: ChatSummary) {
  if (!hasEncryptedPreview(chat)) {
    return {
      ...chat,
      lastMessage: chat.lastMessage || "",
    };
  }
  return {
    ...chat,
    lastMessage: "Сообщение",
  };
}

export function shouldKeepDecryptedPreview(prev: ChatSummary | undefined, next: ChatSummary) {
  if (!prev) return false;
  if (!hasEncryptedPreview(next)) return false;
  const isNextFallback = next.lastMessage === "Сообщение" || next.lastMessage === ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT;
  if (!isNextFallback) return false;
  if (prev.lastMessageAt !== next.lastMessageAt) return false;
  const isPrevFallback = !prev.lastMessage || prev.lastMessage === "Сообщение" || prev.lastMessage === ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT;
  if (isPrevFallback) return false;
  const previousPreview = resolveChatListPreviewMeta(prev.lastMessage);
  if (["image", "video", "video_note", "album"].includes(previousPreview.kind) && !previousPreview.thumbUrl) return false;
  return true;
}

export function mergeIncomingChatSummaries(
  prevChats: ChatSummary[],
  incomingChats: ChatSummary[],
  options?: { isFullReplace?: boolean },
) {
  const prevByKey = new Map<string, ChatSummary>();
  const prevByLink = new Map<string, ChatSummary>();

  for (const chat of prevChats) {
    const key = buildChatSummaryKey(chat);
    prevByKey.set(key, chat);
    if (chat.link) {
      prevByLink.set(`${chat.chatType ?? "direct"}:${chat.link}`, chat);
    }
  }

  const incomingKeys = new Set<string>();
  const incomingLinks = new Set<string>();
  for (const chat of incomingChats) {
    incomingKeys.add(buildChatSummaryKey(chat));
    if (chat.link) {
      incomingLinks.add(`${chat.chatType ?? "direct"}:${chat.link}`);
    }
  }

  const mergedIncoming = incomingChats.map((chat) => {
    const key = buildChatSummaryKey(chat);
    const prev = prevByKey.get(key) || (chat.link ? prevByLink.get(`${chat.chatType ?? "direct"}:${chat.link}`) : undefined);
    if (!prev) return chat;
    const keepDecrypted = shouldKeepDecryptedPreview(prev, chat);
    const keepLocalNewest = parseChatTimestamp(prev.lastMessageAt) > parseChatTimestamp(chat.lastMessageAt);
    if (!keepDecrypted && !keepLocalNewest) return chat;
    if (keepLocalNewest) {
      return {
        ...chat,
        lastMessage: prev.lastMessage,
        lastMessageAt: prev.lastMessageAt,
        lastMessageMine: prev.lastMessageMine,
        lastMessageCipherText: prev.lastMessageCipherText ?? chat.lastMessageCipherText ?? null,
        lastMessageIv: prev.lastMessageIv ?? chat.lastMessageIv ?? null,
        lastMessageEncryptedKey: prev.lastMessageEncryptedKey ?? chat.lastMessageEncryptedKey ?? null,
        lastMessageKeyVersion: prev.lastMessageKeyVersion ?? chat.lastMessageKeyVersion ?? null,
        lastMessageSenderId: prev.lastMessageSenderId ?? chat.lastMessageSenderId ?? null,
        lastMessageSenderAlias: prev.lastMessageSenderAlias ?? chat.lastMessageSenderAlias ?? null,
      };
    }
    return {
      ...chat,
      lastMessage: prev.lastMessage,
    };
  });

  const localOnly = prevChats.filter((chat) => {
    const key = buildChatSummaryKey(chat);
    const linkKey = chat.link ? `${chat.chatType ?? "direct"}:${chat.link}` : "";
    if (incomingKeys.has(key)) return false;
    if (linkKey && incomingLinks.has(linkKey)) return false;
    // Direct chats without messages must never be kept in local state
    if (
      (chat.chatType ?? "direct") === "direct" &&
      !chat.lastMessage &&
      !chat.lastMessageCipherText &&
      !(chat as any).lastMessageText
    ) {
      return false;
    }
    // When doing a full replace from server (e.g. initial bootstrap or mode: "replace"),
    // never retain normal chats from previous state/accounts. Only keep active secret chats
    // and pending optimistic temporary chats with content.
    if (options?.isFullReplace) {
      const isSecret = chat.link?.startsWith("secret-") || chat.conversationId?.startsWith("secret:");
      const isPending = Boolean(chat.isTemporary) && Boolean(chat.lastMessage || chat.lastMessageCipherText);
      return isSecret || isPending;
    }
    return true;
  });

  return sortChatSummariesByLastMessageAt(deduplicateChatSummaries([...mergedIncoming, ...localOnly]));
}

export function fallbackPreviewTextByKind(kind: ChatListPreviewMeta["kind"]) {
  if (kind === "image") return t("Фотография");
  if (kind === "album") return t("Альбом");
  if (kind === "music") return t("Музыка");
  if (kind === "video") return t("Видео");
  if (kind === "video_note") return t("Видеосообщение");
  if (kind === "voice") return t("Голосовое сообщение");
  if (kind === "sticker") return t("Стикер");
  if (kind === "file") return t("Файл");
  if (kind === "poll") return t("Опрос");
  return t("Сообщение");
}

export function resolveChatListPreviewMeta(input: unknown): ChatListPreviewMeta {
  const textInput = typeof input === "string" ? input : (input && typeof input === "object" && "text" in input && typeof (input as any).text === "string" ? (input as any).text : "");
  const raw = normalizeMojibakeTokens((readForwardedContent(textInput.trim())?.content ?? textInput).trim());
  if (!raw) return { kind: "text", text: "" };

  let authorPrefix = "";
  let body = raw;
  const mediaLabelPrefixes = ["Фото:", "Музыка:", "Видео:", "Файл:", "📊 Опрос:", "Опрос:", "Викторина:"];
  const sepIndex = raw.indexOf(": ");
  if (sepIndex > 0 && sepIndex < 48) {
    const maybePrefix = raw.slice(0, sepIndex + 1);
    const isMediaLabel = mediaLabelPrefixes.some((p) => raw.startsWith(p));
    if (!isMediaLabel) {
      authorPrefix = `${maybePrefix} `;
      body = raw.slice(sepIndex + 2).trim();
    }
  }

  body = readForwardedContent(body)?.content ?? body;
  const parsedBody = body.startsWith(MEDIA_PREFIX) ? parseMessageContentCached(body, false) : null;
  const previewThumb = (src?: string | null) => {
    if (!src) return null;
    // Keep the source even before decryption. The row can use its embedded
    // poster immediately, or resolve a legacy attachment when it becomes visible.
    return src;
  };
  if (parsedBody) {
    if (parsedBody.kind === "image") {
      const caption = (parsedBody.caption || "").trim();
      return {
        kind: "image",
        text: caption ? `${authorPrefix}${caption}`.trim() : t("{0}Фотография", { 0: authorPrefix }).trim(),
        thumbUrl: previewThumb(parsedBody.src),
        thumbPreview: parsedBody.preview,
        thumbKind: "image",
      };
    }
    if (parsedBody.kind === "album") {
      const caption = (parsedBody.caption || "").trim();
      const firstThumb = parsedBody.items[0]?.src ?? null;
      return {
        kind: "album",
        text: caption ? `${authorPrefix}${caption}`.trim() : t("{0}Альбом", { 0: authorPrefix }).trim(),
        thumbUrl: previewThumb(firstThumb),
        thumbPreview: parsedBody.items[0]?.preview,
        thumbKind: parsedBody.items[0]?.kind,
      };
    }
    if (parsedBody.kind === "music") {
      return { kind: "music", text: `${authorPrefix}${parsedBody.caption || parsedBody.title || t("Музыка")}`.trim() };
    }
    if (parsedBody.kind === "video") {
      if (parsedBody.mode === "note") {
        return {
          kind: "video_note",
          text: t("{0}Видеосообщение", { 0: authorPrefix }).trim(),
          thumbUrl: previewThumb(parsedBody.src),
          thumbPreview: parsedBody.preview,
          thumbKind: "video",
        };
      }
      const caption = (parsedBody.caption || "").trim();
      return {
        kind: "video",
        text: caption ? `${authorPrefix}${caption}`.trim() : t("{0}Видео", { 0: authorPrefix }).trim(),
        thumbUrl: previewThumb(parsedBody.src),
        thumbPreview: parsedBody.preview,
        thumbKind: "video",
      };
    }
    if (parsedBody.kind === "voice") {
      return { kind: "voice", text: t("{0}Голосовое сообщение", { 0: authorPrefix }).trim() };
    }
    if (parsedBody.kind === "file") {
      const label = (parsedBody.caption || "").trim() || parsedBody.name || t("Файл");
      return { kind: "file", text: `${authorPrefix}${label}`.trim() };
    }
    if (parsedBody.kind === "poll") {
      return { kind: "poll", text: `${authorPrefix}${parsedBody.question}`.trim() };
    }
    if (parsedBody.kind === "sticker") {
      const emoji = ("emoji" in parsedBody && parsedBody.emoji) || getStickerEmojiBySrc(parsedBody.src);
      const stickerText = emoji ? t("{0} Стикер", { 0: emoji }) : t("Стикер");
      return { kind: "sticker", text: `${authorPrefix}${stickerText}`.trim(), thumbUrl: null };
    }
    return { kind: "text", text: `${authorPrefix}${"text" in parsedBody ? parsedBody.text : ""}`.trim() };
  }

  // Handle plain text representations of poll media
  if (body.startsWith("📊 Опрос:") || body.startsWith("Опрос:") || body.startsWith("Викторина:")) {
    let question = "";
    const isQuiz = body.startsWith("Викторина:");
    if (body.startsWith("📊 Опрос:")) {
      question = body.slice("📊 Опрос:".length).trim();
    } else if (body.startsWith("Опрос:")) {
      question = body.slice("Опрос:".length).trim();
    } else {
      question = body.slice("Викторина:".length).trim();
    }
    return { kind: "poll", text: `${authorPrefix}${question}`.trim() };
  }

  if (body.startsWith("Фото:") || body.startsWith("Фото:")) {
    const caption = body.slice(body.startsWith("Фото:") ? "Фото:".length : "Фото:".length).trim();
    if (!caption) {
      return { kind: "image", text: t("{0}Фото", { 0: authorPrefix }).trim() };
    }
    return { kind: "image", text: `${authorPrefix}${caption}`.trim() };
  }
  if (["Фото", "Фотография", "Photo"].includes(body)) {
    return { kind: "image", text: t("{0}Фото", { 0: authorPrefix }).trim() };
  }
  if (/^Альбом(?:\s*\(\d+\))?$/i.test(body)) {
    return { kind: "album", text: t("{0}Медиаальбом", { 0: authorPrefix }).trim() };
  }
  if (["Фотоальбом", "Видеоальбом", "Медиаальбом", "Photo album", "Video album", "Media album"].includes(body)) {
    return { kind: "album", text: `${authorPrefix}${t(body)}`.trim() };
  }
  if (body.startsWith("Видео:") || body.startsWith("Видео:")) {
    const caption = body.slice(body.startsWith("Видео:") ? "Видео:".length : "Видео:".length).trim();
    return { kind: "video", text: `${authorPrefix}${caption || t("Видео")}`.trim() };
  }
  if (body.startsWith("Музыка:") || body.startsWith("Музыка:")) {
    const caption = body.slice(body.startsWith("Музыка:") ? "Музыка:".length : "Музыка:".length).trim();
    return { kind: "music", text: `${authorPrefix}${caption}`.trim() };
  }
  if (body.startsWith("Файл:")) {
    const caption = body.slice("Файл:".length).trim();
    return { kind: "file", text: `${authorPrefix}${caption || t("Файл")}`.trim() };
  }
  if (body === "Музыка" || body === "Музыка") {
    return { kind: "music", text: t("{0}Музыка", { 0: authorPrefix }).trim() };
  }
  if (
    body === "Видеокружок" ||
    body === "Видеосообщение" ||
    body === "Video note" ||
    body === "Video message"
  ) {
    return { kind: "video_note", text: t("{0}Видеокружок", { 0: authorPrefix }).trim() };
  }
  if (body === "Видео" || body === "Video") {
    return { kind: "video", text: t("{0}Видео", { 0: authorPrefix }).trim() };
  }
  if (
    body === "Голосовое" ||
    body === "Голосовое сообщение" ||
    body === "Голосовое" ||
    body === "Голосовое сообщение"
  ) {
    return { kind: "voice", text: t("{0}Голосовое сообщение", { 0: authorPrefix }).trim() };
  }
  if (/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|[\u{1F300}-\u{1F9FF}]|\S)?\s*Стикер$/u.test(body) || body === "Стикер") {
    return { kind: "sticker", text: `${authorPrefix}${body.replace(/Стикер$/, t("Стикер"))}`.trim() };
  }

  return { kind: "text", text: raw };
}
