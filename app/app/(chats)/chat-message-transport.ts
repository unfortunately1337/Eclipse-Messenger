export const MEDIA_PREFIX = "__eclipse_media__:";
export const MAX_MEDIA_ALBUM_ITEMS = 6;
export const ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT = "Не удалось расшифровать сообщение";

export function deriveMusicLabel(url: string) {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const last = pathParts.at(-1) ?? "";
    const label = decodeURIComponent(last)
      .replace(/\.[^.]+$/u, "")
      .replace(/[_]+/g, " ")
      .trim();
    return label || "Музыка";
  } catch {
    return url.split("/").pop() ?? "Музыка";
  }
}

export function serializeMessageContent(text: string, image: string | null) {
  const trimmed = text.trim();
  if (image) {
    return `${MEDIA_PREFIX}${JSON.stringify({
      type: "image",
      src: image,
      caption: trimmed,
    })}`;
  }
  return trimmed;
}

export function serializePollContent(
  question: string,
  options: string[],
  quizMode: boolean,
  correctOptionIndex: number | null,
  expiresAt: string | null,
) {
  return `${MEDIA_PREFIX}${JSON.stringify({
    type: "poll",
    question,
    options,
    quizMode,
    correctOptionIndex,
    expiresAt,
  })}`;
}

export function serializeStoryReplyContent(
  text: string,
  target: {
    storyId: string;
    authorName: string;
    previewText?: string;
    isOwn?: boolean;
  },
) {
  return `${MEDIA_PREFIX}${JSON.stringify({
    type: "story_reply",
    storyId: target.storyId,
    authorName: target.authorName,
    previewText: target.previewText,
    isOwn: target.isOwn,
    text: text.trim(),
  })}`;
}

export function serializeStickerContent(src: string, options?: { source?: "greeting_button" | "picker"; emoji?: string }) {
  return `${MEDIA_PREFIX}${JSON.stringify({
    type: "sticker",
    src,
    emoji: options?.emoji,
    source: options?.source,
  })}`;
}

export function serializeVoiceContent(src: string, durationMs: number, waveform?: number[]) {
  const payload: {
    type: "voice";
    src: string;
    durationMs: number;
    waveform?: number[];
  } = {
    type: "voice",
    src,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
  if (waveform?.length) {
    payload.waveform = waveform;
  }
  return `${MEDIA_PREFIX}${JSON.stringify(payload)}`;
}

export function serializeVideoContent(src: string, durationMs: number, caption: string, mode: "note" | "file") {
  return `${MEDIA_PREFIX}${JSON.stringify({
    type: "video",
    src,
    durationMs: Math.max(0, Math.round(durationMs)),
    caption: caption.trim(),
    mode,
  })}`;
}

export function serializeAlbumContent(
  items: Array<{ src: string; kind: "image" | "video"; durationMs?: number }>,
  caption: string,
) {
  return `${MEDIA_PREFIX}${JSON.stringify({
    type: "album",
    items: items.slice(0, MAX_MEDIA_ALBUM_ITEMS).map((item) => ({
      src: item.src,
      kind: item.kind,
      durationMs: item.kind === "video" ? Math.max(0, Math.round(item.durationMs ?? 0)) : undefined,
    })),
    caption: caption.trim(),
  })}`;
}

export function serializeMusicContent(url: string, title: string, caption: string, metadata?: { author?: string; coverUrl?: string; durationMs?: number }) {
  return `${MEDIA_PREFIX}${JSON.stringify({
    type: "music",
    url: url.trim(),
    title: title.trim() || "Музыка",
    caption: caption.trim(),
    author: metadata?.author?.trim() || undefined,
    coverUrl: metadata?.coverUrl || undefined,
    durationMs: typeof metadata?.durationMs === "number" && Number.isFinite(metadata.durationMs)
      ? Math.max(0, Math.round(metadata.durationMs)) : undefined,
  })}`;
}

export function serializeFileContent(src: string, name: string, size: number, mimeType: string, caption: string) {
  return `${MEDIA_PREFIX}${JSON.stringify({
    type: "file",
    src,
    name: name.trim() || "Файл",
    size: Math.max(0, Math.round(size)),
    mimeType: mimeType.trim() || "application/octet-stream",
    caption: caption.trim(),
  })}`;
}
