"use client";
import { memo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { LottieSticker } from "@/app/app/(chats)/components/common/LottieSticker";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { importedItemIdFromSrc, type PackItem } from "@/lib/imported-packs";
import { openImportedPack, resolvePackItem } from "@/lib/client/pack-items";
import { useEffect, useState } from "react";

export const PackMedia = memo(function PackMedia({ item, className = "size-full", playing = true, interactive = false, vector = false }: {
  item: Pick<PackItem, "id" | "packId" | "src" | "thumbnail" | "format" | "emoji" | "adaptive">;
  className?: string; playing?: boolean; interactive?: boolean; vector?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const visible = useAnimationVisibility(ref);
  const animate = visible && playing && !reduced;
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (animate) void video.current?.play().catch(() => {}); else video.current?.pause(); }, [animate]);
  return <span ref={ref} className={`relative inline-block shrink-0 overflow-hidden align-middle [&:has(canvas)>img]:opacity-0 [&:has(svg)>img]:opacity-0 ${className}`} style={{ filter: item.adaptive ? "var(--inline-emoji-filter, brightness(0) invert(1))" : undefined }}
    onClick={interactive ? event => { event.stopPropagation(); openImportedPack({ packId: item.packId }); } : undefined}>
    {item.format === "tgs" ? <>
      <img src={item.thumbnail} alt={item.emoji} draggable={false} className="absolute inset-0 size-full object-contain" />
      <LottieSticker src={item.src} renderer={vector ? "svg" : "canvas"} playing={animate} deferUntilPlaying className="absolute inset-0 size-full" />
    </> : item.format === "webm" ? <video ref={video} src={item.src} poster={item.thumbnail} muted loop playsInline autoPlay={animate} preload="none" className="block size-full object-contain" />
      : <img src={item.src} alt={item.emoji} draggable={false} loading="lazy" decoding="async" className="block size-full object-contain" />}
  </span>;
});
export function ImportedSticker({ src, className }: { src: string; className?: string }) {
  const id = importedItemIdFromSrc(src), [item, setItem] = useState<PackItem | null>(null);
  useEffect(() => { let live = true; if (id) void resolvePackItem(id).then(value => { if (live) setItem(value); }); return () => { live = false; }; }, [id]);
  if (!item) return <span className={`inline-block ${className ?? ""}`} />;
  return <PackMedia item={item} className={className} interactive />;
}
