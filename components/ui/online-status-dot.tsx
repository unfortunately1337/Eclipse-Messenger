"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { cn } from "@/lib/utils";

type OnlineStatusDotProps = {
  className?: string;
  title?: string;
};

export function OnlineStatusDot({ className, title = t("В сети") }: OnlineStatusDotProps) {
  const t = useTranslation();
  return (
    <span
      className={cn(
        "absolute block rounded-full bg-[#35d24f] ring-[1.5px] ring-white dark:ring-[#1c1c1e]",
        className,
      )}
      title={title}
      aria-label={title}
    />
  );
}
