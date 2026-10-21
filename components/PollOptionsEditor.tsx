"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Plus, X } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";

export function PollOptionsEditor({ options, onChange, quizMode, correctIndex, onCorrectIndexChange }: {
  options: string[];
  onChange: (options: string[]) => void;
  quizMode: boolean;
  correctIndex: number | null;
  onCorrectIndexChange: (index: number | null) => void;
}) {
  const t = useTranslation();
  const prefix = useId();
  const [ids, setIds] = useState(() => options.map((_, index) => `${prefix}-${index}`));
  const nextId = useRef(options.length);
  const focusId = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const transition = { duration: reduced ? 0 : 0.23, ease: [0.16, 1, 0.3, 1] as const };

  useLayoutEffect(() => {
    if (!focusId.current) return;
    const input = list.current?.querySelector<HTMLInputElement>(`[data-poll-option-id="${CSS.escape(focusId.current)}"] input`);
    input?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => input?.scrollIntoView({ block: "nearest", behavior: reduced ? "instant" : "smooth" }));
    focusId.current = null;
    return () => cancelAnimationFrame(frame);
  }, [ids, reduced]);

  function add() {
    if (options.length >= 10) return;
    const id = `${prefix}-${nextId.current++}`;
    focusId.current = id;
    setIds(previous => [...previous, id]);
    onChange([...options, ""]);
  }

  function remove(index: number) {
    if (options.length <= 2) return;
    setIds(previous => previous.filter((_, i) => i !== index));
    onChange(options.filter((_, i) => i !== index));
    if (correctIndex === index) onCorrectIndexChange(null);
    else if (correctIndex !== null && correctIndex > index) onCorrectIndexChange(correctIndex - 1);
  }

  return <div data-poll-options-editor className="min-w-0">
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{t("Варианты ответа")}</span>
      <span className="text-[11px] tabular-nums text-zinc-500">{options.length}/10</span>
    </div>
    <div ref={list} className="max-h-[220px] overflow-y-auto overscroll-contain no-scrollbar">
      <AnimatePresence initial={false}>
        {options.map((option, index) => <motion.div key={ids[index]} data-poll-option-id={ids[index]}
          layout="position" initial={{ height: 0, opacity: 0, y: -6 }} animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -4, pointerEvents: "none" }} transition={transition} className="overflow-hidden">
          <div className="flex min-h-11 items-center gap-2 pb-2">
            <AnimatePresence initial={false}>
              {quizMode && <motion.button key="correct" type="button" aria-label={`${t("Выбрать как правильный")}: ${index + 1}`}
                aria-pressed={correctIndex === index} onClick={() => onCorrectIndexChange(correctIndex === index ? null : index)}
                initial={{ width: 0, opacity: 0 }} animate={{ width: 24, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={transition}
                className={`grid size-6 shrink-0 place-items-center rounded-full border transition-colors ${correctIndex === index ? "border-emerald-400 bg-emerald-400 text-zinc-950" : "border-white/20 text-transparent hover:border-white/40"}`}>
                <Check size={14} strokeWidth={3} />
              </motion.button>}
            </AnimatePresence>
            <input type="text" aria-label={t("Вариант {0}", { 0: index + 1 })} placeholder={t("Вариант {0}", { 0: index + 1 })}
              value={option} maxLength={100} onChange={event => onChange(options.map((value, i) => i === index ? event.target.value : value))}
              className="h-11 min-w-0 flex-1 rounded-[14px] border border-white/[0.07] bg-white/[0.04] px-3.5 text-[13.5px] text-white outline-none transition-colors placeholder:text-zinc-500 hover:border-white/12 focus:border-[var(--ui-accent-solid,#38bdf8)] focus:bg-white/[0.06]" />
            {options.length > 2 && <button type="button" aria-label={`${t("Удалить")} ${t("Вариант {0}", { 0: index + 1 })}`} onClick={() => remove(index)}
              className="grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-red-400/10 hover:text-red-400"><X size={16} /></button>}
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
    <motion.button layout="position" type="button" onClick={add} disabled={options.length >= 10} transition={transition}
      className="mt-1 flex h-10 w-full items-center gap-2.5 rounded-[14px] px-3.5 text-left text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-30">
      <Plus size={18} className="shrink-0" /><span>{t("Добавить вариант")}</span>
    </motion.button>
  </div>;
}
