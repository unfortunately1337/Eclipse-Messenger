import { motion } from "framer-motion";
import React, { memo, useEffect, useState } from "react";
import { EmojiGlyph } from "./EmojiGlyph";
import { reactionAnimationAsset } from "@/lib/client/reaction-animation";

export const ReactionEmoji = memo(function ReactionEmoji({ emoji, pulseVersion, isPulsing }: {
  emoji: string; pulseVersion: number; isPulsing: boolean;
}) {
  const asset = reactionAnimationAsset(emoji);
  return asset && isPulsing
    ? <ReactionEmojiPlayback key={pulseVersion} emoji={emoji} url={asset.preview} durationMs={asset.durationMs} scale={asset.reactionScale ?? 1} />
    : isPulsing
      ? <motion.span key={pulseVersion} className="inline-flex h-6 w-6" animate={{ rotate: [0, -10, 8, -5, 0] }} transition={{ duration: .6, ease: "easeInOut" }}><EmojiGlyph emoji={emoji} size={24} /></motion.span>
      : <EmojiGlyph emoji={emoji} size={24} />;
});

function ReactionEmojiPlayback({ emoji, url, durationMs, scale }: { emoji: string; url: string; durationMs: number; scale: number }) {
  const [phase, setPhase] = useState<"loading" | "playing" | "settling" | "done">("loading");
  useEffect(() => {
    if (phase !== "playing" && phase !== "settling") return;
    const timer = setTimeout(() => setPhase(phase === "playing" ? "settling" : "done"),
      phase === "playing" ? Math.max(100, durationMs - 180) : 200);
    return () => clearTimeout(timer);
  }, [phase, durationMs]);
  const active = phase === "playing";
  return <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center" data-reaction-animation={active ? "playing" : "static"}>
    <span className="inline-flex transition-opacity duration-200" style={{ opacity: active ? 0 : 1 }}>
      <EmojiGlyph emoji={emoji} size={24} />
    </span>
    {phase !== "done" && <img src={url} alt="" aria-hidden="true" draggable={false} decoding="async"
      onLoad={() => setPhase("playing")} onError={() => setPhase("done")}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-200 ease-out"
      style={{ opacity: active ? 1 : 0, transform: `scale(${scale})`, transformOrigin: "center" }} />}
  </span>;
}
