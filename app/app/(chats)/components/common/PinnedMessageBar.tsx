"use client";

import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@/components/LocaleProvider";
import { pinIndicator } from "@/lib/message-pins";

export function PinnedMessageBar({ messageId, preview, count, index, busy, style, onClick }: {
  messageId: string; preview: ReactNode; count: number; index: number; busy: boolean;
  style: CSSProperties; onClick: () => void;
}) {
  const t = useTranslation(), reduced = useReducedMotion();
  const indicator = pinIndicator(count, index);
  return <motion.button type="button" data-pinned-message-bar data-pinned-message-id={messageId}
    aria-label={t("Перейти к закреплённому сообщению")} aria-busy={busy} disabled={busy}
    initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 44 }}
    exit={{ opacity: 0, y: -6, height: 0 }} transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
    onClick={onClick} style={{ ...style, border: 0, borderRadius: 999 }}
    className="pointer-events-auto relative mx-auto flex w-full max-w-[700px] items-center gap-2.5 overflow-hidden rounded-full px-4 text-left text-white active:scale-[0.995] disabled:cursor-wait">
    <span aria-hidden className="flex h-7 w-[3px] shrink-0 flex-col gap-[3px]" style={{ color: "var(--ui-accent-solid, #a1a1aa)" }}>
      {Array.from({ length: indicator.segments }, (_, segment) => <motion.span key={segment} data-pin-segment
        animate={{ opacity: segment === indicator.active ? 1 : 0.3 }} transition={{ duration: reduced ? 0 : 0.2 }}
        className="min-h-0 w-full flex-1 rounded-full bg-current" />)}
    </span>
    <span className="relative min-w-0 flex-1 overflow-hidden">
      <span className="block truncate text-[11px] font-semibold leading-[15px]" style={{ color: "var(--ui-accent-solid, #d4d4d8)" }}>{t("Закреплённое сообщение")}</span>
      <span className="relative block h-[19px] overflow-hidden text-[12.5px] leading-[19px] text-zinc-100 md:text-[13px]">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={messageId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: reduced ? 0 : 0.2 }} className="block w-full truncate">{preview}</motion.span>
        </AnimatePresence>
      </span>
    </span>
  </motion.button>;
}
