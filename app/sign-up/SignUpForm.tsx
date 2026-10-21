"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Eye, EyeOff, Mail, User } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import {
  createE2EIdentity,
  storeRegistrationE2EIdentity,
  derivePasswordMasterKeyBase64,
  storePasswordMasterKey,
  storePendingPassword,
  consumePendingPassword,
  clearPendingPassword,
  setActiveE2EUserId,
} from "@/lib/client/e2e";
import { invalidateE2EServerStateCache } from "@/lib/client/e2e-server-sync";
import { TermsModal } from "@/components/auth/TermsModal";
import {
  AuthAddAccountBanner,
  AuthCard,
  AuthField,
  AuthPrimaryButton,
  AuthScreen,
  authStepMotion,
  AuthOtp,
  AuthGhostButton,
  AuthIconButton,
  MonkeyPasswordAnimation,
  MonkeyTrackingAnimation,
  CodeMessageAnimation,
  maskEmail,
} from "@/components/auth/auth-ui";
import { getStrength } from "@/app/sign-up/PasswordStrength";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpForm({
  pendingEmail,
  isAddingAccount = false,
}: {
  pendingEmail?: string | null;
  isAddingAccount?: boolean;
}) {
  const t = useTranslation();
  const [step, setStep] = useState<number>(pendingEmail ? 4 : 1);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAddingAccount) {
      document.cookie = "eclipse.add_account=1; path=/; max-age=900; SameSite=Lax";
    }
  }, [isAddingAccount]);

  const handleCancelAddAccount = () => {
    document.cookie = "eclipse.add_account=; path=/; max-age=0; SameSite=Lax";
    window.location.assign("/app");
  };

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // UI helpers
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [termsOpen, setTermsOpen] = useState(false);

  // Glow / error triggers
  const [emailErrorGlow, setEmailErrorGlow] = useState(false);
  const [usernameErrorGlow, setUsernameErrorGlow] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailValid = useMemo(() => EMAIL_REGEX.test(normalizedEmail), [normalizedEmail]);

  const hasLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordPolicyOk = hasLength && hasUppercase && hasLowercase && hasNumber;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const passwordStrength = useMemo(() => getStrength(password), [password]);
  const passwordValid = passwordPolicyOk && passwordsMatch;

  const usernameValid = useMemo(() => {
    const u = username.trim().toLowerCase();
    return /^[a-z][a-z0-9_]{2,30}[a-z0-9]$/.test(u);
  }, [username]);

  const profileValid = displayName.trim().length >= 2 && usernameValid && !usernameError;

  // Restore saved registration state from localStorage on mount
  useEffect(() => {
    try {
      if (isAddingAccount) {
        localStorage.removeItem("eclipse:signup-state");
        localStorage.removeItem("eclipse:pending-pwd");
      } else {
        const saved = localStorage.getItem("eclipse:signup-state");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.email) setEmail(parsed.email);
          if (parsed.displayName) setDisplayName(parsed.displayName);
          if (parsed.username) setUsername(parsed.username);
          if (parsed.step && parsed.step > 1 && parsed.step <= 4) {
            setStep(parsed.step);
          }
        }
      }
      if (pendingEmail) {
        setEmail(pendingEmail);
        setStep(4);
      }
    } catch {
      // Ignore
    } finally {
      setChecking(false);
    }
  }, [pendingEmail, isAddingAccount]);

  // Save progress
  useEffect(() => {
    if (checking) return;
    try {
      localStorage.setItem(
        "eclipse:signup-state",
        JSON.stringify({ email, displayName, username, step })
      );
    } catch {
      // Ignore
    }
  }, [email, displayName, username, step, checking]);

  // OTP cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Live username availability check
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const u = username.trim().toLowerCase();
    if (!u) {
      setUsernameError(null);
      return;
    }
    if (!/^[a-z]/.test(u)) {
      setUsernameError(t("Уникальное имя должно начинаться с буквы"));
      return;
    }
    if (u.length < 4) {
      setUsernameError(t("Уникальное имя должно быть не менее 4 символов"));
      return;
    }
    if (!/^[a-z][a-z0-9_]{2,30}[a-z0-9]$/.test(u)) {
      setUsernameError(t("Уникальное имя должно содержать 4-32 символа: a-z, 0-9, _"));
      return;
    }

    // Clear format error once valid format is typed
    setUsernameError(null);
    setUsernameChecking(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest<{ available: boolean }>(
          `/api/auth/register/check-username?username=${encodeURIComponent(u)}`,
          { method: "GET" }
        );
        if (!res.available) {
          setUsernameError(t("Это уникальное имя уже занято"));
        } else {
          setUsernameError(null);
        }
      } catch {
        // If network issue, don't show invalid format error
        setUsernameError(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, t]);

  // STEP 1: Submit Email
  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailValid || loading) {
      setEmailErrorGlow(true);
      setTimeout(() => setEmailErrorGlow(false), 950);
      showAppToast({ type: "error", title: t("Введите корректный адрес почты") });
      return;
    }
    setLoading(true);
    try {
      const check = await apiRequest<{ available: boolean }>(
        `/api/auth/register/check-email?email=${encodeURIComponent(normalizedEmail)}`,
        { method: "GET" }
      );
      if (!check.available) {
        setEmailErrorGlow(true);
        setTimeout(() => setEmailErrorGlow(false), 950);
        showAppToast({ type: "error", title: t("Почта уже занята") });
        return;
      }
      setStep(2);
    } catch (err) {
      showAppToast({
        type: "error",
        title: err instanceof Error ? err.message : t("Не удалось проверить email"),
      });
    } finally {
      setLoading(false);
    }
  }

  // STEP 2: Submit Password
  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      showAppToast({ type: "error", title: t("Введите пароль") });
      return;
    }
    if (!hasLength) {
      showAppToast({ type: "error", title: t("Пароль должен содержать не менее 10 символов") });
      return;
    }
    if (!hasUppercase) {
      showAppToast({ type: "error", title: t("Добавьте в пароль хотя бы одну заглавную букву (A-Z)") });
      return;
    }
    if (!hasLowercase) {
      showAppToast({ type: "error", title: t("Добавьте в пароль хотя бы одну строчную букву (a-z)") });
      return;
    }
    if (!hasNumber) {
      showAppToast({ type: "error", title: t("Добавьте в пароль хотя бы одну цифру (0-9)") });
      return;
    }
    if (!confirmPassword) {
      showAppToast({ type: "error", title: t("Повторите пароль в поле ниже") });
      return;
    }
    if (!passwordsMatch) {
      showAppToast({ type: "error", title: t("Введенные пароли не совпадают") });
      return;
    }
    setStep(3);
  }

  // STEP 3: Submit Profile and initiate server registration
  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const u = username.trim().toLowerCase();
    if (!profileValid || usernameChecking || loading) {
      if (usernameError) {
        setUsernameErrorGlow(true);
        setTimeout(() => setUsernameErrorGlow(false), 1200);
      }
      return;
    }

    setLoading(true);
    try {
      // 1. Run Step 1 on server and E2E identity key generation in parallel
      const [, identity] = await Promise.all([
        apiRequest<{ nextStep?: string }>(
          "/api/auth/register/step-1",
          {
            method: "POST",
            body: JSON.stringify({
              email: normalizedEmail,
              password,
              confirmPassword: password,
            }),
          }
        ),
        createE2EIdentity(),
      ]);

      // 2. Submit Step 2 (creates user and sends code asynchronously)
      const registration = await apiRequest<{ nextStep?: string; user: { id: string } }>(
        "/api/auth/register/step-2",
        {
          method: "POST",
          body: JSON.stringify({
            displayName: displayName.trim(),
            link: u,
            publicKey: identity.publicKeyBase64,
          }),
        }
      );

      storeRegistrationE2EIdentity(registration.user.id, identity);

      // Store pending password securely for post-verification master key derivation
      storePendingPassword(password);
      try {
        localStorage.setItem("eclipse:pending-pwd", password);
      } catch {}

      // Persist OTP step immediately so a later navigation still resumes verification
      try {
        localStorage.setItem(
          "eclipse:signup-state",
          JSON.stringify({
            email: normalizedEmail,
            displayName: displayName.trim(),
            username: u,
            step: 4,
          })
        );
      } catch {
        // Ignore
      }

      // Move to Step 4: OTP Verification
      setStep(4);
      setCooldown(60);
      showAppToast({ type: "success", title: t("Код подтверждения отправлен на почту") });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("Не удалось завершить шаг");
      showAppToast({ type: "error", title: msg });
    } finally {
      setLoading(false);
    }
  }

  // STEP 4: Submit Email Verification Code
  async function executeVerification(codeToVerify: string) {
    if (codeToVerify.length !== 6 || loading) return;

    setLoading(true);
    try {
      const verifyRes = await apiRequest<{ redirectTo?: string; userId?: string }>(
        "/api/auth/email/verify",
        {
          method: "POST",
          body: JSON.stringify({
            email: normalizedEmail,
            code: codeToVerify,
            isAddingAccount,
          }),
        }
      );

      await finalizeRegistration(verifyRes?.userId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("Ошибка подтверждения кода");
      showAppToast({ type: "error", title: msg });
    } finally {
      setLoading(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeVerification(otpCode);
  }

  // Auto-submit verification code when 6 digits are reached
  useEffect(() => {
    if (otpCode.length === 6 && !loading && step === 4) {
      void executeVerification(otpCode);
    }
  }, [otpCode, loading, step]);

  async function sendVerificationCode() {
    if (cooldown > 0) return;
    try {
      await apiRequest("/api/auth/email/send", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setCooldown(60);
      showAppToast({ type: "success", title: t("Новый код отправлен на почту") });
    } catch (error) {
      showAppToast({
        type: "error",
        title: error instanceof Error ? error.message : t("Не удалось отправить код"),
      });
    }
  }

  function handleCancelRegistration() {
    localStorage.removeItem("eclipse:pending-pwd");
    localStorage.removeItem("eclipse:signup-state");
    clearPendingPassword();
    window.location.assign("/login");
  }

  async function restoreMasterKey(secret: string, knownUserId?: string) {
    try {
      invalidateE2EServerStateCache();
      let targetUserId = knownUserId;
      if (!targetUserId) {
        const me = await apiRequest<{ id: string }>("/api/auth/me", { method: "GET" }).catch(() => null);
        targetUserId = me?.id;
      }
      if (targetUserId) {
        setActiveE2EUserId(targetUserId);
        const master = await derivePasswordMasterKeyBase64(secret, targetUserId);
        storePasswordMasterKey(master);
      }
      clearPendingPassword();
    } catch (e) {
      console.error("Local key restore failed:", e);
    }
  }

  async function finalizeRegistration(knownUserId?: string) {
    try {
      const savedPassword =
        consumePendingPassword() ||
        (() => {
          try {
            return localStorage.getItem("eclipse:pending-pwd");
          } catch {
            return null;
          }
        })();

      if (savedPassword) {
        await restoreMasterKey(savedPassword, knownUserId);
      }

      try {
        localStorage.removeItem("eclipse:pending-pwd");
        localStorage.removeItem("eclipse:signup-state");
      } catch {}

      if (knownUserId) {
        localStorage.setItem("eclipse:active-user-id", knownUserId);
        localStorage.setItem("eclipse:cache:self-profile:last:v2", knownUserId);
        document.cookie = `eclipse.active_user_id=${encodeURIComponent(knownUserId)}; path=/; max-age=2592000; SameSite=Lax`;
        setActiveE2EUserId(knownUserId);
      }

      showAppToast({ type: "success", title: t("Регистрация успешно завершена!") });
      window.location.assign("/app");
    } catch {
      window.location.assign("/app");
    }
  }

  const loginHref = isAddingAccount ? "/login?addAccount=1" : "/login";

  return (
    <AuthScreen>
      <div className="w-full flex flex-col items-center">
        {isAddingAccount && <AuthAddAccountBanner onCancel={handleCancelAddAccount} />}
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="step-email" {...authStepMotion} className="w-full">
              <AuthCard
                icon={<MonkeyTrackingAnimation value={email} size={145} />}
                title={t("Регистрация")}
                subtitle={t("Введите адрес электронной почты для создания аккаунта")}
                footer={
                  <p>
                    {t("Уже есть аккаунт?")}{" "}
                    <Link href={loginHref} className="font-semibold text-white hover:underline transition-colors">
                      {t("Войти")}</Link>
                  </p>
                }
              >
                <form className="space-y-4" onSubmit={submitEmail}>
                  <AuthField
                    id="signup-email"
                    label={t("Электронная почта")}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    autoFocus
                    placeholder={t("Электронная почта")}
                    left={<Mail className="text-zinc-400" size={18} />}
                    errorGlow={emailErrorGlow}
                  />
                  <AuthPrimaryButton type="submit" loading={loading} disabled={!emailValid}>
                    {t("Продолжить")}</AuthPrimaryButton>
                </form>
              </AuthCard>
            </motion.div>
          ) : step === 2 ? (
            <motion.div key="step-password" {...authStepMotion} className="w-full">
              <AuthCard
                icon={<MonkeyPasswordAnimation hasPassword={password.length > 0 || confirmPassword.length > 0} showPassword={showPassword || showConfirmPassword} size={145} />}
                title={t("Создайте пароль")}
                subtitle={t("Придумайте надежный пароль от 10 символов")}
                onBack={() => setStep(1)}
              >
                <form className="space-y-3" onSubmit={submitPassword}>
                  <div className="space-y-2.5">
                    <AuthField
                      id="signup-password"
                      label={t("Пароль")}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      autoFocus
                      placeholder={t("Придумайте пароль")}
                      right={
                        <AuthIconButton label={t("Показать пароль")} onClick={() => setShowPassword((value) => !value)}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </AuthIconButton>
                      }
                    />

                    <AuthField
                      id="signup-confirm-password"
                      label={t("Повторите пароль")}
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder={t("Повторите пароль")}
                      right={
                        <AuthIconButton label={t("Показать пароль")} onClick={() => setShowConfirmPassword((value) => !value)}>
                          {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </AuthIconButton>
                      }
                    />
                    {password.length > 0 ? (
                      <div className="rounded-[18px] border border-white/[0.08] bg-transparent hover:border-white/[0.14] px-4 py-3 space-y-2 text-left select-none transition-colors">
                        <p className="text-[12px] font-medium text-zinc-400">{t("Требования к паролю:")}</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                          <div className={cn("flex items-center gap-2 transition-colors", hasLength ? "text-emerald-400 font-medium" : "text-zinc-500")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full transition-all shrink-0", hasLength ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-600")} />
                            <span className="whitespace-nowrap">{t("От 10 символов")}</span>
                          </div>
                          <div className={cn("flex items-center gap-2 transition-colors", hasUppercase ? "text-emerald-400 font-medium" : "text-zinc-500")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full transition-all shrink-0", hasUppercase ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-600")} />
                            <span className="whitespace-nowrap">{t("Заглавная (A-Z)")}</span>
                          </div>
                          <div className={cn("flex items-center gap-2 transition-colors", hasLowercase ? "text-emerald-400 font-medium" : "text-zinc-500")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full transition-all shrink-0", hasLowercase ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-600")} />
                            <span className="whitespace-nowrap">{t("Строчная (a-z)")}</span>
                          </div>
                          <div className={cn("flex items-center gap-2 transition-colors", hasNumber ? "text-emerald-400 font-medium" : "text-zinc-500")}>
                            <span className={cn("w-1.5 h-1.5 rounded-full transition-all shrink-0", hasNumber ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-600")} />
                            <span className="whitespace-nowrap">{t("Цифра (0-9)")}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {confirmPassword && !passwordsMatch ? (
                    <p className="text-[11.5px] font-medium text-red-400 text-center">{t("Пароли не совпадают")}</p>
                  ) : null}

                  <AuthPrimaryButton type="submit" loading={loading}>
                    {t("Продолжить")}</AuthPrimaryButton>
                </form>
              </AuthCard>
            </motion.div>
          ) : step === 3 ? (
            <motion.div key="step-profile" {...authStepMotion} className="w-full">
              <AuthCard
                icon={<MonkeyTrackingAnimation value={username || displayName} size={145} />}
                title={t("Данные профиля")}
                subtitle={t("Укажите ваше имя и уникальный никнейм")}
                onBack={() => setStep(2)}
              >
                <form className="space-y-3" onSubmit={submitProfile}>
                  <div className="space-y-2.5">
                    <AuthField
                      id="display-name"
                      label={t("Ваше имя")}
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      autoComplete="name"
                      autoFocus
                      placeholder={t("Ваше имя")}
                      left={<User className="text-zinc-400" size={16} />}
                    />

                    <AuthField
                      id="username"
                      label={t("Уникальное имя")}
                      value={username}
                      onChange={(event) =>
                        setUsername(
                          event.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, "")
                            .slice(0, 32)
                        )
                      }
                      placeholder={t("Уникальное имя (от 4 символов)")}
                      left={<AtSign className="text-zinc-400" size={16} />}
                      errorGlow={usernameErrorGlow}
                    />
                  </div>

                  {usernameError ? (
                    <p className="text-[12px] text-red-400 text-center">{t(usernameError ?? "")}</p>
                  ) : null}

                  <div className="pt-1 space-y-3">
                    <AuthPrimaryButton type="submit" loading={loading} disabled={!profileValid}>
                      {t("Зарегистрироваться")}</AuthPrimaryButton>

                    <p className="text-[11.5px] text-zinc-500 text-center leading-relaxed select-none">
                      {t("Регистрируясь, вы принимаете")}{" "}
                      <button
                        type="button"
                        onClick={() => setTermsOpen(true)}
                        className="text-zinc-400 hover:text-white transition-colors underline font-medium cursor-pointer"
                      >
                        {t("условия сервиса")}</button>
                    </p>
                  </div>
                </form>
              </AuthCard>
            </motion.div>
          ) : (
            <motion.div key="step-verify" {...authStepMotion} className="w-full">
              <AuthCard
                icon={<CodeMessageAnimation size={135} />}
                title={t("Подтверждение почты")}
                subtitle={t("Введите 6-значный код, отправленный на {0}", { 0: maskEmail(normalizedEmail) })}
                onBack={() => setStep(3)}
              >
                <form className="space-y-5" onSubmit={submitVerification}>
                  <AuthOtp id="email-verify-code" value={otpCode} onChange={setOtpCode} />

                  <AuthPrimaryButton type="submit" loading={loading} disabled={otpCode.length !== 6}>
                    {t("Подтвердить")}</AuthPrimaryButton>

                  <div className="text-center pt-1">
                    <AuthGhostButton
                      disabled={loading || cooldown > 0}
                      onClick={() => void sendVerificationCode()}
                      className="text-xs"
                    >
                      {cooldown > 0 ? t("Отправить код снова ({0}с)", { 0: cooldown }) : t("Отправить код снова")}
                    </AuthGhostButton>
                  </div>
                </form>
              </AuthCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <TermsModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />
    </AuthScreen>
  );
}
