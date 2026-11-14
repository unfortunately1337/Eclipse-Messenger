"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { type CSSProperties, ReactNode, useId, useRef, useEffect, useSyncExternalStore } from "react";
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
  cancelClassName?: string;
  footerClassName?: string;
  iconClassName?: string;
  backdropClassName?: string;
  zIndex?: number;
  mobileSheet?: boolean;
  dialogStyle?: CSSProperties;
  hideCancel?: boolean;
  hideTitle?: boolean;
};

const desktopSnapshot = () => false;
const noSubscription = () => () => {};
const mobileSnapshot = () => window.matchMedia("(max-width: 767px)").matches;
function subscribeMobile(change: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

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
  cancelClassName,
  footerClassName,
  iconClassName,
  backdropClassName,
  zIndex = 120,
  mobileSheet = false,
  dialogStyle,
  hideCancel = false,
  hideTitle = false,
}: ConfirmationSheetProps) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  const fromBottom = useSyncExternalStore(mobileSheet ? subscribeMobile : noSubscription, mobileSheet ? mobileSnapshot : desktopSnapshot, desktopSnapshot);
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
          className={mobileSheet ? "fixed inset-0 flex items-end justify-center md:items-center md:p-4" : "fixed inset-0 flex items-center justify-center p-4"}
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
            data-mobile-sheet={fromBottom || undefined}
            style={dialogStyle}
            className={cn("app-panel-surface relative w-full bg-[#212121] p-6 text-left text-white outline-none", mobileSheet ? "max-w-none rounded-t-[28px] pb-[calc(24px+env(safe-area-inset-bottom))] md:max-w-[384px] md:rounded-[26px] md:pb-6" : "max-w-[384px] rounded-[26px]")}
            initial={{ opacity: fromBottom ? 1 : 0, y: fromBottom && !reducedMotion ? "100%" : 0, scale: fromBottom || reducedMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: reducedMotion ? 0 : fromBottom ? 0.24 : 0.18, ease: PANEL_EASE } }}
            exit={{ opacity: fromBottom ? 1 : 0, y: fromBottom && !reducedMotion ? "100%" : 0, scale: fromBottom || reducedMotion ? 1 : 0.98, transition: { duration: reducedMotion ? 0 : fromBottom ? 0.2 : 0.13, ease: PANEL_EASE } }}
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

            <h3 id={titleId} className={hideTitle ? "sr-only" : "text-[20px] font-semibold leading-6 tracking-[-0.01em] text-white"}>{title}</h3>
            {description ? <div id={descriptionId} className="mt-5 text-[16px] font-normal leading-6 text-white/90">{description}</div> : null}

            {details ? <div className={hideTitle ? undefined : "mt-4"}>{details}</div> : null}

            <div className={cn("mt-5 -mr-2 -mb-2 flex flex-wrap items-center justify-end gap-2", footerClassName)}>
              {!hideCancel && <button
                type="button"
                onClick={() => onOpenChange(false)}
                className={cn("min-h-10 rounded-xl px-3 text-[14px] font-semibold uppercase tracking-[0.01em] text-[var(--ui-accent-solid,#c4b5fd)] transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2", cancelClassName)}
              >
                {cancelLabel}
              </button>}
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
