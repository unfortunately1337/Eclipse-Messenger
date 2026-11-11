import React, { memo, useState, useRef } from "react";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import emojiMap from "@/public/emoji-map.json";
import { getTelegramEmojiGifUrl, getTelegramEmojiPreviewUrl } from "@/lib/client/telegram-emoji-gifs";

export const EmojiGlyph = memo(function EmojiGlyph({ emoji, size, animated = false, lazyAnimation = false }: { emoji: string; size: number; animated?: boolean; lazyAnimation?: boolean }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const visible = useAnimationVisibility(hostRef, animated);
  const map = emojiMap as Record<string, string>;
  const filename = map[emoji] || map[emoji + "\uFE0F"] || map[emoji.replace(/\uFE0F/g, "")];
  const staticUrl = filename
    ? `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${filename}`
    : `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=apple`;
  const gifUrl = animated ? (lazyAnimation ? getTelegramEmojiPreviewUrl(emoji) : getTelegramEmojiGifUrl(emoji)) : null;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showAnimation = Boolean(gifUrl && failedUrl !== gifUrl && visible);
  const ready = showAnimation && loadedUrl === gifUrl;
  return <span ref={hostRef} className="relative inline-flex shrink-0 items-center justify-center align-middle" style={{ width: size, height: size }}>
    {!ready && <img src={staticUrl} alt={emoji} draggable={false} loading="lazy" decoding="async"
      className="pointer-events-none h-full w-full select-none object-contain" />}
    {showAnimation && <img src={gifUrl!} alt={ready ? emoji : ""} aria-hidden={!ready} draggable={false} loading="lazy" decoding="async"
      onLoad={() => setLoadedUrl(gifUrl)} onError={() => setFailedUrl(gifUrl)}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" style={{ opacity: ready ? 1 : 0 }} />}
  </span>;
});
