"use client";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { GROUP_VOICE_COLORS, groupVoiceLevels, type GroupVoiceSample } from "@/lib/client/group-call-voice";
const quiet = (): GroupVoiceSample[] => [];
function sea(level: number, phase: number) {
  const y = (x: number) => 37.5 - level * (26 + 4 * Math.sin(x * .023 + phase) + 3 * Math.sin(x * .047 - phase * .73));
  let path = `M 0 ${y(0).toFixed(2)}`;
  for (let x = 8; x <= 400; x += 8) path += ` L ${x} ${y(x).toFixed(2)}`;
  return path + " L 400 44 L 0 44 Z";
}
export function GroupCallVoiceWaves({ callId, readLevels = quiet }: { callId: string; readLevels?: () => GroupVoiceSample[] }) {
  const id = useId().replace(/:/g, ""), paths = useRef<(SVGPathElement | null)[]>([]), reader = useRef(readLevels);
  useLayoutEffect(() => { reader.current = readLevels; }, [readLevels]);
  useEffect(() => {
    let frame = 0, previous = performance.now(), phase = 0;
    const current = [0, 0, 0, 0], silent = [true, true, true, true];
    const tick = (now: number) => {
      if (now - previous < 1000 / 30) { frame = requestAnimationFrame(tick); return; }
      const dt = Math.min(.15, (now - previous) / 1000); previous = now;
      if (!document.hidden) {
        const levels = groupVoiceLevels(callId, reader.current()); phase += dt * 1.8;
        current.forEach((level, channel) => {
          const raw = levels[channel], target = raw < .004 ? 0 : Math.min(1, Math.pow(raw * 5, .55));
          level += (target - level) * (1 - Math.exp(-dt * (target > level ? 85 : 6))); current[channel] = level;
          const quiet = level < .002;
          if (!quiet || !silent[channel]) paths.current[channel]?.setAttribute("d", sea(quiet ? 0 : level, phase * (channel % 2 ? 1 : -.83) + channel * 2));
          silent[channel] = quiet;
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [callId]);
  return <svg data-group-call-waves aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 36" preserveAspectRatio="none">
    <defs>{GROUP_VOICE_COLORS.map((color, channel) => <linearGradient key={channel} id={`${id}-${channel}`} x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse"><stop stopColor={color} stopOpacity=".6" /><stop offset="1" stopColor={color} stopOpacity=".2" /></linearGradient>)}</defs>
    {GROUP_VOICE_COLORS.map((color, channel) => <path key={channel} ref={node => { paths.current[channel] = node; }} data-group-wave-channel={channel} d={sea(0, 0)} fill={`url(#${id}-${channel})`} stroke={color} strokeOpacity=".3" strokeWidth=".65" />)}
  </svg>;
}
