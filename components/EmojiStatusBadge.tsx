"use client";

import { useRef } from "react";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { useReducedMotion } from "framer-motion";
import { useEmojiEntry, openImportedPack } from "@/lib/client/pack-items";
import { EmojiStatusIcon } from "./EmojiStatusIcon";

export function EmojiStatusBadge({ id, size = 20 }: { id: string | null; size?: number }) {
  const entry = useEmojiEntry(id);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const playing = useAnimationVisibility(ref, Boolean(entry)) && !reduced;
  if (!entry) return null;
  const open = () => { if (entry.packId) openImportedPack({ packId: entry.packId }); };
  return <span ref={ref} data-emoji-status-badge={entry.id} role={entry.packId ? "button" : undefined} tabIndex={entry.packId ? 0 : undefined} aria-label={entry.packId ? entry.packTitle ?? entry.name : undefined}
    onClick={entry.packId ? event => { event.preventDefault(); event.stopPropagation(); open(); } : undefined}
    onKeyDown={entry.packId ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); open(); } } : undefined}
    className={`inline-flex shrink-0 items-center justify-center ${entry.packId ? "cursor-pointer rounded-full focus-visible:outline focus-visible:outline-white/50" : ""}`}>
    <EmojiStatusIcon entry={entry} animate={playing} size={size} renderer="preview" />
  </span>;
}
