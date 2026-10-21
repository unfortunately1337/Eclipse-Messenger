"use client";
import { memo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { getEmojiStatus } from "@/lib/emoji-status";
import { getTelegramEmojiGifUrl } from "@/lib/client/telegram-emoji-gifs";
import assets from "@/lib/client/inline-emoji-assets.json";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { LottieSticker } from "@/app/app/(chats)/components/common/LottieSticker";

export const InlineEmoji = memo(function InlineEmoji({ emoji, id, size, className }: { emoji?: string; id?: string; size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useAnimationVisibility(ref);
  const reduced = useReducedMotion();
  const entry = id ? getEmojiStatus(id) : null;
  const filename = emoji ? getTelegramEmojiGifUrl(emoji)?.split("/").pop() : null;
  const asset = filename ? (assets as Record<string, {preview:string;still:string;large?:string;largeStill?:string}>)[filename] : null;
  const animate = visible && !reduced;
  const large = (size ?? 0) > 48;
  const src = animate ? entry?.preview ?? (large ? asset?.large ?? asset?.preview : asset?.preview) : entry?.thumbnail ?? (large ? asset?.largeStill ?? asset?.still : asset?.still);
  const [failed, setFailed] = useState<string | null>(null);
  const label = entry?.emoji ?? emoji ?? "";
  return <span ref={ref} data-inline-emoji={id ?? emoji} data-emoji-adaptive={entry?.adaptive || undefined} data-emoji-playing={animate || undefined} role="img" aria-label={label}
    className={`${className ?? "inline-block shrink-0 align-[-0.15em] mx-[0.025em]"} relative [&:has(svg)>img]:opacity-0`}
    style={{ width: size ?? "1.15em", height: size ?? "1.15em", verticalAlign: "-0.15em", lineHeight: 0 }}>
    {src && failed !== src ? <img src={src} alt="" draggable={false} loading="lazy" decoding="async" onError={()=>setFailed(src)} className="block size-full object-contain" style={{filter:entry?.adaptive ? "var(--inline-emoji-filter, brightness(0) invert(1))" : undefined}} />
      : <span className={animate ? "inline-block animate-emoji-idle" : "inline-block"} style={{lineHeight:1.15,fontSize:size}}>{label}</span>}
    {entry && large ? <LottieSticker src={entry.animation} playing={!reduced} className="absolute inset-0 size-full [&_svg]:!size-full" style={{filter:entry.adaptive ? "var(--inline-emoji-filter, brightness(0) invert(1))" : undefined}} /> : null}
  </span>;
});
