"use client";

import { LottieSticker } from "@/app/app/(chats)/components/common/LottieSticker";
import type { EmojiStatus } from "@/lib/emoji-status";
import { memo, useState } from "react";
import { PackMedia } from "./PackMedia";

function PreviewImage({ src, entry, size }: { src: string; entry: EmojiStatus; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden="true" className="flex size-full items-center justify-center" style={{ fontSize: size * .7 }}>{entry.emoji}</span>;
  return <img src={src} alt="" width={size} height={size} className="size-full object-contain" decoding="async" draggable={false} onError={() => setFailed(true)} />;
}

export const EmojiStatusIcon = memo(function EmojiStatusIcon({ entry, animate, size, renderer = "svg" }: { entry: EmojiStatus; animate: boolean; size: number; renderer?: "svg" | "canvas" | "preview" }) {
  if (entry.packId && entry.format) return <span style={{ width: size, height: size }} className="inline-block shrink-0"><PackMedia item={{ id: entry.id, packId: entry.packId, format: entry.format, src: entry.animation, thumbnail: entry.thumbnail, emoji: entry.emoji, adaptive: entry.adaptive }} playing={animate} /></span>;
  const previewSrc = animate && entry.preview ? entry.preview : entry.thumbnail;
  const style = { width: size, height: size, filter: entry.adaptive ? "brightness(0) invert(1)" : undefined };
  if (renderer === "preview") return <span data-animated={animate || undefined} className="inline-flex shrink-0" style={style}>
    <PreviewImage key={previewSrc} src={previewSrc} entry={entry} size={size} />
  </span>;
  return <span data-animated={animate || undefined} className="relative inline-flex shrink-0 items-center justify-center [&:has(svg)>img]:opacity-0 [&:has(canvas)>img]:opacity-0"
    style={style}>
    <img src={entry.thumbnail} alt="" width={size} height={size} className="size-full object-contain" decoding="async" draggable={false} />
    <LottieSticker src={entry.animation} renderer={renderer} playing={animate} deferUntilPlaying className="absolute inset-0 size-full" />
  </span>;
});
