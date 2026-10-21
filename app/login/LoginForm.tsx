"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";
import QRCode from "qrcode";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import {
  clearPendingPassword,
  consumePendingPassword,
  derivePasswordMasterKeyBase64,
  restoreE2EIdentityFromBackup,
  setActiveE2EUserId,
  storePasswordMasterKey,
  storePendingPassword,
} from "@/lib/client/e2e";
import { createQrKeySecret, restoreQrKeyTransfer } from "@/lib/client/e2e-qr-transfer";
import type { QrKeyTransfer } from "@/lib/qr-key-transfer";
import { invalidateE2EServerStateCache } from "@/lib/client/e2e-server-sync";
import {
  AuthAddAccountBanner,
  AuthCard,
  AuthField,
  AuthIconButton,
  AuthOtp,
  AuthPrimaryButton,
  AuthScreen,
  authStepMotion,
  LockKeyGifAnimation,
  MonkeyPasswordAnimation,
  MonkeyTrackingAnimation,
  CodeMessageAnimation,
  maskEmail,
} from "@/components/auth/auth-ui";

type Step = "qr" | "email" | "password" | "mfa" | "forgot-email" | "forgot-code";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QR_EXPIRY_MS = 30000; // 30 seconds auto-refresh matching Telegram Web

function renderQrToCanvas(canvas: HTMLCanvasElement, token: string): boolean {
  try {
    const context = canvas.getContext("2d");
    if (!context) return false;
    const canvasSize = 512;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const qr = QRCode.create(token, { errorCorrectionLevel: "M" });
    const { size, data: modulesData } = qr.modules;
    const moduleSize = canvasSize / size;

    context.clearRect(0, 0, canvasSize, canvasSize);
    context.fillStyle = "#ffffff";

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const isDark = modulesData[r * size + c] === 1;
        if (!isDark) continue;

        const isTopLeftFinder = r < 7 && c < 7;
        const isTopRightFinder = r < 7 && c >= size - 7;
        const isBottomLeftFinder = r >= size - 7 && c < 7;
        if (isTopLeftFinder || isTopRightFinder || isBottomLeftFinder) {
          continue;
        }

        const cx = c * moduleSize + moduleSize / 2;
        const cy = r * moduleSize + moduleSize / 2;
        context.beginPath();
        context.arc(cx, cy, (moduleSize / 2) * 0.82, 0, 2 * Math.PI);
        context.fill();
      }
    }

    const drawFinderPattern = (startX: number, startY: number) => {
      const w = 7 * moduleSize;
      const h = 7 * moduleSize;
      const radius = 1.6 * moduleSize;

      context.fillStyle = "#ffffff";
      context.beginPath();
      if (typeof context.roundRect === "function") {
        context.roundRect(startX, startY, w, h, radius);
      } else {
        context.rect(startX, startY, w, h);
      }
      context.fill();

      context.fillStyle = "#000000";
      context.beginPath();
      if (typeof context.roundRect === "function") {
        context.roundRect(
          startX + moduleSize,
          startY + moduleSize,
          w - 2 * moduleSize,
          h - 2 * moduleSize,
          radius * 0.75
        );
      } else {
        context.rect(startX + moduleSize, startY + moduleSize, w - 2 * moduleSize, h - 2 * moduleSize);
      }
      context.fill();

      context.fillStyle = "#ffffff";
      context.beginPath();
      if (typeof context.roundRect === "function") {
        context.roundRect(
          startX + 2 * moduleSize,
          startY + 2 * moduleSize,
          w - 4 * moduleSize,
          h - 4 * moduleSize,
          radius * 0.45
        );
      } else {
        context.rect(startX + 2 * moduleSize, startY + 2 * moduleSize, w - 4 * moduleSize, h - 4 * moduleSize);
      }
      context.fill();
    };

    drawFinderPattern(0, 0); // Top-Left
    drawFinderPattern((size - 7) * moduleSize, 0); // Top-Right
    drawFinderPattern(0, (size - 7) * moduleSize); // Bottom-Left
    return true;
  } catch (err) {
    console.error("renderQrToCanvas error:", err);
    return false;
  }
}

export default function LoginForm({ isAddingAccount = false }: { isAddingAccount?: boolean }) {
  const t = useTranslation();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<Step>("email");
  const initialViewportChosen = useRef(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isAddingAccount) {
      document.cookie = "eclipse.add_account=1; path=/; max-age=900; SameSite=Lax";
    }
  }, [isAddingAccount]);

  const handleCancelAddAccount = () => {
    document.cookie = "eclipse.add_account=; path=/; max-age=0; SameSite=Lax";
    window.location.assign("/app");
  };

  useEffect(() => {
    if (initialViewportChosen.current || isMobile === undefined) return;
    initialViewportChosen.current = true;
    setStep(isMobile ? "email" : "qr");
  }, [isMobile]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailErrorGlow, setEmailErrorGlow] = useState(false);
  const [passwordErrorGlow, setPasswordErrorGlow] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eclipse:signup-state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step === 4 || parsed.step === 5) {
          window.location.assign("/sign-up");
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step !== "qr") {
      setQrToken(null);
      setQrVisible(false);
      return;
    }

    let active = true;
    let refreshTimer: NodeJS.Timeout | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let retryFrameId: number | null = null;
    let currentToken: string | null = null;
    let currentSecret: string | null = null;
    let completing = false;

    const drawToken = (token: string): boolean => {
      const canvas = qrCanvasRef.current;
      if (!canvas) return false;
      const ok = renderQrToCanvas(canvas, token);
      if (ok && active) {
        setQrVisible(true);
      }
      return ok;
    };

    const drawWithRetry = (token: string, attempts = 0) => {
      if (!active) return;
      if (drawToken(token)) return;
      if (attempts < 25) {
        retryFrameId = requestAnimationFrame(() => {
          setTimeout(() => drawWithRetry(token, attempts + 1), 25);
        });
      }
    };

    const pollStatus = async (token: string) => {
      if (!active || currentToken !== token || completing) return;
      const transferSecret = currentSecret;
      try {
        const statusData = await apiRequest<{ status: string; userId?: string; keyTransfer?: QrKeyTransfer }>("/api/auth/qr/status", {
          method: "POST",
          body: JSON.stringify({ qrToken: token }),
        });
        if (!active || currentToken !== token) return;

        if (statusData.status === "approved") {
          completing = true;
          // Freeze refresh while transferring keys so the matching secret is retained.
          if (refreshTimer) clearTimeout(refreshTimer);
          const me = await apiRequest<{ id: string }>("/api/auth/me", { method: "GET" });
          if (statusData.userId && me.id !== statusData.userId) throw new Error("QR account mismatch");
          if (statusData.keyTransfer && transferSecret) {
            await restoreQrKeyTransfer(token, transferSecret, statusData.keyTransfer, me.id);
          } else {
            setActiveE2EUserId(me.id);
          }
          invalidateE2EServerStateCache();
          window.localStorage.setItem("eclipse:cache:self-profile:last:v2", me.id);
          document.cookie = `eclipse.active_user_id=${encodeURIComponent(me.id)}; path=/; max-age=2592000; SameSite=Lax`;
          showAppToast({ type: "success", title: t("Успешный вход"), icon: "laptop-check" });
          window.location.assign("/app");
          return;
        } else if (statusData.status === "expired") {
          if (active && currentToken === token) {
            void generateAndDisplayQr(true);
          }
          return;
        }
      } catch (err) {
        console.error("Failed to check QR login status:", err);
        if (completing) {
          showAppToast({ type: "error", title: t("Не удалось восстановить ключи. Войдите по паролю или попробуйте QR-код снова.") });
          setStep("email");
          return;
        }
      }

      if (active && currentToken === token) {
        pollTimer = setTimeout(() => pollStatus(token), 1500);
      }
    };

    const generateAndDisplayQr = async (isRefresh = false) => {
      if (!active || completing) return;

      if (isRefresh) {
        setQrVisible(false);
        await new Promise((resolve) => setTimeout(resolve, 260));
        if (!active) return;
      }

      try {
        const data = await apiRequest<{ qrToken: string }>("/api/auth/qr/generate", {
          method: "POST",
        });
        if (!active) return;

        if (completing) return;
        currentToken = data.qrToken;
        currentSecret = createQrKeySecret();
        setQrToken(data.qrToken);

        drawWithRetry(`eclipse://login?token=${data.qrToken}#key=${currentSecret}`);

        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = setTimeout(() => pollStatus(data.qrToken), 1000);

        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          void generateAndDisplayQr(true);
        }, QR_EXPIRY_MS);
      } catch (err) {
        console.error("Failed to generate QR token:", err);
        if (active) {
          refreshTimer = setTimeout(() => void generateAndDisplayQr(isRefresh), 3000);
        }
      }
    };

    void generateAndDisplayQr(false);

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (retryFrameId) cancelAnimationFrame(retryFrameId);
    };
  }, [step, t]);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailValid = EMAIL_REGEX.test(normalizedEmail);

  async function restoreMasterKey(secret: string) {
    try {
      invalidateE2EServerStateCache();
      const me = await apiRequest<{ id: string }>("/api/auth/me", { method: "GET" });
      setActiveE2EUserId(me.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("eclipse:active-user-id", me.id);
        window.localStorage.setItem("eclipse:cache:self-profile:last:v2", me.id);
        document.cookie = `eclipse.active_user_id=${encodeURIComponent(me.id)}; path=/; max-age=2592000; SameSite=Lax`;
      }
      const master = await derivePasswordMasterKeyBase64(secret, me.id);
      storePasswordMasterKey(master);
      clearPendingPassword();
      await restoreE2EIdentityFromBackup(master);
    } catch (e) {
      console.error("Local key restore failed:", e);
    }
  }

  // Screen 1: Email submit
  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailValid) {
      setEmailErrorGlow(true);
      setTimeout(() => setEmailErrorGlow(false), 950);
      return;
    }
    setStep("password");
  }

  // Screen 2: Password submit -> calls login API
  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 1 || loading) return;
    setLoading(true);
    setPasswordError(null);
    try {
      storePendingPassword(password);
      const data = await apiRequest<{ redirectTo?: string; requiresTwoFactor?: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password, isAddingAccount }),
      });

      if (data.requiresTwoFactor) {
        setMfaCode("");
        setStep("mfa");
        return;
      }

      await restoreMasterKey(password);
      showAppToast({ type: "success", title: t("Успешный вход"), icon: "laptop-check" });
      window.location.assign(data.redirectTo || "/app");
    } catch (error) {
      setPasswordErrorGlow(true);
      setTimeout(() => setPasswordErrorGlow(false), 950);
      const msg = error instanceof Error ? error.message : t("Не удалось войти");
      setPasswordError(msg);
      showAppToast({ type: "error", title: msg });
    } finally {
      setLoading(false);
    }
  }

  async function executeMfa(codeToVerify: string) {
    if (codeToVerify.length !== 6 || loading) return;
    setLoading(true);
    try {
      const data = await apiRequest<{ redirectTo?: string }>("/api/auth/login/mfa", {
        method: "POST",
        body: JSON.stringify({ code: codeToVerify }),
      });
      const pending = consumePendingPassword() || password;
      if (pending) {
        await restoreMasterKey(pending);
      }
      showAppToast({ type: "success", title: t("2FA подтверждена") });
      window.location.assign(data.redirectTo || "/app");
    } catch (error) {
      showAppToast({ type: "error", title: error instanceof Error ? error.message : t("Неверный код 2FA") });
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeMfa(mfaCode);
  }

  useEffect(() => {
    if (mfaCode.length === 6 && !loading && step === "mfa") {
      void executeMfa(mfaCode);
    }
  }, [mfaCode, loading, step]);

  // Recovery: Send Reset Code API
  async function sendResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailValid || loading) return;
    setLoading(true);
    try {
      await apiRequest("/api/auth/password-reset/send", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setResetCode("");
      setStep("forgot-code");
      showAppToast({ type: "success", title: t("Код восстановления отправлен на почту") });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Не удалось отправить код");
      if (message.includes("уже отправлен")) {
        setStep("forgot-code");
      }
      showAppToast({ type: "error", title: message });
    } finally {
      setLoading(false);
    }
  }

  // Recovery: Verify Reset Code API -> redirects to reset password page
  async function executeResetCode(codeToVerify: string) {
    if (codeToVerify.length !== 6 || loading) return;
    setLoading(true);
    try {
      const data = await apiRequest<{ redirectTo?: string }>("/api/auth/password-reset/verify", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, code: codeToVerify }),
      });
      window.location.assign(data.redirectTo || "/reset-password");
    } catch (error) {
      showAppToast({ type: "error", title: error instanceof Error ? error.message : t("Неверный код") });
    } finally {
      setLoading(false);
    }
  }

  async function verifyResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeResetCode(resetCode);
  }

  useEffect(() => {
    if (resetCode.length === 6 && !loading && step === "forgot-code") {
      void executeResetCode(resetCode);
    }
  }, [resetCode, loading, step]);

  const signUpHref = isAddingAccount ? "/sign-up?addAccount=1" : "/sign-up";

  return (
    <AuthScreen>
      {isAddingAccount && <AuthAddAccountBanner onCancel={handleCancelAddAccount} />}
      <AnimatePresence mode="wait">
        {step === "qr" ? (
          <motion.div key="login-qr" {...authStepMotion} className="w-full">
            <AuthCard
              title={t("Вход по QR-коду")}
              subtitle={t("Отсканируйте код с помощью мобильного приложения Eclipse")}
              footer={
                <p>
                  {t("Нет аккаунта?")}{" "}
                  <Link href={signUpHref} className="font-semibold text-white hover:underline transition-colors">
                    {t("Зарегистрироваться")}</Link>
                </p>
              }
            >
              <div className="flex flex-col items-center justify-center w-full">
                <div className="my-5 flex items-center justify-center">
                  <div className="relative flex items-center justify-center rounded-[22px] bg-white/[0.05] p-3.5 shadow-inner overflow-hidden min-h-[208px] min-w-[208px] sm:min-h-[218px] sm:min-w-[218px]">
                    {/* Telegram-style ambient radial light behind QR */}
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[22px] opacity-70"
                      style={{
                        background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 72%)",
                      }}
                    />

                    {/* Telegram Web signature smooth bloom appearance */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={
                        qrVisible
                          ? { opacity: 1, scale: 1 }
                          : { opacity: 0, scale: 0.92 }
                      }
                      transition={{
                        duration: 0.35,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{ willChange: "transform, opacity" }}
                      className="relative flex items-center justify-center"
                    >
                      <canvas
                        ref={qrCanvasRef}
                        className="h-[180px] w-[180px] sm:h-[190px] sm:w-[190px]"
                      />
                    </motion.div>
                  </div>
                </div>

                <p className="text-[13px] text-zinc-400 max-w-[280px] text-center mb-4 leading-relaxed font-normal">
                  {t("Откройте ")}<span className="text-zinc-200 font-medium">{t("Настройки → Сессии")}</span> {t(" и нажмите ")}<span className="text-zinc-200 font-medium">{t("«Подключить устройство»")}</span>
                </p>

                <p className="text-[13.5px] text-zinc-400">
                  {t("Войти по")}{" "}
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="font-semibold text-white hover:underline transition-colors cursor-pointer border-0 bg-transparent inline p-0"
                  >
                    {t("почте и паролю")}</button>
                </p>
              </div>
            </AuthCard>
          </motion.div>
        ) : step === "email" ? (
          <motion.div key="login-email" {...authStepMotion} className="w-full">
            <AuthCard
              icon={<MonkeyTrackingAnimation value={email} size={145} />}
              title={t("Вход в Eclipse")}
              subtitle={t("Введите адрес электронной почты для продолжения")}
              footer={
                <div className="space-y-1.5 sm:space-y-2">
                  {!isMobile && (
                    <p>
                      {t("Войти по")}{" "}
                      <button
                        type="button"
                        onClick={() => setStep("qr")}
                        className="font-semibold text-white hover:underline transition-colors cursor-pointer border-0 bg-transparent inline p-0"
                      >
                        {t("QR-коду")}</button>
                    </p>
                  )}
                  <p>
                    {t("Нет аккаунта?")}{" "}
                    <Link href={signUpHref} className="font-semibold text-white hover:underline transition-colors">
                      {t("Зарегистрироваться")}</Link>
                  </p>
                </div>
              }
            >
              <form className="space-y-3" onSubmit={handleEmailSubmit}>
                <AuthField
                  id="email"
                  label={t("Электронная почта")}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoFocus
                  placeholder={t("Электронная почта")}
                  left={<Mail className="text-zinc-500" size={16} />}
                  errorGlow={emailErrorGlow}
                />
                <AuthPrimaryButton type="submit" loading={loading} disabled={!emailValid}>
                  {t("Продолжить")}</AuthPrimaryButton>
              </form>
            </AuthCard>
          </motion.div>
        ) : step === "password" ? (
          <motion.div key="login-password" {...authStepMotion} className="w-full">
            <AuthCard
              icon={<MonkeyPasswordAnimation hasPassword={password.length > 0} showPassword={showPassword} size={145} />}
              title={t("Ввод пароля")}
              subtitle={t("Введите пароль для {0}", { 0: maskEmail(normalizedEmail) })}
              onBack={() => setStep("email")}
            >
              <form className="space-y-3" onSubmit={submitLogin}>
                <AuthField
                  id="password"
                  label={t("Пароль")}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  autoComplete="current-password"
                  autoFocus
                  placeholder={t("Пароль")}
                  errorGlow={passwordErrorGlow}
                  errorMessage={t(passwordError ?? "")}
                  right={
                    <AuthIconButton label={t("показать пароль")} onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </AuthIconButton>
                  }
                />

                <AuthPrimaryButton type="submit" loading={loading} disabled={password.length < 1}>
                  {t("Войти")}</AuthPrimaryButton>

                <div className="flex justify-center pt-0.5 text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => setStep("forgot-email")}
                    className="font-medium text-zinc-400 hover:text-white hover:underline transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    {t("Забыли пароль?")}</button>
                </div>
              </form>
            </AuthCard>
          </motion.div>
        ) : step === "mfa" ? (
          <motion.div key="login-mfa" {...authStepMotion} className="w-full">
            <AuthCard
              icon={<CodeMessageAnimation size={135} />}
              title={t("Проверка 2FA")}
              subtitle={t("Введите 6-значный код из приложения аутентификатора")}
              onBack={() => setStep("password")}
            >
              <form className="space-y-5" onSubmit={submitMfa}>
                <AuthOtp id="mfa-code" value={mfaCode} onChange={setMfaCode} />
                <AuthPrimaryButton type="submit" loading={loading} disabled={mfaCode.length !== 6}>
                  {t("Подтвердить")}</AuthPrimaryButton>
              </form>
            </AuthCard>
          </motion.div>
        ) : step === "forgot-email" ? (
          <motion.div key="recovery-email" {...authStepMotion} className="w-full">
            <AuthCard
              icon={<LockKeyGifAnimation size={135} />}
              title={t("Сброс пароля")}
              subtitle={t("Введите почту для получения кода восстановления")}
              onBack={() => setStep("password")}
            >
              <form className="space-y-4" onSubmit={sendResetCode}>
                <AuthField
                  id="reset-email"
                  label={t("Электронная почта")}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoFocus
                  placeholder={t("Электронная почта")}
                  left={<Mail className="text-zinc-500" size={18} />}
                />
                <AuthPrimaryButton type="submit" loading={loading} disabled={!emailValid}>
                  {t("Отправить код")}</AuthPrimaryButton>
              </form>
            </AuthCard>
          </motion.div>
        ) : (
          <motion.div key="recovery-code" {...authStepMotion} className="w-full">
            <AuthCard
              icon={<CodeMessageAnimation size={135} />}
              title={t("Код восстановления")}
              subtitle={t("Введите 6-значный код, отправленный на {0}", { 0: maskEmail(normalizedEmail) })}
              onBack={() => setStep("forgot-email")}
            >
              <form className="space-y-5" onSubmit={verifyResetCode}>
                <AuthOtp id="reset-code" value={resetCode} onChange={setResetCode} />
                <AuthPrimaryButton type="submit" loading={loading} disabled={resetCode.length !== 6}>
                  {t("Продолжить")}</AuthPrimaryButton>
              </form>
            </AuthCard>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthScreen>
  );
}
