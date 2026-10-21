"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import type { InputHTMLAttributes, ReactNode } from "react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, Loader2 } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { TelegramDoodleWallpaper } from "@/app/app/(chats)/components/common/TelegramDoodleWallpaper";
import { MdManageAccounts } from "react-icons/md";
import { cn } from "@/lib/utils";
import { LanguagePicker } from "@/components/LanguagePicker";

export { AuthAnimation, MonkeyPasswordAnimation, MonkeyTrackingAnimation, MonkeyIdleAnimation, LockKeyGifAnimation, CodeMessageAnimation } from "./AuthAnimation";

/* ─── shared motion preset ─── */

export const authStepMotion = {
  initial: { opacity: 0, x: 16, scale: 0.99 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -16, scale: 0.99 },
  transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
} as const;

/* ─── full-screen wrapper with Telegram Doodle Wallpaper ─── */

export function AuthScreen({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTranslation();
  return (
    <main className={cn("relative min-h-dvh w-full flex items-center justify-center bg-[#090a0d] px-4 pb-8 pt-20 sm:px-6 sm:py-20 text-zinc-100 select-none overflow-hidden", className)}>
      {/* Official Telegram Web black-and-white / dark vector pattern */}
      <TelegramDoodleWallpaper presetId="none" opacity={0.4} />
      <LanguagePicker auth />

      <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center justify-center">
        {children}
      </div>
    </main>
  );
}

/* ─── terminal typing text ─── */

export function TypingText({
  text,
  onComplete,
  startEmpty = false,
  blinkCursor = true,
}: {
  text: string;
  onComplete?: () => void;
  startEmpty?: boolean;
  blinkCursor?: boolean;
}) {
  const t = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [displayedText, setDisplayedText] = useState(startEmpty ? "" : text);
  const [prevText, setPrevText] = useState(text);

  if (text !== prevText) {
    setPrevText(text);
    setDisplayedText(startEmpty ? "" : text);
  }

  useEffect(() => {
    setMounted(true);
    let active = true;
    let currentIndex = 0;

    if (!startEmpty) {
      setDisplayedText("");
    }

    const type = () => {
      if (!active) return;
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(type, 24);
      } else {
        if (onComplete) {
          onComplete();
        }
      }
    };

    type();

    return () => {
      active = false;
    };
  }, [text, onComplete, startEmpty]);

  return (
    <span className="font-mono tracking-normal">
      {displayedText}
      {mounted && (
        <motion.span
          animate={blinkCursor ? { opacity: [1, 0] } : undefined}
          transition={blinkCursor ? {
            repeat: Infinity,
            duration: 0.8,
            ease: (v) => (v < 0.5 ? 0 : 1)
          } : undefined}
          className="inline-block w-[6px] h-[12px] bg-white ml-0.5 align-middle"
        />
      )}
    </span>
  );
}

/* ─── card ─── */

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  onBack,
  icon,
  onSubtitleComplete,
  className,
}: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  icon?: ReactNode;
  onSubtitleComplete?: () => void;
  className?: string;
}) {
  const t = useTranslation();
  return (
    <motion.section
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "w-full rounded-[22px] bg-[#14151b] p-5 sm:p-6 text-center flex flex-col items-center relative overflow-hidden",
        className
      )}
    >
      {onBack ? (
        <div className="w-full flex items-center justify-start mb-2.5 -mt-1">
          <button
            type="button"
            onClick={onBack}
            className="h-7 w-7 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
            aria-label={t("Назад")}
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      ) : null}

      {icon ? (
        <div className="flex justify-center mb-3 text-zinc-200">
          {icon}
        </div>
      ) : null}

      {title ? (
        <h1 className="text-[19px] sm:text-[20px] font-bold tracking-tight text-white mb-1">
          {title}
        </h1>
      ) : null}

      {subtitle ? (
        <div className="w-full max-w-[280px] text-[12.5px] leading-relaxed text-zinc-400 mb-4">
          {typeof subtitle === "string" ? (
            <TypingText text={subtitle} onComplete={onSubtitleComplete} />
          ) : (
            subtitle
          )}
        </div>
      ) : null}

      <div className="w-full">{children}</div>

      {footer ? (
        <div className="mt-4 text-[12.5px] text-zinc-400">{footer}</div>
      ) : null}
    </motion.section>
  );
}

/* ─── add account banner ─── */

export function AuthAddAccountBanner({
  onCancel,
  className,
}: {
  onCancel: () => void;
  className?: string;
}) {
  const t = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "w-full max-w-[400px] mb-3 sm:mb-3.5 flex items-center justify-between rounded-[22px] bg-[#14151b] px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_14px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl border-0",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <MdManageAccounts size={22} className="text-zinc-300 shrink-0" />
        <div className="flex flex-col min-w-0 text-left">
          <span className="text-[13px] sm:text-[13.5px] font-semibold text-white tracking-[-0.01em] truncate">
            {t("Добавление второго аккаунта")}</span>
          <span className="text-[11px] sm:text-[11.5px] text-zinc-400 leading-tight">
            {t("Текущая сессия останется активной")}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="ml-3 shrink-0 inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[12.5px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
      >
        {t("Отмена")}</button>
    </motion.div>
  );
}

/* ─── step indicator ─── */

export function AuthStepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const t = useTranslation();
  return (
    <div className="mb-5 flex items-center justify-center gap-1.5">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={{
            width: i === currentStep - 1 ? 16 : 5,
            opacity: i === currentStep - 1 ? 1 : 0.25,
            backgroundColor:
              i === currentStep - 1 ? "#ffffff" : "rgba(255,255,255,0.4)",
          }}
          transition={{ duration: 0.25 }}
          className="h-1 rounded-full"
        />
      ))}
    </div>
  );
}

/* ─── text input field ─── */

export function AuthField({
  id,
  label,
  className,
  inputClassName,
  left,
  right,
  errorGlow,
  errorMessage,
  ...props
}: {
  id: string;
  label: string;
  inputClassName?: string;
  left?: ReactNode;
  right?: ReactNode;
  errorGlow?: boolean;
  errorMessage?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const t = useTranslation();
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (errorGlow) {
      setAnimKey((k) => k + 1);
    }
  }, [errorGlow]);

  return (
    <div className={cn("relative w-full text-left", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative rounded-[18px] border border-white/[0.08] bg-transparent hover:border-white/[0.14] focus-within:border-white transition-colors px-4 py-3 flex items-center group overflow-hidden">
        {/* Error double-blink overlay */}
        {errorGlow ? (
          <span
            key={animKey}
            className="pointer-events-none absolute inset-0 rounded-[18px] auth-error-blink-twice z-10"
          />
        ) : null}

        {left ? (
          <span
            className={cn(
              "mr-3 text-zinc-400 group-focus-within:text-white transition-colors pointer-events-none flex items-center justify-center shrink-0",
              errorGlow && "text-red-400 [&_svg]:text-red-400"
            )}
          >
            {left}
          </span>
        ) : null}
        <input
          id={id}
          {...props}
          placeholder={props.placeholder ?? label}
          className={cn(
            "w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:[-webkit-text-fill-color:white]",
            inputClassName,
          )}
        />
        {right ? (
          <span
            className={cn(
              "ml-2 text-zinc-400 group-focus-within:text-white transition-colors flex items-center justify-center shrink-0",
              errorGlow && "text-red-400 [&_svg]:text-red-400"
            )}
          >
            {right}
          </span>
        ) : null}
      </div>
      {errorMessage ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="mt-1.5 px-1 text-[12px] font-medium text-red-400 text-center"
        >
          {typeof errorMessage === "string" ? t(errorMessage) : errorMessage}
        </motion.p>
      ) : null}
    </div>
  );
}

/* ─── primary CTA button ─── */

export function AuthPrimaryButton({
  children,
  loading,
  className,
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
  className?: string;
} & React.ComponentProps<typeof Button>) {
  const t = useTranslation();
  return (
    <Button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "relative h-[46px] w-full rounded-[18px] bg-white hover:bg-zinc-100 text-[15px] font-semibold text-zinc-950 shadow-sm transition-all duration-200 active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-0",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-zinc-950" />
      ) : null}
      {children}
    </Button>
  );
}

/* ─── ghost / text button ─── */

export function AuthGhostButton({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = useTranslation();
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "text-[13px] font-medium text-zinc-400 hover:text-white transition-colors duration-200 disabled:cursor-not-allowed disabled:text-zinc-700 cursor-pointer border-0 bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ─── icon button ─── */

export function AuthIconButton({
  children,
  label,
  ...props
}: {
  children: ReactNode;
  label: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = useTranslation();
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="flex h-7 w-7 items-center justify-center text-zinc-400 hover:text-white transition-colors duration-200 cursor-pointer border-0 bg-transparent"
    >
      {children}
    </button>
  );
}

/* ─── OTP input ─── */

export function AuthOtp({
  id,
  value,
  onChange,
  maxLength = 6,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  const t = useTranslation();
  return (
    <InputOTP
      id={id}
      maxLength={maxLength}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
      onChange={onChange}
      autoFocus
    >
      <InputOTPGroup className="flex w-full justify-center gap-2">
        {Array.from({ length: maxLength }).map((_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-12 w-11 rounded-[14px] border-0 border-none bg-white/[0.07] text-[21px] font-sans font-medium text-white transition-colors duration-200 hover:bg-white/[0.1] data-[active=true]:bg-white/[0.14] outline-none ring-0 ring-offset-0 focus:ring-0 focus-visible:ring-0 focus:outline-none data-[active=true]:ring-0 data-[active=true]:border-none shadow-none"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/**
 * Masks an email for privacy across authorization screens.
 * Example: "testmail@gmail.com" -> "testma********.com"
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return email || "";
  }
  const clean = email.trim().toLowerCase();
  const atIndex = clean.indexOf("@");
  const localPart = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex + 1);

  const prefixLength = localPart.length > 6 ? 6 : Math.max(1, Math.min(localPart.length - 1, 4));
  const prefix = localPart.slice(0, prefixLength);

  const lastDotIndex = domain.lastIndexOf(".");
  const suffix = lastDotIndex >= 0 ? domain.slice(lastDotIndex) : `.${domain}`;

  return `${prefix}********${suffix}`;
}
