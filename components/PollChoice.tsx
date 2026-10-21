"use client";

import { useEffect } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";

function Percentage({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const number = useMotionValue(0);
  const label = useTransform(number, current => `${Math.round(current)}%`);
  useEffect(() => {
    if (reduced) { number.set(value); return; }
    const controls = animate(number, value, { duration: 0.42, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [number, value, reduced]);
  return <motion.span className="block text-[12px] font-semibold tabular-nums leading-5">{label}</motion.span>;
}

export function PollChoice({ option, index, percentage, selected, correct, wrong, showResults, disabled, pending, isMine, onVote }: {
  option: string; index: number; percentage: number; selected: boolean; correct: boolean; wrong: boolean;
  showResults: boolean; disabled: boolean; pending: boolean; isMine: boolean; onVote: () => void;
}) {
  const reduced = useReducedMotion();
  const transition = { duration: reduced ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] as const };
  const color = correct ? "#34d399" : wrong ? "#fb7185" : isMine ? "currentColor" : "var(--ui-accent-solid, #80bfff)";
  return <motion.button data-poll-choice={index} layout="position" type="button" tabIndex={disabled ? -1 : 0} aria-label={option} aria-pressed={selected}
    disabled={disabled} onClick={onVote} whileTap={reduced || disabled ? undefined : { scale: 0.985 }} transition={transition}
    className="group grid w-full grid-cols-[32px_minmax(0,1fr)] items-start gap-2.5 rounded-[13px] px-1.5 py-2 text-left outline-none transition-colors hover:bg-current/[0.05] focus-visible:ring-2 focus-visible:ring-current/30 disabled:cursor-default disabled:hover:bg-transparent">
    <div className="relative grid min-h-5 place-items-center pt-px" style={{ color }}>
      <AnimatePresence initial={false} mode="popLayout">
        {showResults ? <motion.div key="percentage" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transition}>
          <Percentage value={percentage} />
        </motion.div> : <motion.span key="radio" initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.75 }} transition={transition}
          className="grid size-5 place-items-center rounded-full border-[1.5px] border-current/40 transition-colors group-hover:border-current/80">
          {pending && <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />}
        </motion.span>}
      </AnimatePresence>
    </div>
    <div className="min-w-0">
      <div className="flex min-h-5 items-start gap-2">
        <span className={`min-w-0 flex-1 break-words text-[14px] leading-5 ${selected || correct ? "font-medium" : "font-normal"}`}>{option}</span>
        <AnimatePresence initial={false}>
          {showResults && (selected || correct) && <motion.span key={wrong ? "wrong" : "selected"}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1, x: wrong && !reduced ? [0, -3, 3, -2, 0] : 0 }}
            exit={{ opacity: 0, scale: 0.5 }} transition={transition} style={{ color }} className="mt-0.5 shrink-0">
            {wrong ? <X size={16} strokeWidth={2.5} /> : <Check size={16} strokeWidth={2.5} />}
          </motion.span>}
        </AnimatePresence>
      </div>
      <motion.div aria-hidden initial={false} animate={{ height: showResults ? 4 : 0, marginTop: showResults ? 7 : 0, opacity: showResults ? 1 : 0 }} transition={transition}
        className="overflow-hidden rounded-full bg-current/[0.08]">
        <motion.div data-poll-result-bar initial={{ scaleX: 0 }} animate={{ scaleX: showResults ? percentage / 100 : 0 }}
          transition={{ duration: reduced ? 0 : 0.46, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: color, opacity: selected || correct || wrong ? 0.9 : 0.35, transformOrigin: "left" }} className="h-full w-full rounded-full" />
      </motion.div>
    </div>
  </motion.button>;
}
