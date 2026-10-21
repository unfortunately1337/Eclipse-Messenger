"use client";

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useTranslation, useLanguage } from "@/components/LocaleProvider";
import { EMOJI_STATUS_CATALOG, type EmojiStatus } from "@/lib/emoji-status";
import { getPanelVisualStyle } from "@/lib/client/panel-visual";
import { EmojiStatusIcon } from "./EmojiStatusIcon";

const COLUMNS = 7;
const ROW_HEIGHT = 54;
const packNames: Record<string, string> = { Halloween: "Halloween", CursedMoji: "CursedMoji", GameEmoji: "Игры", MasksEmoji: "Маски", DuckEmoji: "Утки", NewsEmoji: "Новости", FinanceEmoji: "Финансы" };
const packIds = Array.from(new Set(EMOJI_STATUS_CATALOG.map(entry => entry.category))).sort((a, b) => Number(b === "Halloween") - Number(a === "Halloween"));
const categories = [["all", "Все"], ...packIds.map(id => [id, packNames[id] ?? id])] as const;

const EmojiCell = memo(function EmojiCell({ entry, index, locale, selected, disabled, animate, viewport, count, onSelect, onScrollTopChange }: {
  entry: EmojiStatus; index: number; locale: string; selected: boolean; disabled: boolean; animate: boolean; viewport: HTMLDivElement | null; count: number; onSelect: (id: string | null) => void; onScrollTopChange: (top: number) => void;
}) {
  return <button type="button" aria-label={locale === "ru" ? entry.name : entry.nameEn} title={locale === "ru" ? entry.name : entry.nameEn} aria-pressed={selected} disabled={disabled}
                    data-status-index={index} data-status-id={entry.id}
                    onKeyDown={event => {
                      const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[event.key];
                      if (offset === undefined) return;
                      event.preventDefault();
                      const next = Math.max(0, Math.min(count - 1, index + offset));
                      const container = viewport;
                      if (!container) return;
                      const top = Math.floor(next / COLUMNS) * ROW_HEIGHT;
                      if (top < container.scrollTop) container.scrollTop = top;
                      else if (top + ROW_HEIGHT > container.scrollTop + container.clientHeight) container.scrollTop = top + ROW_HEIGHT - container.clientHeight;
                      onScrollTopChange(container.scrollTop);
                      requestAnimationFrame(() => container.querySelector<HTMLButtonElement>(`[data-status-index="${next}"]`)?.focus({ preventScroll: true }));
                    }}
                    onClick={() => onSelect(entry.id)}
                    className="group absolute isolate flex items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
                    style={{ top: Math.floor(index / COLUMNS) * ROW_HEIGHT, left: `${index % COLUMNS * 100 / COLUMNS}%`, width: `${100 / COLUMNS}%`, height: ROW_HEIGHT }}>
                    <span data-emoji-selection={selected || undefined} className={`pointer-events-none absolute inset-[5px] -z-10 rounded-[11px] transition-colors ${selected ? "bg-white/15" : "group-hover:bg-white/[0.07]"}`} />
                    <EmojiStatusIcon entry={entry} animate={animate} size={36} renderer="preview" />
                  </button>;
});

export default function EmojiStatusPicker({ open, onOpenChange, value, onSelect, glass, saving, error, triggerRef }: {
  open: boolean; onOpenChange: (open: boolean) => void; value: string | null;
  onSelect: (id: string | null) => void; glass: boolean; saving: boolean; error: string | null;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslation();
  const { locale } = useLanguage();
  const reduced = useReducedMotion();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(6 * ROW_HEIGHT);
  const [visible, setVisible] = useState(true);
  const [scrolling, setScrolling] = useState(false);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [categoryViewport, setCategoryViewport] = useState<HTMLDivElement | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const scrollEnd = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryDrag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const ignoreCategoryClick = useRef(false);
  const updateScroll = () => {
    setScrolling(true);
    if (scrollEnd.current) clearTimeout(scrollEnd.current);
    if (scrollFrame.current === null) scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      if (viewport) setScrollTop(Math.floor(viewport.scrollTop / ROW_HEIGHT) * ROW_HEIGHT);
    });
    scrollEnd.current = setTimeout(() => {
      if (viewport) setScrollTop(viewport.scrollTop);
      setScrolling(false);
    }, 140);
  };
  useEffect(() => () => {
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    if (scrollEnd.current) clearTimeout(scrollEnd.current);
  }, []);
  useEffect(() => {
    const element = categoryViewport;
    if (!open || !element) return;
    const wheel = (event: WheelEvent) => {
      if (element.scrollWidth <= element.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const next = Math.max(0, Math.min(element.scrollWidth - element.clientWidth, element.scrollLeft + delta));
      if (next !== element.scrollLeft) { event.preventDefault(); element.scrollLeft = next; }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [open, categoryViewport]);
  useEffect(() => { if (open) setSearch(""); }, [open]);
  const entries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return EMOJI_STATUS_CATALOG.filter(e => (category === "all" || e.category === category) && (!query || `${e.emoji} ${e.keywords}`.includes(query)));
  }, [search, category]);
  useEffect(() => {
    setScrollTop(0);
    if (viewport) viewport.scrollTop = 0;
  }, [search, category, open]);
  useEffect(() => {
    const element = viewport;
    if (!open || !element) return;
    const update = () => setViewportHeight(element.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, viewport]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 1);
  const rowCount = Math.ceil(entries.length / COLUMNS);
  // At most eight rows are mounted, independent of catalog size.
  const rendered = entries.slice(firstRow * COLUMNS, (firstRow + 8) * COLUMNS);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <AnimatePresence>
      {open && <Dialog.Portal forceMount>
        <Dialog.Overlay asChild forceMount>
          <motion.div className="fixed inset-0 z-[220] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18 }} />
        </Dialog.Overlay>
        <Dialog.Content asChild forceMount onCloseAutoFocus={e => { e.preventDefault(); triggerRef.current?.focus(); }} onOpenAutoFocus={e => e.preventDefault()}>
          <motion.div data-emoji-status-picker className="fixed inset-x-2 bottom-2 z-[221] mx-auto flex max-h-[calc(100dvh-24px)] w-auto max-w-[420px] flex-col overflow-hidden rounded-[28px] border p-4 text-white shadow-2xl outline-none md:inset-x-0 md:bottom-auto md:top-[max(16px,calc(50dvh-280px))] md:w-[420px]"
            style={getPanelVisualStyle(glass)} initial={{ opacity: 0, y: reduced ? 0 : 18, scale: reduced ? 1 : .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : .98 }} transition={{ duration: reduced ? 0 : .2, ease: [.2,.8,.2,1] }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <Dialog.Title className="text-[18px] font-semibold">{t("Эмодзи-статус")}</Dialog.Title>
              <Dialog.Close aria-label={t("Закрыть")} className="flex size-8 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10"><X size={20} /></Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">{t("Выберите анимированный эмодзи рядом с именем")}</Dialog.Description>
            <label className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-zinc-400">
              <Search size={17} /><input aria-label={t("Поиск эмодзи")} placeholder={t("Поиск эмодзи")} value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none" />
            </label>
            <div ref={setCategoryViewport} data-emoji-pack-tabs className="no-scrollbar my-3 flex shrink-0 cursor-grab select-none gap-1 overflow-x-auto overscroll-x-contain pb-1 active:cursor-grabbing" style={{ touchAction: "none" }} aria-label={t("Категории эмодзи")}
              onPointerDown={event => {
                if (event.button === 0) categoryDrag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
              }}
              onPointerMove={event => {
                const drag = categoryDrag.current;
                if (!drag) return;
                const dx = event.clientX - drag.x;
                if (Math.abs(dx) > 4) { drag.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
                if (drag.moved) event.currentTarget.scrollLeft = drag.left - dx;
              }}
              onPointerUp={event => {
                ignoreCategoryClick.current = categoryDrag.current?.moved ?? false;
                categoryDrag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => { categoryDrag.current = null; ignoreCategoryClick.current = false; }}
              onClickCapture={event => { if (ignoreCategoryClick.current) { event.preventDefault(); event.stopPropagation(); ignoreCategoryClick.current = false; } }}>
              {categories.map(([id, name]) => <button key={id} type="button" aria-pressed={category === id} onClick={event => { setCategory(id); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }} className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] transition-colors ${category === id ? "bg-white text-zinc-950" : "bg-white/[0.05] text-zinc-400 hover:bg-white/10"}`}>{t(name)}</button>)}
            </div>
            <div ref={setViewport} data-emoji-status-grid className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain" style={{ height: 6 * ROW_HEIGHT }} onScroll={updateScroll}>
              <div role="group" aria-label={t("Анимированные эмодзи")} className="relative" style={{ height: rowCount * ROW_HEIGHT }}>
                {rendered.map((entry, i) => {
                  const index = firstRow * COLUMNS + i;
                  const top = Math.floor(index / COLUMNS) * ROW_HEIGHT;
                  const animate = open && !scrolling && !reduced && visible && top + ROW_HEIGHT > scrollTop && top < scrollTop + viewportHeight;
                  return <EmojiCell key={entry.id} entry={entry} index={index} locale={locale} selected={value === entry.id} disabled={saving} animate={animate} viewport={viewport} count={entries.length} onSelect={onSelect} onScrollTopChange={setScrollTop} />;
                })}
              </div>
              {!entries.length && <p className="py-10 text-center text-sm text-zinc-400">{t("Ничего не найдено")}</p>}
            </div>
            {error && <p role="alert" className="mt-2 text-center text-xs text-red-400">{error}</p>}
            <div className="mt-3 flex shrink-0 items-center justify-between text-xs text-zinc-400">
              <span>{saving ? t("Сохранение…") : `${entries.length} ${t("эмодзи")}`}</span>
              <button type="button" disabled={!value || saving} onClick={() => onSelect(null)} className="rounded-lg px-3 py-2 text-white hover:bg-white/10 disabled:opacity-30">{t("Убрать статус")}</button>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>}
    </AnimatePresence>
  </Dialog.Root>;
}
