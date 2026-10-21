"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import { AuthGhostButton, AuthOtp, AuthPrimaryButton, maskEmail } from "@/components/auth/auth-ui";

interface StepThreeEmailProps {
  email: string;
  onVerified: () => void;
}

export const StepThreeEmail = ({ email, onVerified }: StepThreeEmailProps) => {
  const t = useTranslation();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoSentForEmailRef = useRef<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function sendCode(showToast = true) {
    if (!normalizedEmail || sending) return;
    setSending(true);
    try {
      await apiRequest("/api/auth/email/send", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setCooldown(60);
      if (showToast) {
        showAppToast({ type: "success", title: t("Код отправлен") });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Не удалось отправить код");
      if (message.includes("уже отправлен")) {
        setCooldown((value) => (value > 0 ? value : 60));
      }
      if (showToast) {
        showAppToast({ type: "error", title: message });
      }
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (verifying || code.length !== 6) return;
    setVerifying(true);
    try {
      const data = await apiRequest<{ redirectTo?: string }>("/api/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, code }),
      });
      if (data.redirectTo) {
        window.location.assign(data.redirectTo);
      } else {
        onVerified();
      }
    } catch (error) {
      showAppToast({ type: "error", title: error instanceof Error ? error.message : t("Неверный код") });
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (!normalizedEmail || autoSentForEmailRef.current === normalizedEmail) return;
    autoSentForEmailRef.current = normalizedEmail;
    void sendCode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-zinc-400">{t("Введите 6-значный код, который пришел на ")}{maskEmail(normalizedEmail)}.</p>
      <AuthOtp id="email-verify-code" value={code} onChange={setCode} />
      <AuthPrimaryButton disabled={code.length !== 6} loading={verifying} onClick={() => void verifyCode()}>
        {t("Подтвердить")}</AuthPrimaryButton>
      <div className="text-center">
        <AuthGhostButton disabled={sending || cooldown > 0} onClick={() => void sendCode()}>
          {sending ? t("Отправляем...") : cooldown > 0 ? t("Отправить снова ({0}с)", { 0: cooldown }) : t("Отправить код снова")}
        </AuthGhostButton>
      </div>
    </div>
  );
};
