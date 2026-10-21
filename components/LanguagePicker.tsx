"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "./LocaleProvider";
import { cn } from "@/lib/utils";

export function LanguagePicker({ auth = false }: { auth?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  const label = locale === "ru" ? "Язык" : "Language";
  return <div ref={root} data-language-picker className={cn("relative", auth && "absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-50 sm:right-6 sm:top-6")}>
    <button type="button" aria-label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}
      className={cn("flex cursor-pointer items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-zinc-100 transition-colors", auth ? "rounded-[18px] border-0 bg-[#14151b] hover:bg-[#202127]" : "app-panel-surface rounded-full border border-white/10 hover:bg-white/10")}>
      <Globe size={16} className="text-zinc-400" /><span>{locale === "ru" ? "Русский" : "English"}</span><ChevronDown size={13} className={cn("text-zinc-400 transition-transform duration-150", open && "rotate-180")} />
    </button>
    <AnimatePresence>{open && <motion.div role="menu" aria-label={label}
      initial={{ opacity: 0, y: reduceMotion ? 0 : -5, scale: reduceMotion ? 1 : 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -3, scale: reduceMotion ? 1 : 0.98 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn("absolute right-0 top-full z-50 mt-2 min-w-[160px] origin-top-right overflow-hidden p-1.5", auth ? "rounded-[22px] border-0 bg-[#14151b] shadow-[0_14px_36px_rgba(0,0,0,0.4)]" : "app-panel-surface rounded-[18px] border border-white/10 shadow-xl")}>
      {([['en', 'English'], ['ru', 'Русский']] as const).map(([value, name]) => <button key={value} type="button" role="menuitemradio" aria-checked={locale === value}
        onClick={() => { setLocale(value); setOpen(false); root.current?.querySelector('button')?.focus(); }}
        className={cn("flex w-full cursor-pointer items-center justify-between gap-5 rounded-[16px] px-3 py-2.5 text-left text-[13px] font-medium text-zinc-100 transition-colors hover:bg-white/[0.08] focus-visible:bg-white/[0.08] focus-visible:outline-none", locale === value && "bg-white/[0.07]")}>
        <span lang={value}>{name}</span>{locale === value && <Check size={15} />}
      </button>)}
    </motion.div>}</AnimatePresence>
  </div>;
}
