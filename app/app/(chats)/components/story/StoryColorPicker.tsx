"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { storyColorToHsv, storyHsvToColor } from "@/lib/story-editor";
import { cn } from "@/lib/utils";

const colors = ["#ffffff", "#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

export function StoryColorPicker({ color, onChange, label }: { color: string; onChange: (color: string) => void; label: string }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [hexDraft, setHex] = useState<string | null>(null);
  const hex = hexDraft ?? color;
  const [hue, setHue] = useState(() => storyColorToHsv(color).h);
  const root = useRef<HTMLDivElement>(null);
  const dragRect = useRef<DOMRect | null>(null);
  const pointer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const pending = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const hsv = storyColorToHsv(color);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);

  function flush() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (pending.current) { onChangeRef.current(pending.current); pending.current = null; }
  }
  function choosePoint(event: React.PointerEvent<HTMLDivElement>) {
    const rect = dragRect.current;
    if (!rect) return;
    pending.current = storyHsvToColor(hue, (event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
    if (raf.current === null) raf.current = requestAnimationFrame(flush);
  }
  function commitHex() {
    const normalized = hex.startsWith("#") ? hex : `#${hex}`;
    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
      onChange(normalized.toLowerCase());
      setHue(storyColorToHsv(normalized).h);
    }
    setHex(null);
  }

  return <div ref={root} className="relative grid h-12 w-full grid-cols-[repeat(11,minmax(0,1fr))] items-center rounded-full border border-white/[0.08] bg-[#181818]/65 px-1 shadow-[0_4px_18px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[20px]">
    <button type="button" aria-label={t("Свой цвет: {0}", { 0: label })} aria-expanded={open}
      onClick={() => { if (!open && hsv.s > 0) setHue(hsv.h); setOpen(!open); }}
      className="group grid h-11 min-w-0 place-items-center rounded-full">
      <span className={cn("h-6 w-6 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-[conic-gradient(#ff3b30,#ffcc00,#34c759,#007aff,#af52de,#ff3b30)] transition-transform duration-200 group-active:scale-90", open && "ring-2 ring-white/80 ring-offset-2 ring-offset-[#181818]")} />
    </button>
    {colors.map(value => <button key={value} type="button" aria-label={`${label}: ${value}`} aria-pressed={color.toLowerCase() === value}
      onClick={() => { onChange(value); if (storyColorToHsv(value).s > 0) setHue(storyColorToHsv(value).h); }}
      className="group grid h-11 min-w-0 place-items-center rounded-full">
      <span className={cn("grid h-5 w-5 place-items-center rounded-full border border-white/25 shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-200 group-active:scale-90", color.toLowerCase() === value && "scale-110 ring-2 ring-white ring-offset-[3px] ring-offset-transparent")}
        style={{ backgroundColor: value }} />
    </button>)}
    <AnimatePresence>
      {open && <motion.div role="dialog" aria-label={t("Выбор цвета: {0}", { 0: label })}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-[calc(100%+12px)] left-0 right-0 rounded-[24px] border border-white/[0.08] bg-[#181818]/70 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[24px] backdrop-saturate-150">
        <div className="mb-3 flex items-center justify-between text-[15px] font-medium text-white"><span>{label}</span>
          <button type="button" aria-label={t("Применить цвет")} onClick={() => { flush(); commitHex(); setOpen(false); }} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/10 active:bg-white/15"><Check size={19} /></button>
        </div>
        <div role="slider" tabIndex={0} aria-label={t("Насыщенность цвета")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s * 100)}
          className="relative h-[170px] touch-none overflow-hidden rounded-[16px] cursor-crosshair ring-1 ring-inset ring-white/10"
          style={{ background: `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),${storyHsvToColor(hue, 1, 1)}` }}
          onPointerDown={event => { event.preventDefault(); pointer.current = event.pointerId; dragRect.current = event.currentTarget.getBoundingClientRect(); event.currentTarget.setPointerCapture(event.pointerId); choosePoint(event); }}
          onPointerMove={event => { if (pointer.current === event.pointerId) choosePoint(event); }}
          onPointerUp={event => { if (pointer.current !== event.pointerId) return; choosePoint(event); flush(); pointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { flush(); pointer.current = null; }}
          onKeyDown={event => { const delta = event.shiftKey ? .1 : .02; if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); onChange(storyHsvToColor(hue, hsv.s + (event.key === "ArrowRight" ? delta : event.key === "ArrowLeft" ? -delta : 0), hsv.v + (event.key === "ArrowUp" ? delta : event.key === "ArrowDown" ? -delta : 0))); } }}>
          <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
        </div>
        <input type="range" aria-label={t("Оттенок")} min={0} max={360} value={hue}
          onChange={event => { const h = Number(event.target.value); setHue(h); onChange(storyHsvToColor(h, hsv.s || 1, hsv.v || 1)); }}
          className="mt-4 block h-7 w-full cursor-pointer appearance-none rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70 [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent" style={{ background: "linear-gradient(to right,#ff3b30,#ffcc00,#34c759,#00c7be,#007aff,#af52de,#ff3b30) center / 100% 12px no-repeat" }} />
        <div className="mt-3 flex items-center gap-3">
          <span className="h-10 w-10 shrink-0 rounded-[12px] border border-white/20" style={{ backgroundColor: color }} />
          <input aria-label={t("HEX цвета")} value={hex} maxLength={7} onChange={event => setHex(event.target.value)} onBlur={commitHex}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commitHex(); } }}
            className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/20 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-mono text-sm uppercase tracking-wider text-white outline-none transition-colors focus:border-white/40" />
        </div>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
