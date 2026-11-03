"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

export function virtualViewport(element: Pick<HTMLElement, "scrollTop" | "clientHeight" | "clientWidth">) {
  // Callers overscan at least one row (>= 32 px), so no row is lost between commits.
  return { top: Math.floor(element.scrollTop / 32) * 32, height: element.clientHeight, width: element.clientWidth };
}
export function useVirtualViewport(ref: RefObject<HTMLElement | null>, initial: { top: number; height: number; width: number }) {
  const [view, setView] = useState(initial);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      frame.current = null;
      const next = virtualViewport(element);
      setView(previous => previous.top === next.top && previous.height === next.height && previous.width === next.width ? previous : next);
    };
    const schedule = () => { if (frame.current === null) frame.current = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule); observer.observe(element);
    element.addEventListener("scroll", schedule, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", schedule); if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; };
  }, [ref]);
  return view;
}
