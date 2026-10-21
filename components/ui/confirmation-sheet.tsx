"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_TRANSITION, panelOverlayMotion } from "@/lib/client/panel-motion";

type ConfirmationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  details?: ReactNode;
  actionLabel: ReactNode;
  actionIcon: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  onAction: () => void;
  cancelLabel?: ReactNode;
  actionDisabled?: boolean;
  actionClassName?: string;
  iconClassName?: string;
  backdropClassName?: string;
  zIndex?: number;
};

export function ConfirmationSheet({
  open,
  onOpenChange,
  title,
  description,
  details,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  cancelLabel = t("Отмена"),
  actionDisabled,
  actionClassName,
  iconClassName,
  backdropClassName,
  zIndex = 120,
}: ConfirmationSheetProps) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  const hasIcon = Boolean(iconClassName);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex }}
        >
          <motion.button
            type="button"
            className={cn("absolute inset-0 bg-black/64 backdrop-blur-[3px]", backdropClassName)}
            onClick={() => onOpenChange(false)}
            aria-label={t("Закрыть")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...PANEL_TRANSITION, duration: reducedMotion ? 0 : PANEL_TRANSITION.duration }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="app-panel-surface relative w-full max-w-[382px] rounded-[28px] bg-[#202020] px-7 py-6 text-left text-white shadow-[0_24px_80px_rgba(0,0,0,0.48)] ring-1 ring-white/[0.035] backdrop-blur-xl"
            {...panelOverlayMotion(reducedMotion, "bottom")}
            onClick={(event) => event.stopPropagation()}
          >
            {hasIcon ? (
              <span
                className={cn(
                  "mb-4 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] text-white",
                  iconClassName,
                )}
              >
                <ActionIcon size={22} />
              </span>
            ) : null}

            <h3 className="text-[20px] font-semibold leading-[1.22] tracking-[-0.01em] text-white">{title}</h3>
            {description ? <div className="mt-5 max-w-[30ch] text-[15px] font-normal leading-[1.48] text-white/70">{description}</div> : null}

            {details ? <div className="mt-4">{details}</div> : null}

            <div className="mt-7 flex items-center justify-end gap-6">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-[14px] font-semibold uppercase tracking-[0.01em] text-zinc-300 transition-colors hover:text-white"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onAction}
                disabled={actionDisabled}
                className={cn(
                  "text-[14px] font-semibold uppercase tracking-[0.01em] text-red-400 transition-colors hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-55",
                  actionClassName,
                )}
              >
                {actionLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
