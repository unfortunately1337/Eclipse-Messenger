"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { CallVoiceLevels } from "./CallVoiceWaves";
const quiet = (): CallVoiceLevels => ({ local: 0, remote: 0 });
function halo(level: number, phase: number, layer: number) {
  const count = 32;
  const points = Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    const radius = 84 + level * (10 + layer * 5 + 3.5 * Math.sin(angle * 3 + phase + layer) + 2 * Math.sin(angle * 5 - phase * 0.7));
    return { x: 120 + Math.cos(angle) * radius, y: 120 + Math.sin(angle) * radius };
  });
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < count; i++) {
    const a = points[(i + count - 1) % count], b = points[i], c = points[(i + 1) % count], d = points[(i + 2) % count];
    path += ` C ${(b.x + (c.x - a.x) / 6).toFixed(2)} ${(b.y + (c.y - a.y) / 6).toFixed(2)} ${(c.x - (d.x - b.x) / 6).toFixed(2)} ${(c.y - (d.y - b.y) / 6).toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
  }
  return path + " Z";
}
export function CallAvatarVoiceHalo({ readLevels = quiet }: { readLevels?: () => CallVoiceLevels }) {
  const svg = useRef<SVGSVGElement>(null), paths = useRef<(SVGPathElement | null)[]>([]), reader = useRef(readLevels);
  useLayoutEffect(() => { reader.current = readLevels; }, [readLevels]);
  useEffect(() => {
    let frame = 0, previous = performance.now(), level = 0, lastOpacity = 0, phase = Math.random() * Math.PI * 2;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - previous) / 1000); previous = now;
      if (!document.hidden) {
        const sample = reader.current().remote;
        const target = Number.isFinite(sample) && sample > 0.004 ? Math.min(1, Math.pow(sample * 5, 0.55)) : 0;
        level += (target - level) * (1 - Math.exp(-dt * (target > level ? 85 : 6)));
        const opacity = level < 0.002 ? 0 : Math.min(1, level * 3);
        if (Math.abs(opacity - lastOpacity) > 0.002 || (opacity === 0 && lastOpacity !== 0)) {
          svg.current?.style.setProperty("opacity", String(opacity));
          lastOpacity = opacity;
        }
        if (level > 0.002) {
          phase += dt * (0.8 + target * 0.6);
          paths.current.forEach((path, index) => path?.setAttribute("d", halo(level, phase, index)));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <svg ref={svg} data-call-avatar-voice aria-hidden="true" viewBox="0 0 240 240" className="pointer-events-none absolute -inset-7 h-[calc(100%+56px)] w-[calc(100%+56px)]" style={{ opacity: 0 }}>
    <path ref={node => { paths.current[2] = node; }} d={halo(0, 0, 2)} fill="#6ee7b7" fillOpacity="0.11" />
    <path ref={node => { paths.current[1] = node; }} d={halo(0, 0, 1)} fill="#34d399" fillOpacity="0.17" />
    <path ref={node => { paths.current[0] = node; }} d={halo(0, 0, 0)} fill="#a7f3d0" fillOpacity="0.14" stroke="#a7f3d0" strokeOpacity="0.18" strokeWidth="0.7" />
  </svg>;
}
