"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";

export type CallVoiceLevels = { local: number; remote: number };
const quiet = (): CallVoiceLevels => ({ local: 0, remote: 0 });

function sea(level: number, phase: number, local: boolean) {
  const height = local ? 22 : 29;
  const surface = (x: number) => 37.5 - level * (height + 4 * Math.sin(x * 0.023 + phase) + 3 * Math.sin(x * 0.047 - phase * 0.73));
  let path = `M 0 ${surface(0).toFixed(2)}`;
  // A sampled smooth wave never folds and is clipped by the tray's pill shape.
  for (let x = 8; x <= 400; x += 8) path += ` L ${x} ${surface(x).toFixed(2)}`;
  return path + " L 400 44 L 0 44 Z";
}
function strength(value: number) {
  if (!Number.isFinite(value) || value < 0.004) return 0;
  return Math.min(1, Math.pow(value * 5, 0.55));
}

export function CallVoiceWaves({ readLevels = quiet }: { readLevels?: () => CallVoiceLevels }) {
  const id = useId().replace(/:/g, "");
  const local = useRef<SVGPathElement>(null), remote = useRef<SVGPathElement>(null);
  const reader = useRef(readLevels);
  useLayoutEffect(() => { reader.current = readLevels; }, [readLevels]);
  useEffect(() => {
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
    let previous = performance.now(), localLevel = 0, remoteLevel = 0, phase = Math.random() * Math.PI * 2;
    let drift = 0.8, targetDrift = 0.8, changeAt = 0;
    let localQuiet = true, remoteQuiet = true;
    const tick = (now: number) => {
      const dt = Math.min(0.15, Math.max(0, (now - previous) / 1000));
      if (now - previous < 1000 / 60) { frame = requestAnimationFrame(tick); return; }
      previous = now;
      if (document.hidden) { timer = setTimeout(() => { frame = requestAnimationFrame(tick); }, 150); return; }
      const levels = reader.current();
      const own = strength(levels.local), peer = strength(levels.remote);
      localLevel += (own - localLevel) * (1 - Math.exp(-dt * (own > localLevel ? 85 : 6)));
      remoteLevel += (peer - remoteLevel) * (1 - Math.exp(-dt * (peer > remoteLevel ? 85 : 6)));
      if (now > changeAt) { targetDrift = 0.65 + Math.random() * 0.65; changeAt = now + 1700 + Math.random() * 2300; }
      drift += (targetDrift - drift) * (1 - Math.exp(-dt * 1.4));
      phase += dt * drift * 2.2;
      const nextLocalQuiet = localLevel < 0.002, nextRemoteQuiet = remoteLevel < 0.002;
      // Keep listening every frame, but do not rebuild/paint invisible waves in silence.
      if (!nextLocalQuiet || !localQuiet) local.current?.setAttribute("d", sea(nextLocalQuiet ? 0 : localLevel, -phase * 0.83 + 2, true));
      if (!nextRemoteQuiet || !remoteQuiet) remote.current?.setAttribute("d", sea(nextRemoteQuiet ? 0 : remoteLevel, phase, false));
      localQuiet = nextLocalQuiet; remoteQuiet = nextRemoteQuiet;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, []);

  return <svg data-call-voice-waves aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 36" preserveAspectRatio="none">
    <defs>
      <linearGradient id={id + "-local"} x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#fb923c" stopOpacity="0.42" /><stop offset="1" stopColor="#f97316" stopOpacity="0.15" /></linearGradient>
      <linearGradient id={id + "-remote"} x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor="#6ee7b7" stopOpacity="0.68" /><stop offset="1" stopColor="#10b981" stopOpacity="0.26" /></linearGradient>
    </defs>
    <path ref={local} data-call-voice="local" d={sea(0, 0, true)} fill={"url(#" + id + "-local)"} stroke="#fdba74" strokeOpacity="0.20" strokeWidth="0.65" />
    <path ref={remote} data-call-voice="remote" d={sea(0, 0, false)} fill={"url(#" + id + "-remote)"} stroke="#6ee7b7" strokeOpacity="0.36" strokeWidth="0.65" />
  </svg>;
}
