"use client";

import { useRef } from "react";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { useReducedMotion } from "framer-motion";
import { useEmojiEntry, openImportedPack } from "@/lib/client/pack-items";
import { EmojiStatusIcon } from "./EmojiStatusIcon";

export function EmojiStatusBadge({ id, size = 20, interactive = true }: { id: string | null; size?: number; interactive?: boolean }) {
  const entry = useEmojiEntry(id);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const playing = useAnimationVisibility(ref, Boolean(entry)) && !reduced;
  if (!entry) return null;
  const canOpen = interactive && Boolean(entry.packId);
  const open = () => { if (entry.packId) openImportedPack({ packId: entry.packId }); };
  return <span ref={ref} data-emoji-status-badge={entry.id} role={canOpen ? "button" : undefined} tabIndex={canOpen ? 0 : undefined} aria-label={canOpen ? entry.packTitle ?? entry.name : undefined}
    onClick={canOpen ? event => { event.preventDefault(); event.stopPropagation(); open(); } : undefined}
    onKeyDown={canOpen ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); open(); } } : undefined}
    className={`inline-flex shrink-0 items-center justify-center ${canOpen ? "cursor-pointer rounded-full focus-visible:outline focus-visible:outline-white/50" : ""}`}>
    <EmojiStatusIcon entry={entry} animate={playing} size={size} renderer="preview" />
  </span>;
}
