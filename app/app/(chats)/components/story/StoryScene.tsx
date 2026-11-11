"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { StoryOverlay } from "@/lib/story-overlay";

// Fit the complete composition, rather than resizing its media and overlays independently.
export function StoryScene({ viewport, children }: { viewport: StoryOverlay["viewport"]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || !viewport) return;
    const resize = () => setScale(Math.min(parent.clientWidth / viewport.width, parent.clientHeight / viewport.height));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [viewport?.width, viewport?.height]);
  return <div ref={ref} data-story-scene className="absolute" style={viewport ? {
    width: viewport.width, height: viewport.height, left: "50%", top: "50%",
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: "center",
  } : { inset: 0 }}>{children}</div>;
}
