"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { ReactNode, useId, useRef, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_EASE } from "@/lib/client/panel-motion";

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
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [open]);

  return (
    <AnimatePresence propagate>
      {open ? (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex }}
        >
          <motion.button
            type="button"
            className={cn("absolute inset-0 bg-black/40", backdropClassName)}
            onClick={() => onOpenChange(false)}
            aria-label={t("Закрыть")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.16, ease: PANEL_EASE }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            ref={dialogRef}
            tabIndex={-1}
            data-confirmation-dialog
            className="app-panel-surface relative w-full max-w-[384px] rounded-[26px] bg-[#212121] p-6 text-left text-white outline-none"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: reducedMotion ? 0 : 0.18, ease: PANEL_EASE } }}
            exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.98, transition: { duration: reducedMotion ? 0 : 0.13, ease: PANEL_EASE } }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.stopPropagation(); onOpenChange(false); }
              if (event.key !== "Tab") return;
              const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
              if (!controls?.length) { event.preventDefault(); return; }
              const first = controls[0], last = controls[controls.length - 1];
              if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
              else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
            }}
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

            <h3 id={titleId} className="text-[20px] font-semibold leading-6 tracking-[-0.01em] text-white">{title}</h3>
            {description ? <div id={descriptionId} className="mt-5 text-[16px] font-normal leading-6 text-white/90">{description}</div> : null}

            {details ? <div className="mt-4">{details}</div> : null}

            <div className="mt-5 -mr-2 -mb-2 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="min-h-10 rounded-xl px-3 text-[14px] font-semibold uppercase tracking-[0.01em] text-[var(--ui-accent-solid,#c4b5fd)] transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onAction}
                disabled={actionDisabled}
                className={cn(
                  "min-h-10 rounded-xl px-3 text-[14px] font-semibold uppercase tracking-[0.01em] text-red-400 transition-colors hover:bg-white/[0.05] hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
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
