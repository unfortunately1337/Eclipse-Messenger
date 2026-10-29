"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { messageSearchNeedle } from "@/lib/client/message-search";
import { useTranslation } from "@/components/LocaleProvider";

type Props = { query: string; count: number; index: number; busy: boolean; hasMore: boolean; failed: boolean; style: CSSProperties; onChange: (text: string) => void; onMove: (delta: number) => void; onClose: () => void };
export function MessageSearchBar(props: Props) {
  const t = useTranslation(), input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  return <motion.div key="message-search" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="pointer-events-none mx-auto flex w-full max-w-[700px] flex-col gap-2">
    <div className="pointer-events-auto flex w-full items-center gap-2">
    <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-zinc-100" style={props.style}>
      {props.busy ? <Loader2 size={17} className="shrink-0 animate-spin text-zinc-400" /> : <Search size={17} className="shrink-0 text-zinc-400" />}
      <input ref={input} aria-label={t("Поиск сообщений")} placeholder={t("Поиск сообщений")} value={props.query} maxLength={256} onChange={event => props.onChange(event.target.value)} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); props.onClose(); } if (event.key === "Enter") { event.preventDefault(); props.onMove(event.shiftKey ? -1 : 1); } }} className="w-full min-w-0 bg-transparent text-[16px] outline-none placeholder:text-zinc-500 md:text-[15px]" />
    </div>
    <button type="button" aria-label={t("Закрыть поиск")} onClick={props.onClose} style={props.style} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-300 hover:text-white"><X size={21} /></button>
    </div>

  </motion.div>;
}

export function MessageSearchNavigation(props: Pick<Props, "query" | "count" | "index" | "busy" | "hasMore" | "failed" | "style" | "onMove"> & { desktop?: boolean }) {
  const t = useTranslation();
  const button = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:text-white disabled:opacity-30";
  return <div className="pointer-events-none flex min-h-11 w-full items-center">
    <AnimatePresence>{messageSearchNeedle(props.query) && <motion.div key="results" aria-label={t("Результаты поиска")} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.16 }} className="pointer-events-none flex w-full items-center justify-between gap-3">
      <span aria-live="polite" style={props.style} className="flex h-9 min-w-[76px] max-w-[calc(100%-100px)] items-center justify-center rounded-full px-3 text-center text-[12px] tabular-nums text-zinc-300">{props.failed ? t("Не удалось загрузить историю") : props.count ? `${props.index + 1} / ${props.count}${props.hasMore ? "+" : ""}` : props.busy || props.hasMore ? t("Поиск…") : t("Не найдено")}</span>
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
      <button type="button" className={button} style={props.style} aria-label={t("Следующее совпадение")} disabled={!props.count} onClick={() => props.onMove(-1)}><ChevronDown size={18} /></button>
      <button type="button" className={button} style={props.style} aria-label={t("Предыдущее совпадение")} disabled={!props.count} onClick={() => props.onMove(1)}><ChevronUp size={18} /></button>
      </div>
    </motion.div>}</AnimatePresence>
  </div>;
}
