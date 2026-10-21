"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import type { FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getStrength } from "@/app/sign-up/PasswordStrength";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import {
  AuthCard,
  AuthField,
  AuthIconButton,
  AuthPrimaryButton,
  AuthScreen,
  LockKeyGifAnimation,
  maskEmail,
} from "@/components/auth/auth-ui";

export default function ResetPasswordForm() {
  const t = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const passwordPolicyOk = useMemo(
    () => password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password),
    [password],
  );
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const formValid = passwordPolicyOk && passwordsMatch && getStrength(password) >= 2;

  useEffect(() => {
    let alive = true;

    async function loadState() {
      try {
        const data = await apiRequest<{ ready: boolean; email?: string }>("/api/auth/password-reset/state", {
          method: "GET",
        });
        if (!alive) return;
        if (!data.ready) {
          router.replace("/login");
          return;
        }
        setEmail(data.email ?? "");
      } catch {
        if (alive) {
          router.replace("/login");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadState();
    return () => {
      alive = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValid || saving) return;
    setSaving(true);
    try {
      const data = await apiRequest<{ redirectTo?: string }>("/api/auth/password-reset/complete", {
        method: "POST",
        body: JSON.stringify({ password, confirmPassword }),
      });
      window.location.assign(data.redirectTo || "/login");
    } catch (error) {
      showAppToast({ type: "error", title: error instanceof Error ? error.message : t("Не удалось обновить пароль") });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AuthScreen>{null}</AuthScreen>;
  }

  return (
    <AuthScreen>
      <AuthCard
        icon={<LockKeyGifAnimation size={135} />}
        title={t("Новый пароль")}
        subtitle={email ? t("Для аккаунта {0}", { 0: maskEmail(email) }) : t("Установите новый надежный пароль")}
      >
        <form className="space-y-4" onSubmit={submit}>
          <AuthField
            id="new-password"
            label={t("Новый пароль")}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            autoFocus
            placeholder={t("Минимум 10 символов")}
            right={
              <AuthIconButton label={t("Показать пароль")} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </AuthIconButton>
            }
          />
          <AuthField
            id="confirm-new-password"
            label={t("Повторите пароль")}
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={t("Еще раз пароль")}
            right={
              <AuthIconButton label={t("Показать пароль")} onClick={() => setShowConfirmPassword((value) => !value)}>
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </AuthIconButton>
            }
          />
          {confirmPassword && !passwordsMatch ? <p className="text-sm text-red-400">{t("Пароли не совпадают")}</p> : null}
          <AuthPrimaryButton type="submit" loading={saving} disabled={!formValid}>
            {t("Сохранить пароль")}</AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}
