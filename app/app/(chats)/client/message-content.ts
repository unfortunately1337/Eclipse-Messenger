"use client";

import { translate as t } from "@/lib/i18n/translate";
import { readForwardedContent } from "@/lib/client/message-forwarding";
import { readCallMessage } from "@/lib/call-history";
import { renderStaticEmojiText } from "@/components/StaticEmojiText";
import { splitCustomEmoji, emojiPlainText } from "@/lib/custom-emoji";
import { getStickerEmojiBySrc } from "@/lib/client/stickers";
import { resolveMessageMedia } from "@/lib/client/media-crypto";
import { type DecryptedMessage, type EditTarget, type ParsedMessageContent } from "../types";
import { normalizeMediaPreview, normalizeMediaAspectRatio } from "@/lib/media-preview";
import { isImagePayload, isAudioPayload, isVideoPayload, isRenderableMediaUrl } from "../helpers";
import { deriveMusicLabel, MAX_MEDIA_ALBUM_ITEMS, MEDIA_PREFIX, serializeMusicContent } from "../chat-message-transport";
import { getAlbumPreviewLabel } from "./message-format";
import { PARSED_MESSAGE_CACHE_MAX, MESSAGE_EDIT_WINDOW_MS } from "./config";

const emojiCandidate = /[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Extended_Pictographic}\u20E3]/u;
let graphemeSegmenter: Intl.Segmenter | undefined;
function messageSegmenter() { return graphemeSegmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" }); }

export function getEmojisInfo(text: string): { isOnly: boolean; count: number } {
  text = emojiPlainText(text);
  const trimmed = text.trim();
  if (!trimmed) return { isOnly: false, count: 0 };
  if (!emojiCandidate.test(trimmed)) return { isOnly: false, count: 0 };

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{3297}\u{3299}\u{303D}\u{2139}\u{24C2}\u{1F000}-\u{1F0FF}]/gu;

  try {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segments = messageSegmenter().segment(trimmed);
      const isEmojiRegex = /[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Extended_Pictographic}]/u;

      let count = 0;
      for (const segment of segments) {
        const seg = segment.segment;
        const isSpace = /^\s+$/.test(seg);
        if (isSpace) continue;

        const isBasicAscii = /^[a-zA-Z0-9\s.,!?;:"'()\-+=_@#$*%^&|<>{}[\]~`\\/]+$/.test(seg);
        const isEmoji = /^[#*0-9]\uFE0F?\u20E3$/u.test(seg) || ((!isBasicAscii || seg.includes("\uFE0F") || seg.includes("\u20E3")) && isEmojiRegex.test(seg));

        if (isEmoji) {
          count++;
        } else {
          return { isOnly: false, count: 0 };
        }
      }
      return { isOnly: count > 0, count };
    }
  } catch { }

  const stripped = trimmed.replace(/\s+/g, "");
  if (stripped.length === 0) return { isOnly: false, count: 0 };
  const matches = stripped.match(emojiRegex) || [];
  const noEmojis = stripped.replace(emojiRegex, "");
  return { isOnly: noEmojis.length === 0 && matches.length > 0, count: matches.length };
}

export function getEmojisList(text: string): string[] {
  return splitCustomEmoji(text).flatMap(part => part.id ? [part.text] : Array.from(messageSegmenter().segment(part.text), segment => segment.segment).filter(value => value.trim()));
}

export const renderTextWithEmojis = renderStaticEmojiText;

export function parseMessageContent(value: string): ParsedMessageContent {
  value = readForwardedContent(value)?.content ?? value;
  if (!value) return { kind: "text", text: "" };

  if (value.startsWith(MEDIA_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(MEDIA_PREFIX.length)) as {
        type?: string;
        text?: string;
        src?: string;
        latitude?: number;
        longitude?: number;
        label?: string;
        mapUrl?: string;
        previewUrl?: string;
        items?: Array<{ src?: string; kind?: "image" | "video"; durationMs?: number; preview?: string }>;
        preview?: string;
        aspectRatio?: number;
        url?: string;
        name?: string;
        size?: number;
        mimeType?: string;
        title?: string;
        author?: string;
        coverUrl?: string;
        caption?: string;
        mode?: "note" | "file";
        source?: "greeting_button" | "picker";
        durationMs?: number;
        waveform?: number[];
        storyId?: string;
        authorName?: string;
        previewText?: string;
        isOwn?: boolean;
        question?: string;
        options?: string[];
        quizMode?: boolean;
        correctOptionIndex?: number | null;
        expiresAt?: string | null;
      };
      if (parsed.type === "story_reply") {
        return {
          kind: "story_reply",
          text: parsed.text?.trim() ?? "",
          authorName: parsed.authorName?.trim() || "История",
          storyId: parsed.storyId?.trim() || undefined,
          previewText: parsed.previewText?.trim() || undefined,
          isOwn: Boolean(parsed.isOwn),
        };
      }
      if (parsed.type === "sticker" && parsed.src) {
        const rawEmoji = "emoji" in parsed && typeof parsed.emoji === "string" ? parsed.emoji : undefined;
        return {
          kind: "sticker",
          src: parsed.src,
          source: parsed.source,
          emoji: rawEmoji || getStickerEmojiBySrc(parsed.src),
        };
      }
      if (parsed.type === "image" && parsed.src && (isImagePayload(parsed.src) || isRenderableMediaUrl(parsed.src))) {
        return {
          kind: "image",
          src: parsed.src,
          caption: parsed.caption?.trim() ?? "",
          preview: normalizeMediaPreview(parsed.preview),
          aspectRatio: normalizeMediaAspectRatio(parsed.aspectRatio),
        };
      }
      if (
        parsed.type === "poll" &&
        typeof parsed.question === "string" &&
        Array.isArray(parsed.options)
      ) {
        return {
          kind: "poll",
          question: parsed.question,
          options: parsed.options,
          quizMode: Boolean(parsed.quizMode),
          correctOptionIndex: typeof parsed.correctOptionIndex === "number" ? parsed.correctOptionIndex : null,
          expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
        };
      }
      if (parsed.type === "album" && Array.isArray(parsed.items) && parsed.items.length > 0) {
        const items: Array<{ src: string; kind: "image" | "video"; durationMs?: number; preview?: string }> = parsed.items
          .slice(0, MAX_MEDIA_ALBUM_ITEMS)
          .map((item) => {
            if (!item?.src || !isRenderableMediaUrl(item.src)) return null;
            const kind = item.kind === "video" ? "video" : "image";
            if (kind === "video") {
              return {
                src: item.src,
                kind,
                durationMs: Math.max(0, Number(item.durationMs) || 0),
                preview: normalizeMediaPreview(item.preview),
              };
            }
            return {
              src: item.src,
              kind,
              preview: normalizeMediaPreview(item.preview),
            };
          })
          .filter(Boolean) as Array<{ src: string; kind: "image" | "video"; durationMs?: number }>;
        if (items.length > 0) {
          return {
            kind: "album",
            items,
            caption: parsed.caption?.trim() ?? "",
          };
        }
      }
      if (parsed.type === "voice" && parsed.src && (isAudioPayload(parsed.src) || isRenderableMediaUrl(parsed.src))) {
        const waveform = Array.isArray(parsed.waveform)
          ? parsed.waveform
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isFinite(value))
            .map((value: number) => Math.min(100, Math.max(0, Math.round(value))))
          : undefined;
        return {
          kind: "voice",
          src: parsed.src,
          durationMs: Math.max(0, Number(parsed.durationMs) || 0),
          waveform: waveform?.length ? waveform : undefined,
        };
      }
      if (parsed.type === "video" && parsed.src && (isVideoPayload(parsed.src) || isRenderableMediaUrl(parsed.src))) {
        return {
          kind: "video",
          src: parsed.src,
          preview: normalizeMediaPreview(parsed.preview),
          aspectRatio: normalizeMediaAspectRatio(parsed.aspectRatio),
          durationMs: Math.max(0, Number(parsed.durationMs) || 0),
          caption: parsed.caption?.trim() ?? "",
          mode: parsed.mode === "file" ? "file" : "note",
        };
      }
      if (parsed.type === "file" && parsed.src && isRenderableMediaUrl(parsed.src)) {
        const fallbackName = parsed.src.split("/").pop() || "Файл";
        return {
          kind: "file",
          src: parsed.src,
          name: (parsed.name?.trim() || fallbackName).slice(0, 180),
          size: Math.max(0, Number(parsed.size) || 0),
          mimeType: parsed.mimeType?.trim() || "application/octet-stream",
          caption: parsed.caption?.trim() ?? "",
        };
      }
      if (
        parsed.type === "music" &&
        parsed.url &&
        (isRenderableMediaUrl(parsed.url) || parsed.url.startsWith("data:audio/"))
      ) {
        const title = parsed.title?.trim() || deriveMusicLabel(parsed.url);
        const caption = parsed.caption?.trim() || "";
        const legacyLabel = parsed.label?.trim() || "";
        return {
          kind: "music",
          url: parsed.url,
          title,
          caption: caption || (legacyLabel && legacyLabel !== title ? legacyLabel : ""),
          author: typeof parsed.author === "string" ? parsed.author.trim().slice(0, 300) : undefined,
          coverUrl: typeof parsed.coverUrl === "string" && isRenderableMediaUrl(parsed.coverUrl) ? parsed.coverUrl : undefined,
          durationMs: typeof parsed.durationMs === "number" && Number.isFinite(parsed.durationMs) ? Math.max(0, parsed.durationMs) : undefined,
        };
      }
    } catch {
      const emojiInfo = getEmojisInfo(value);
      return {
        kind: "text",
        text: value,
        isSingleEmoji: emojiInfo.isOnly && emojiInfo.count === 1,
        isOnlyEmojis: emojiInfo.isOnly,
        emojiCount: emojiInfo.count
      };
    }
  }

  if (isImagePayload(value)) {
    return { kind: "image", src: value, caption: "" };
  }

  const emojiInfo = getEmojisInfo(value);
  return {
    kind: "text",
    text: value,
    isSingleEmoji: emojiInfo.isOnly && emojiInfo.count === 1,
    isOnlyEmojis: emojiInfo.isOnly,
    emojiCount: emojiInfo.count
  };
}

export const MOJIBAKE_TOKEN_FIXES: Array<[string, string]> = [
  ["Стикер", "Стикер"],
  ["Музыка", "Музыка"],
  ["Р¤РѕтРѕ", "Фото"],
  ["Голосовое сообщение", "Голосовое сообщение"],
  ["Голосовое", "Голосовое"],
  ["Видеосообщение", "Видеосообщение"],
  ["Р’РёРґРµРѕРєрСѓР¶РѕРє", "Видеокружок"],
  ["печатают", "печатают"],
  ["печатает", "печатает"],
  ["всети", "в сети"],
  ["в СЃРµтРё", "в сети"],
  ["—", "—"],
];

export let cp1251ReverseMapCache: Map<string, number> | null = null;

export function getCp1251ReverseMap() {
  if (cp1251ReverseMapCache) return cp1251ReverseMapCache;
  const map = new Map<string, number>();
  try {
    const decoder = new TextDecoder("windows-1251");
    for (let i = 0; i <= 255; i += 1) {
      map.set(decoder.decode(Uint8Array.of(i)), i);
    }
  } catch {
    for (let i = 0; i <= 0x7f; i += 1) {
      map.set(String.fromCharCode(i), i);
    }
  }
  cp1251ReverseMapCache = map;
  return map;
}

export function cp1251ByteFromChar(char: string): number | null {
  const map = getCp1251ReverseMap();
  const value = map.get(char);
  return value ?? null;
}

export function tryDecodeCp1251Mojibake(input: string) {
  if (!input) return input;
  const bytes: number[] = [];
  for (const char of input) {
    const cp = cp1251ByteFromChar(char);
    if (cp === null) return input;
    bytes.push(cp);
  }
  let decoded = "";
  try {
    decoded = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return input;
  }
  if (!decoded || decoded.includes("\uFFFD")) return input;

  const badPattern = /[\u0420\u0421][\u0410-\u042f\u0430-\u044f\u0401\u0451]/g;
  const originalBad = (input.match(badPattern) || []).length;
  const decodedBad = (decoded.match(badPattern) || []).length;
  const originalCyr = (input.match(/[\u0410-\u042f\u0430-\u044f\u0401\u0451]/g) || []).length;
  const decodedCyr = (decoded.match(/[\u0410-\u042f\u0430-\u044f\u0401\u0451]/g) || []).length;

  if (decodedBad < originalBad && decodedCyr >= originalCyr) {
    return decoded;
  }
  if (originalBad > 0 && decodedBad === 0 && decodedCyr > 0) {
    return decoded;
  }
  return input;
}

export function normalizeMojibakeTokens(input: string) {
  let value = tryDecodeCp1251Mojibake(input);
  for (const [broken, fixed] of MOJIBAKE_TOKEN_FIXES) {
    if (value.includes(broken)) {
      value = value.split(broken).join(fixed);
    }
  }
  return value;
}

export function normalizeLastMessagePreview(value: string) {
  const normalized = normalizeMojibakeTokens(value || "");
  const parsed = parseMessageContent(normalized);
  if (parsed.kind === "story_reply") {
    return parsed.text ? t("Ответ на историю: {0}", { 0: parsed.text }) : t("Ответ на историю");
  }
  if (parsed.kind === "sticker") {
    return t("Стикер");
  }
  if (parsed.kind === "image") {
    return parsed.caption ? t("Фотография: {0}", { 0: parsed.caption }) : t("Фотография");
  }
  if (parsed.kind === "poll") {
    return t("Опрос: {0}", { 0: parsed.question });
  }
  if (parsed.kind === "album") {
    return parsed.caption ? t("Альбом: {0}", { 0: parsed.caption }) : getAlbumPreviewLabel(parsed.items);
  }
  if (parsed.kind === "voice") {
    return t("Голосовое сообщение");
  }
  if (parsed.kind === "video") {
    if (parsed.mode === "file") {
      return parsed.caption ? t("Видео: {0}", { 0: parsed.caption }) : t("Видеозапись");
    }
    return t("Видеосообщение");
  }
  if (parsed.kind === "file") {
    return parsed.name ? (parsed.caption ? `${parsed.name} — ${parsed.caption}` : parsed.name) : t("Файл");
  }
  if (parsed.kind === "music") {
    return parsed.title ? (parsed.caption ? `${parsed.title} — ${parsed.caption}` : parsed.title) : t("Музыка");
  }
  const plainText = parsed.text || "";
  if (plainText.startsWith("📊 Опрос:") || plainText.startsWith("Опрос:") || plainText.startsWith("Викторина:")) {
    let question = "";
    if (plainText.startsWith("📊 Опрос:")) {
      question = plainText.slice("📊 Опрос:".length).trim();
    } else if (plainText.startsWith("Опрос:")) {
      question = plainText.slice("Опрос:".length).trim();
    } else {
      question = plainText.slice("Викторина:".length).trim();
    }
    return question;
  }

  return plainText;
}

export const parsedMessageCache = new Map<string, ParsedMessageContent>();

export function parseMessageContentCached(value: string, resolveMedia = true) {
  const key = value || "";
  if (key.length > 4096) {
    const parsed = parseMessageContent(key);
    return resolveMedia ? resolveMessageMedia(parsed) : parsed;
  }
  const cached = parsedMessageCache.get(key);
  if (cached) return resolveMedia ? resolveMessageMedia(cached) : cached;
  const parsed = parseMessageContent(key);
  if (parsedMessageCache.size > PARSED_MESSAGE_CACHE_MAX) {
    parsedMessageCache.clear();
  }
  parsedMessageCache.set(key, parsed);
  return resolveMedia ? resolveMessageMedia(parsed) : parsed;
}

export function getEditableTextFromParsed(parsed: ParsedMessageContent) {
  if (parsed.kind === "image") return parsed.caption;
  if (parsed.kind === "video") return parsed.caption;
  if (parsed.kind === "file") return parsed.caption;
  if (parsed.kind === "music") return parsed.caption;
  if (parsed.kind === "text") return parsed.text;
  return "";
}

export function buildEditedMessagePayload(target: EditTarget, draftText: string) {
  const caption = draftText.trim();
  if (target.kind === "text") {
    return caption;
  }
  if (target.kind === "image" && target.src) {
    return `${MEDIA_PREFIX}${JSON.stringify({
      type: "image",
      src: target.src,
      caption,
    })}`;
  }
  if (target.kind === "video" && target.src) {
    return `${MEDIA_PREFIX}${JSON.stringify({
      type: "video",
      src: target.src,
      durationMs: Math.max(0, Math.round(target.durationMs ?? 0)),
      caption,
      mode: target.mode === "note" ? "note" : "file",
    })}`;
  }
  if (target.kind === "music" && target.url) {
    return serializeMusicContent(target.url, target.title?.trim() || "Музыка", caption, target);
  }
  if (target.kind === "file" && target.src) {
    return `${MEDIA_PREFIX}${JSON.stringify({
      type: "file",
      src: target.src,
      name: target.name?.trim() || "Файл",
      size: Math.max(0, Math.round(target.size ?? 0)),
      mimeType: target.mimeType?.trim() || "application/octet-stream",
      caption,
    })}`;
  }
  return caption;
}

export function hasDetachedMessageAnnotations(parsed: ParsedMessageContent) {
  return parsed.kind === "sticker" || parsed.kind === "text" && parsed.isOnlyEmojis ||
    parsed.kind === "video" && (parsed.mode !== "file" || !parsed.caption) ||
    (parsed.kind === "image" || parsed.kind === "album") && !parsed.caption;
}

export function canEditMessageContent(parsed: ParsedMessageContent) {
  if (parsed.kind === "voice" || parsed.kind === "sticker") return false;
  if (parsed.kind === "video" && parsed.mode === "note") return false;
  return (
    parsed.kind === "text" ||
    parsed.kind === "image" ||
    parsed.kind === "video" ||
    parsed.kind === "file" ||
    parsed.kind === "music"
  );
}

export function canEditMessage(message: DecryptedMessage, parsed: ParsedMessageContent, isMine: boolean) {
  if (!isMine || readCallMessage(message.systemPayload)) return false;
  const createdAtMs = Date.parse(message.createdAt);
  if (Number.isNaN(createdAtMs) || Date.now() - createdAtMs > MESSAGE_EDIT_WINDOW_MS) {
    return false;
  }
  return canEditMessageContent(parsed);
}
