"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@/components/LocaleProvider";
import { callOverlayMaterial } from "@/lib/client/call-window-style";
import { PANEL_EASE } from "@/lib/client/panel-motion";

export function GroupCallParticipantStrip({ children, glass }: { children: ReactNode; glass: boolean }) {
  const t = useTranslation(), reduced = useReducedMotion();
  const strip = useRef<HTMLDivElement>(null), frame = useRef(0), dragged = useRef(false);
  const pointer = useRef<{ id: number; x: number; left: number; last: number; at: number; velocity: number } | null>(null);
  useEffect(() => {
    const node = strip.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || node.scrollWidth <= node.clientWidth) return;
      cancelAnimationFrame(frame.current);
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
      event.preventDefault(); node.scrollLeft += delta * unit;
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => { node.removeEventListener("wheel", wheel); cancelAnimationFrame(frame.current); };
  }, []);
  return <motion.div ref={strip} data-group-call-strip role="region" aria-label={t("Участники видеочата")} tabIndex={0}
    className="flex w-full min-w-0 shrink-0 touch-none select-none gap-2 overflow-x-auto overscroll-x-contain no-scrollbar rounded-[20px] border p-2 outline-none focus-visible:ring-1 focus-visible:ring-white/40"
    style={callOverlayMaterial(glass)} initial={{ height: 0, opacity: 0, y: reduced ? 0 : 8 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: reduced ? 0 : 8 }} transition={{ duration: reduced ? 0 : .22, ease: PANEL_EASE }}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      cancelAnimationFrame(frame.current); dragged.current = false;
      pointer.current = { id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, last: event.clientX, at: event.timeStamp, velocity: 0 };
    }}
    onPointerMove={event => {
      const drag = pointer.current;
      if (!drag || drag.id !== event.pointerId) return;
      if (!dragged.current && Math.abs(event.clientX - drag.x) < 6) return;
      if (!dragged.current) { dragged.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
      event.preventDefault();
      drag.velocity = (drag.last - event.clientX) / Math.max(1, event.timeStamp - drag.at);
      drag.last = event.clientX; drag.at = event.timeStamp;
      event.currentTarget.scrollLeft = drag.left + drag.x - event.clientX;
    }}
    onPointerUp={event => {
      const drag = pointer.current; pointer.current = null;
      if (!drag || !dragged.current || reduced || event.timeStamp - drag.at > 80) return;
      let velocity = Math.max(-2.5, Math.min(2.5, drag.velocity)), previous = performance.now();
      const coast = (now: number) => {
        const node = strip.current; if (!node) return;
        const dt = Math.min(32, now - previous), oldLeft = node.scrollLeft; previous = now;
        node.scrollLeft += velocity * dt; velocity *= Math.exp(-dt / 130);
        if (Math.abs(velocity) > .02 && Math.abs(node.scrollLeft - oldLeft) > .1) frame.current = requestAnimationFrame(coast);
      };
      frame.current = requestAnimationFrame(coast);
    }}
    onPointerCancel={() => { pointer.current = null; }}
    onClickCapture={event => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}
    onKeyDown={event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.scrollBy({ left: event.key === "ArrowLeft" ? -144 : 144, behavior: reduced ? "instant" : "smooth" });
    }}>{children}</motion.div>;
}
