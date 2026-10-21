"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import {
  consumePendingPassword,
  derivePasswordMasterKeyBase64,
  restoreE2EIdentityFromBackup,
  setActiveE2EUserId,
  storePasswordMasterKey,
} from "@/lib/client/e2e";
import { invalidateE2EServerStateCache } from "@/lib/client/e2e-server-sync";
import {
  AuthCard,
  AuthOtp,
  AuthPrimaryButton,
  AuthScreen,
  AuthStepIndicator,
} from "@/components/auth/auth-ui";

export default function MFAForm() {
  const t = useTranslation();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      const data = await apiRequest<{ redirectTo?: string }>("/api/auth/login/mfa", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      try {
        const pending = consumePendingPassword();
        if (pending) {
          invalidateE2EServerStateCache();
          const me = await apiRequest<{ id: string }>("/api/auth/me", { method: "GET" });
          setActiveE2EUserId(me.id);
          const master = await derivePasswordMasterKeyBase64(pending, me.id);
          storePasswordMasterKey(master);
          await restoreE2EIdentityFromBackup(master);
        }
      } catch {
        // Не блокируем вход из-за локального ключа.
      }
      window.location.assign(data.redirectTo || "/app");
    } catch (error) {
      showAppToast({ type: "error", title: error instanceof Error ? error.message : t("Ошибка подтверждения") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen>
      <AuthCard
        title={t("Подтверждение 2FA")}
        subtitle={t("Введите 6-значный код 2FA.")}
        onBack={() => router.replace("/login")}
      >
        <AuthStepIndicator currentStep={2} totalSteps={2} />

        <form className="space-y-5" onSubmit={submit}>
          <AuthOtp id="mfa-code" value={code} onChange={setCode} />
          <AuthPrimaryButton type="submit" loading={loading} disabled={code.length !== 6}>
            {t("Подтвердить")}</AuthPrimaryButton>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}
