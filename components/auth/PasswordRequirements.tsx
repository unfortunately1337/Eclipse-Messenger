"use client";

import { Check } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { cn } from "@/lib/utils";

export function PasswordRequirements({ hasLength, hasUppercase, hasLowercase, hasNumber }: {
  hasLength: boolean; hasUppercase: boolean; hasLowercase: boolean; hasNumber: boolean;
}) {
  const t = useTranslation();
  const rules = [
    { label: "От 10 символов", met: hasLength },
    { label: "Заглавная (A-Z)", met: hasUppercase },
    { label: "Строчная (a-z)", met: hasLowercase },
    { label: "Цифра (0-9)", met: hasNumber },
  ];
  return <section data-password-requirements aria-label={t("Требования к паролю:")} className="space-y-3 px-1 py-2 text-left">
    <div aria-hidden="true" className="flex gap-1.5">{rules.map(rule => <span key={rule.label} className={cn("h-1 flex-1 rounded-full transition-colors duration-150", rule.met ? "bg-emerald-400/80" : "bg-white/10")} />)}</div>
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5">{rules.map(rule => <li key={rule.label} data-met={rule.met} className={cn("flex min-w-0 items-center gap-2 text-[12px] leading-4 transition-colors duration-150", rule.met ? "text-emerald-300" : "text-zinc-400")}>
      <span aria-hidden="true" className={cn("grid size-4 shrink-0 place-items-center rounded-full transition-colors duration-150", rule.met ? "bg-emerald-400/15" : "bg-white/[0.06]")}>
        {rule.met ? <Check size={11} strokeWidth={2.5} /> : <span className="size-1 rounded-full bg-zinc-500" />}
      </span>
      <span>{t(rule.label)}<span className="sr-only"> — {t(rule.met ? "Выполнено" : "Не выполнено")}</span></span>
    </li>)}</ul>
  </section>;
}
