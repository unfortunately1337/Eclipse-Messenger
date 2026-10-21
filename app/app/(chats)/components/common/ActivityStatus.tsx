import React, { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ActivityIndicatorKind } from "../../types";

export function ActivityStatusIndicator({
  kind,
  className,
  isEcli = false,
}: {
  kind: ActivityIndicatorKind;
  className?: string;
  isEcli?: boolean;
}) {
  if (kind === "typing") {
    return (
      <span className={cn("inline-flex h-[1em] items-center gap-0.5 align-middle text-current", className)} aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="block size-1 rounded-full bg-current/85 animate-pulse"
            style={{
              animationDelay: `${index * 0.18}s`,
              animationDuration: "0.95s",
              transform: "translateY(0px)",
            } satisfies CSSProperties}
          />
        ))}
      </span>
    );
  }

  if (isEcli) {
    return (
      <span
        className={cn(
          "inline-block size-1.5 align-middle rounded-full bg-white/70 animate-pulse",
          className,
        )}
        style={{ animationDuration: "1.4s" } satisfies CSSProperties}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={cn("inline-block size-1 align-middle rounded-full bg-current/85 animate-pulse", className)}
      style={{ animationDuration: "1.05s" } satisfies CSSProperties}
      aria-hidden="true"
    />
  );
}

export function ActivityStatusLabel({
  kind,
  text,
  className,
  isEcli = false,
}: {
  kind: ActivityIndicatorKind;
  text: string;
  className?: string;
  balanced?: boolean;
  isEcli?: boolean;
}) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 truncate text-[14px] font-medium leading-5 text-zinc-500 dark:text-zinc-400", className)}>
      <ActivityStatusIndicator kind={kind} className="shrink-0" isEcli={isEcli} />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function SmoothStatusLine({
  text,
  kind,
  className,
  labelClassName,
  align = "left",
  isEcli = false,
}: {
  text: string;
  kind?: ActivityIndicatorKind | null;
  className?: string;
  labelClassName?: string;
  align?: "left" | "center";
  isEcli?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 max-w-full items-center overflow-hidden", className, align === "center" ? "justify-center text-center" : "justify-start text-left")}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${kind ?? "status"}:${text}`}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className={cn(
            "inline-flex min-w-0 max-w-full items-center",
            align === "center" ? "justify-center text-center" : "justify-start text-left",
          )}
        >
          {kind ? (
            <ActivityStatusLabel
              kind={kind}
              text={text}
              className={cn("text-[11px] leading-none", labelClassName)}
              isEcli={isEcli}
            />
          ) : (
            <span className={cn("block max-w-full truncate text-[11px] leading-none", labelClassName)}>{text}</span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
