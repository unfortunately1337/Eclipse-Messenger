"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { InlineEmoji } from "@/components/InlineEmoji";
import { AVAILABLE_REACTIONS, normalizeReaction, type ReactionMode } from "@/lib/reaction-policy";

const names = ["Сердце", "Палец вверх", "Палец вниз", "Огонь", "Смех до слёз", "Улыбка с сердцами", "Плач", "Злость", "Аплодисменты", "Праздник", "Какашка", "Сложенные ладони", "Крик", "Размышление", "Влюблённость", "Звёзды в глазах", "Круто", "Взрыв мозга", "Вечеринка", "Сияющая улыбка", "Улыбка с каплей пота", "Кататься от смеха", "Улыбка", "Подмигивание", "Воздушный поцелуй", "Объятия", "Тише", "Без эмоций", "Ухмылка", "Неловкая улыбка", "Удивление", "Грусть", "Сон", "Тошнота", "Жарко", "Холодно", "Сто баллов", "След поцелуя", "Призрак"];
export function reactionModeLabel(mode?: string) {
  return mode === "some" ? "Выбранные реакции" : mode === "none" ? "Без реакций" : "Все реакции";
}

export function CommunityReactionsPanel({ mode, selected, disabled, onModeChange, onSelectionChange }: {
  mode: ReactionMode; selected: string[]; disabled: boolean;
  onModeChange: (mode: ReactionMode) => void; onSelectionChange: (emojis: string[]) => void;
}) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const chosen = new Set(selected.map(normalizeReaction));
  return <div className="space-y-4 px-4 pb-8 pt-4" data-community-reactions>
    <p className="px-4 text-[13px] font-medium text-zinc-400">{t("Доступные реакции")}</p>
    <div role="radiogroup" aria-label={t("Доступные реакции")} className="rounded-[24px] bg-white/[0.04] p-1">
      {(["all", "some", "none"] as const).map(value => <button key={value} type="button" role="radio" aria-checked={mode === value} disabled={disabled} onClick={() => onModeChange(value)}
        className="flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-[18px] px-4 py-4 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white/50 disabled:opacity-50">
        <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${mode === value ? "border-[var(--ui-accent-solid,#38bdf8)]" : "border-zinc-500"}`}><span className={`size-2.5 rounded-full bg-[var(--ui-accent-solid,#38bdf8)] transition-transform ${mode === value ? "scale-100" : "scale-0"}`} /></span>
        <span className="text-[15px] font-medium text-zinc-100">{t(reactionModeLabel(value))}</span>
      </button>)}
    </div>
    <p className="px-4 text-[13px] leading-5 text-zinc-400">{t(mode === "some" ? "Участники смогут использовать только выбранные реакции." : mode === "none" ? "В этом чате нельзя добавлять реакции к сообщениям." : "Участники могут использовать все доступные реакции.")}</p>
    <AnimatePresence initial={false}>
      {mode === "some" && <motion.div key="selection" initial={{opacity:0,height:reduced?"auto":0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:reduced?"auto":0}} transition={{duration:reduced?0:.2}} className="space-y-3 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4"><p className="text-[13px] font-medium text-zinc-400">{t("Разрешённые реакции")}</p><span className="text-[12px] text-zinc-500">{selected.length}/{AVAILABLE_REACTIONS.length}</span></div>
        <div className="rounded-[24px] bg-white/[0.04] p-1">
          <button type="button" disabled={disabled} onClick={() => onSelectionChange(chosen.size === AVAILABLE_REACTIONS.length ? [] : [...AVAILABLE_REACTIONS])} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[18px] px-4 text-[14px] font-medium text-[var(--ui-accent-solid,#38bdf8)] hover:bg-white/[0.06]">{t(chosen.size === AVAILABLE_REACTIONS.length ? "Снять выбор" : "Выбрать все")}</button>
          {AVAILABLE_REACTIONS.map((emoji,index) => {
            const checked = chosen.has(normalizeReaction(emoji));
            return <button key={emoji} type="button" role="checkbox" aria-checked={checked} aria-label={t(names[index])} disabled={disabled} onClick={() => onSelectionChange(checked ? selected.filter(item => normalizeReaction(item) !== normalizeReaction(emoji)) : [...selected,emoji])}
              className="flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-[18px] px-4 py-3 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white/50 disabled:opacity-50">
              <InlineEmoji emoji={emoji} size={28}/><span className="min-w-0 flex-1 text-[14px] font-medium text-zinc-100">{t(names[index])}</span>
              <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-[6px] border-2 transition-colors ${checked ? "border-transparent bg-[var(--ui-accent-solid,#38bdf8)] text-[var(--ui-accent-contrast,#fff)]" : "border-zinc-600"}`}>{checked && <Check size={14} strokeWidth={3}/>}</span>
            </button>;
          })}
        </div>
        {selected.length === 0 && <p role="status" className="px-4 text-[13px] text-zinc-400">{t("Выберите хотя бы одну реакцию")}</p>}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
