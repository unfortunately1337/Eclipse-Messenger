"use client";

import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";

const edgeStyle: CSSProperties = {
  containerType: "size",
  maskImage: "radial-gradient(ellipse 73% 69% at center, transparent 12%, #0002 28%, #0008 50%, #000d 73%, #000 96%)",
};

const orbitStyle: CSSProperties = {
  width: "155cqmax",
  aspectRatio: "1",
  translate: "-50% -50%",
  background: "var(--call-ambient-background, #fff)",
  maskImage: "conic-gradient(from 20deg, transparent, #0005 28deg, #000 65deg, #000a 112deg, transparent 155deg, transparent 183deg, #0009 235deg, #0006 277deg, transparent 326deg)",
};

export function CallAmbientGradient({ glass, connecting, reducedMotion }: { glass: boolean; connecting: boolean; reducedMotion: boolean }) {
  const [{ strength, period }] = useState(() => ({ strength: 0.1 + Math.random() * 0.07, period: 7 + Math.random() * 2 }));
  const driftTransition = { duration: period, ease: "easeInOut" as const, repeat: Infinity };

  return (
    <motion.div data-call-ambient-gradient className="absolute inset-0" style={edgeStyle} initial={false}
      animate={{ opacity: connecting ? 0.72 : 1 }} transition={{ duration: reducedMotion ? 0 : 0.32 }}>
      <motion.div className="absolute left-1/2 top-1/2"
        style={{ ...orbitStyle, opacity: glass ? 0.39 : 0.33 }}
        // A looping keyframe animation must start on mount. `false` makes
        // Motion apply its final frame and skip the loop entirely.
        initial={{ rotate: 0, scaleX: 1, scaleY: 1, skewX: 0 }}
        animate={reducedMotion ? { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0 } : {
          rotate: [0, 360],
          scaleX: [1, 1 + strength, 1.03, 1 + strength * 0.55, 1],
          scaleY: [1, 1.04, 1 + strength, 1.02, 1],
          skewX: [0, 5, -4, 2, 0],
        }}
        transition={reducedMotion ? { duration: 0 } : {
          rotate: { duration: 28, ease: "linear", repeat: Infinity },
          scaleX: driftTransition,
          scaleY: { ...driftTransition, duration: period * 1.3 },
          skewX: { ...driftTransition, duration: period * 1.12 },
        }} />
    </motion.div>
  );
}
