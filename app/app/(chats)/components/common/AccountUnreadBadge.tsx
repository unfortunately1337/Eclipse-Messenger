"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { formatAccountUnreadCount } from "@/lib/client/account-unread";

export function AccountUnreadBadge({ accountId, count, placement = "inline" }: { accountId: string; count?: number; placement?: "inline" | "corner" | "arrow" }) {
  const t = useTranslation();
  const label = formatAccountUnreadCount(count);
  if (!label) return null;
  return <span data-account-unread={accountId} aria-label={t("Непрочитанных сообщений: {0}", { 0: count })}
    className={placement !== "inline"
      ? `pointer-events-none absolute z-10 grid h-4 min-w-4 place-items-center rounded-full bg-zinc-600 px-1 text-[9px] font-semibold tabular-nums leading-none text-white ${placement === "arrow" ? "-right-1 -top-0.5" : "right-0.5 top-1 ring-2 ring-[#18181c]"}`
      : "ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-white/[0.14] px-1.5 text-[11px] font-semibold tabular-nums leading-none text-zinc-100"}>
    {label}
  </span>;
}
