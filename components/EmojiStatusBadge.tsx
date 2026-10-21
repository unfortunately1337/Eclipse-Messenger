"use client";

import { useRef } from "react";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { useReducedMotion } from "framer-motion";
import { getEmojiStatus } from "@/lib/emoji-status";
import { EmojiStatusIcon } from "./EmojiStatusIcon";

export function EmojiStatusBadge({ id, size = 20 }: { id: string | null; size?: number }) {
  const entry = getEmojiStatus(id);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const playing = useAnimationVisibility(ref, Boolean(entry)) && !reduced;
  if (!entry) return null;
  return <span ref={ref} data-emoji-status-badge={entry.id} aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
    <EmojiStatusIcon entry={entry} animate={playing} size={size} renderer="preview" />
  </span>;
}
