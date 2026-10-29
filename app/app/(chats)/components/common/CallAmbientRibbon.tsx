"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";

function sea(time: number, seed: number, back = false) {
  const phase = time * (back ? -0.65 : 0.9) + seed;
  const base = (back ? 755 : 810) + 32 * Math.sin(time * 0.29 + seed);
  const amplitude = 45 + 18 * Math.sin(time * 0.37 + seed * 1.7);
  const surface = (x: number) => base + amplitude * Math.sin(x * 0.005 + phase)
    + 18 * Math.sin(x * 0.009 - phase * 0.73);
  const slope = (x: number) => amplitude * 0.005 * Math.cos(x * 0.005 + phase)
    + 18 * 0.009 * Math.cos(x * 0.009 - phase * 0.73);
  let path = `M -50 ${surface(-50).toFixed(2)}`;
  for (let x = -50; x < 1050; x += 110) {
    const right = x + 110, step = 110 / 3;
    path += ` C ${x + step} ${(surface(x) + slope(x) * step).toFixed(2)} ${right - step} ${(surface(right) - slope(right) * step).toFixed(2)} ${right} ${surface(right).toFixed(2)}`;
  }
  return path + " L 1050 1050 L -50 1050 Z";
}

export function CallAmbientRibbon({ glass, connecting, reducedMotion }: { glass: boolean; connecting: boolean; reducedMotion: boolean }) {
  const id = useId().replace(/:/g, "");
  const front = useRef<SVGPathElement>(null), back = useRef<SVGPathElement>(null);
  const speed = useRef(1), target = useRef(1), clock = useRef(0), seed = useRef<number | null>(null);
  useLayoutEffect(() => { target.current = connecting ? 0.18 : 1; }, [connecting]);
  useEffect(() => {
    seed.current ??= Math.random() * Math.PI * 2;
    const paint = () => {
      front.current?.setAttribute("d", sea(clock.current, seed.current!));
      back.current?.setAttribute("d", sea(clock.current, seed.current! + 2, true));
    };
    paint();
    if (reducedMotion) return;
    let frame = 0, previous = performance.now(), drift = 1, driftTarget = 1, changeAt = 0;
    const tick = (now: number) => {
      const dt = (now - previous) / 1000;
      if (dt >= 1 / 30) {
        previous = now;
        if (!document.hidden) {
          const step = Math.min(dt, 0.1);
          if (now >= changeAt) { driftTarget = 0.8 + Math.random() * 0.6; changeAt = now + 2500 + Math.random() * 3000; }
          drift += (driftTarget - drift) * (1 - Math.exp(-step));
          speed.current += (target.current - speed.current) * (1 - Math.exp(-step * 2.5));
          clock.current += step * speed.current * drift;
          paint();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  return <motion.svg data-call-ambient-wave data-call-ambient-snake aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" initial={{ opacity: 0 }} animate={{ opacity: glass ? 0.9 : 0.8 }} transition={{ duration: reducedMotion ? 0 : 0.7 }}>
    <defs>
      <linearGradient id={id + "-front"} x1="0" y1="650" x2="0" y2="1050" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" stopOpacity="0.25" /><stop offset="1" stopColor="#fff" stopOpacity="0.025" /></linearGradient>
      <linearGradient id={id + "-back"} x1="0" y1="650" x2="0" y2="1050" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" stopOpacity="0.12" /><stop offset="1" stopColor="#fff" stopOpacity="0.015" /></linearGradient>
      <filter id={id + "-soft"} x="-10%" y="-20%" width="120%" height="140%" colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation="3" /></filter>
    </defs>
    <g filter={"url(#" + id + "-soft)"}>
      <path ref={back} d={sea(0, 2, true)} fill={"url(#" + id + "-back)"} />
      <path ref={front} d={sea(0, 0)} fill={"url(#" + id + "-front)"} />
    </g>
  </motion.svg>;
}
