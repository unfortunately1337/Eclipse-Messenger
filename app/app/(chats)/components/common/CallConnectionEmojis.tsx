"use client";

import { memo, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import emojiMap from "@/public/emoji-map.json";

const SYMBOLS = ["🐳", "🌈", "🍎", "🎸", "🦊", "🐼", "🌴", "🚀", "🧩", "🎲", "🦋", "🍋", "⭐", "🐬", "🌻", "🎈"];
const ROW = 28;

function shuffledSymbols(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  const values = [...SYMBOLS];
  for (let index = values.length - 1; index > 0; index--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const other = (state >>> 0) % (index + 1);
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

function SymbolImage({ value }: { value: string }) {
  const file = (emojiMap as Record<string, string>)[value];
  return <span className="grid h-7 w-full place-items-center text-[22px]">{file
    ? <img src={`https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${file}`} alt={value} loading="eager" decoding="async" draggable={false} className="size-[22px] select-none object-contain sm:size-6" />
    : value}</span>;
}

function EmojiReel({ values, index, startedAt }: { values: string[]; index: number; startedAt: number }) {
  const reduced = useReducedMotion();
  const duration = .65 + index * .23;
  const [elapsed] = useState(() => Math.max(0, (Date.now() - startedAt) / 1000));
  const [settled, setSettled] = useState(Boolean(reduced) || elapsed >= duration);
  const end = -(values.length - 1) * ROW;
  if (settled) return <div data-call-emoji-settled className="h-7"><SymbolImage value={values[values.length - 1]} /></div>;
  return <div className="h-7 overflow-hidden">
    <motion.div initial={{ y: end * Math.min(.98, elapsed / duration) }} animate={{ y: end }}
      transition={{ duration: Math.max(0, duration - elapsed), ease: [.12, .64, .16, 1] }}
      onAnimationComplete={() => setSettled(true)} style={{ willChange: "transform" }}>
      {values.map((value, row) => <SymbolImage key={row} value={value} />)}
    </motion.div>
  </div>;
}

/** A connection animation; these decorative symbols are not an encryption verification code. */
export const CallConnectionEmojis = memo(function CallConnectionEmojis({ callId, startedAt, glass }: { callId: string; startedAt: number; glass: boolean }) {
  const reels = useMemo(() => {
    const selected = shuffledSymbols(callId).slice(0, 4);
    return selected.map((value, index) => [...shuffledSymbols(`${callId}:${index}`).slice(0, 11), value]);
  }, [callId]);
  return <div data-call-emoji-panel data-visual={glass ? "glass" : "plain"} aria-hidden="true"
    className="grid h-10 w-[120px] shrink-0 grid-cols-4 items-center gap-1 rounded-full px-2 min-[360px]:w-[128px] sm:w-[144px] sm:px-2.5"
    style={glass ? {
      backgroundColor: "rgba(40,40,44,0.32)",
      backdropFilter: "blur(18px) saturate(1.2)",
      WebkitBackdropFilter: "blur(18px) saturate(1.2)",
      boxShadow: "0 4px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.13), inset 0 0 0 1px rgba(255,255,255,0.045)",
    } : { backgroundColor: "#252527" }}>
    {reels.map((values, index) => <EmojiReel key={`${callId}:${index}`} values={values} index={index} startedAt={startedAt} />)}
  </div>;
});
