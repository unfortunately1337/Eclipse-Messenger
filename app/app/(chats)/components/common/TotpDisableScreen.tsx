"use client";

import type { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { MonkeyPasswordAnimation } from "@/components/auth/AuthAnimation";
import { useTranslation } from "@/components/LocaleProvider";
import { Spinner } from "@/components/ui/spinner";

export function TotpDisableScreen({ password, showPassword, loading, error, onPasswordChange, onTogglePassword, onSubmit }: {
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  onPasswordChange: (password: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const t = useTranslation();
  return <div data-totp-disable-screen className="flex min-h-[min(560px,calc(100dvh-100px))] flex-col items-center justify-center px-6 py-8 text-center">
    <MonkeyPasswordAnimation hasPassword={password.length > 0} showPassword={showPassword} size={120} />
    <h3 className="mt-4 text-[18px] font-semibold tracking-tight text-white">{t("Отключить 2FA")}</h3>
    <p className="mt-2 max-w-[290px] text-[13px] leading-5 text-zinc-400">{t("Для отключения защиты подтвердите ваш текущий пароль")}</p>
    <form onSubmit={onSubmit} className="mt-6 w-full max-w-[360px] space-y-4 text-left">
      <div className="relative flex items-center rounded-[18px] border border-white/[0.08] px-4 py-3.5 transition-colors focus-within:border-[var(--ui-accent-solid,#38bdf8)]">
        <input type={showPassword ? "text" : "password"} value={password} onChange={event => onPasswordChange(event.target.value)}
          placeholder={t("Текущий пароль")} aria-label={t("Текущий пароль")} autoComplete="current-password" autoFocus disabled={loading}
          className="w-full bg-transparent pr-9 text-[15px] text-white outline-none placeholder:text-zinc-500 disabled:opacity-60" />
        <button type="button" onClick={onTogglePassword} aria-label={t(showPassword ? "Скрыть пароль" : "Показать пароль")}
          className="absolute right-2 grid size-10 cursor-pointer place-items-center rounded-full text-zinc-400 transition-colors hover:text-white">
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p role="alert" className="px-1 text-[13px] text-red-400">{t(error)}</p>}
      <button type="submit" disabled={loading || !password} className="flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-white text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-40">
        {loading ? <Spinner className="size-4 animate-spin" /> : t("Отключить")}
      </button>
    </form>
  </div>;
}
