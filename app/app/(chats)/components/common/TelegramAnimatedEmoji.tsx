import React, { memo, useState, useEffect, useRef } from "react";
import { markEmojiGifLoaded } from "@/lib/client/telegram-emoji-gifs";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { cn } from "@/lib/utils";

interface TelegramAnimatedEmojiProps {
  emoji: string;
  gifUrl: string;
  size: number;
  className?: string;
  renderStaticFallback: (text: string, options?: { size?: number; className?: string }) => React.ReactNode;
}

export const TelegramAnimatedEmoji = memo(function TelegramAnimatedEmoji({
  emoji,
  gifUrl,
  size,
  className,
  renderStaticFallback,
}: TelegramAnimatedEmojiProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const visible = useAnimationVisibility(hostRef);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loaded = loadedUrl === gifUrl;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [bouncing, setBouncing] = useState(false);
  const bounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (bounceTimer.current) clearTimeout(bounceTimer.current); }, []);

  useEffect(() => {
    if (imgRef.current && (imgRef.current.complete && imgRef.current.naturalWidth > 0)) {
      markEmojiGifLoaded(gifUrl);
      setLoadedUrl(gifUrl);
    }
  }, [gifUrl, visible]);

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bouncing) return;
    setBouncing(true);
    bounceTimer.current = setTimeout(() => setBouncing(false), 360);
  };

  return (
    <div
      ref={hostRef}
      onClick={handleTap}
      className={cn(
        "relative flex items-center justify-center select-none cursor-pointer group",
        "transition-transform duration-200 ease-out active:scale-90",
        className
      )}
      style={{
        width: size,
        height: size,
        transform: bouncing ? "scale(1.15)" : undefined,
        transition: bouncing
          ? "transform 0.36s cubic-bezier(0.34, 1.56, 0.64, 1)"
          : "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)",
      }}
    >
      {/* Static fallback layer: only shown while the GIF has not finished loading */}
      {(!visible || !loaded || failedUrl === gifUrl) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200">
          {renderStaticFallback(emoji, {
            size,
            className: "w-full h-full object-contain pointer-events-none select-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
          })}
        </div>
      )}

      {/* Telegram Animated GIF: iOS drop shadow and crisp scaling */}
      {visible && failedUrl !== gifUrl && <img
        ref={imgRef}
        src={gifUrl}
        alt={emoji}
        loading="eager"
        decoding="async"
        onError={() => setFailedUrl(gifUrl)}
        onLoad={() => {
          markEmojiGifLoaded(gifUrl);
          setLoadedUrl(gifUrl);
        }}
        className={cn(
          "h-full w-full object-contain pointer-events-none select-none transition-opacity duration-150",
          "drop-shadow-[0_4px_16px_rgba(0,0,0,0.16)] dark:drop-shadow-[0_6px_20px_rgba(0,0,0,0.38)]",
          loaded && failedUrl !== gifUrl ? "opacity-100" : "opacity-0"
        )}
      />}
    </div>
  );
});
