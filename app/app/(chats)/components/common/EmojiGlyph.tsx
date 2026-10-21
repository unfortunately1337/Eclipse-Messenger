import React, { memo, useState, useRef } from "react";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { getTelegramEmojiGifUrl, getTelegramEmojiPreviewUrl } from "@/lib/client/telegram-emoji-gifs";

export const EmojiGlyph = memo(function EmojiGlyph({ emoji, size, animated = false, lazyAnimation = false }: { emoji: string; size: number; animated?: boolean; lazyAnimation?: boolean }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const visible = useAnimationVisibility(hostRef, animated);
  const gifUrl = animated ? (lazyAnimation ? getTelegramEmojiPreviewUrl(emoji) : getTelegramEmojiGifUrl(emoji)) : null;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showAnimation = Boolean(gifUrl && failedUrl !== gifUrl && visible);
  const ready = showAnimation && loadedUrl === gifUrl;
  return <span ref={hostRef} className="relative inline-flex shrink-0 items-center justify-center align-middle" style={{ width: size, height: size }}>
    {!ready && <span role="img" aria-label={emoji} style={{fontSize:size*.85,lineHeight:1}}>{emoji}</span>}
    {showAnimation && <img src={gifUrl!} alt={ready ? emoji : ""} aria-hidden={!ready} draggable={false} loading="lazy" decoding="async"
      onLoad={() => setLoadedUrl(gifUrl)} onError={() => setFailedUrl(gifUrl)}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" style={{ opacity: ready ? 1 : 0 }} />}
  </span>;
});
