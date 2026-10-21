'use client'
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/client/http";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

type EmailMigrationGateProps = {
  email?: string | null;
  verified?: boolean | null;
};

export default function EmailMigrationGate({ email, verified }: EmailMigrationGateProps) {
  const t = useTranslation();
  const [value, setValue] = useState(email ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => value.trim().toLowerCase(), [value]);

  if (verified) return null;

  async function sendCode() {
    if (!normalizedEmail || loading) return;
    setError(null);
    setLoading(true);
    try {
      await apiRequest("/api/auth/email/send", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setSent(true);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось отправить код"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ redirectTo?: string }>("/api/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, code }),
      });
      const target = data?.redirectTo || "/app";
      window.location.assign(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Неверный код"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl rounded-3xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <h2 className="text-2xl font-black text-center">{t("Логины были удалены из системы")}</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {t("Подтвердите свою почту, чтобы продолжить пользоваться аккаунтом. Вместо логинов мы сделали вход по email.")}</p>

        <div className="mt-8 grid gap-5">
          <div className="grid gap-2 w-full max-w-md">
            <label className="text-sm font-medium">Email</label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="email"
              placeholder={t("Электронная почта")}
              className="h-12"
            />
          </div>

          {sent ? (
            <div className="grid gap-4 w-full max-w-md">
              <InputOTP
                id="email-otp-gate"
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                value={code}
                onChange={(v) => setCode(v)}
                autoFocus
              >
                <InputOTPGroup className="flex w-full justify-center gap-3 flex-nowrap">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-10 rounded-[12px] border-0 border-none bg-white/[0.07] text-[18px] font-bold text-white transition-colors duration-200 hover:bg-white/[0.1] data-[active=true]:bg-white/[0.14] outline-none ring-0 ring-offset-0 focus:ring-0 focus-visible:ring-0 focus:outline-none data-[active=true]:ring-0 data-[active=true]:border-none shadow-none"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <Button
                onClick={() => void verifyCode()}
                disabled={code.length !== 6 || loading}
                className="w-full h-12 font-bold"
              >
                {loading ? t("Проверяем...") : t("Подтвердить email")}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => void sendCode()}
              disabled={!normalizedEmail || loading || cooldown > 0}
              className="w-full h-12 font-bold max-w-md"
            >
              {loading
                ? t("Отправляем код...")
                : cooldown > 0
                  ? t("Отправить снова ({0}с)", { 0: cooldown })
                  : t("Отправить код")}
            </Button>
          )}
        </div>

        {error ? <p className="mt-3 text-sm text-red-500">{t(error ?? "")}</p> : null}
      </div>
    </div>
  );
}
