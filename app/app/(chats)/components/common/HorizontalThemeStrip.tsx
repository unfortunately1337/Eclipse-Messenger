"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function HorizontalThemeStrip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
      const next = Math.max(0, Math.min(strip.scrollWidth - strip.clientWidth, strip.scrollLeft + event.deltaY * unit));
      if (Math.abs(next - strip.scrollLeft) < 0.5) return;
      event.preventDefault();
      // Each wheel delta is applied once, without restarting a smooth-scroll animation.
      strip.scrollLeft = next;
    };
    strip.addEventListener("wheel", wheel, { passive: false });
    return () => strip.removeEventListener("wheel", wheel);
  }, []);
  return <div ref={ref} data-theme-strip className="flex items-start gap-2.5 overflow-x-auto px-1 py-1.5 no-scrollbar scroll-auto scroll-pl-1" style={{ contain: "paint" }}>{children}</div>;
}
