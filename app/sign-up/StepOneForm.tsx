'use client'
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordStrength, getStrength } from "./PasswordStrength";
import { CheckCircle2, Circle, XCircle, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

interface StepOneProps {
  data: {
    email: string;
    password: string;
    confirm: string;
  };
  setData: (data: { email: string; password: string; confirm: string }) => void;
  onNext: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const StepOne = ({ data, setData, onNext }: StepOneProps) => {
  const t = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isPasswordMatch = data.password === data.confirm && data.password !== "";
  const isStrengthOk = getStrength(data.password) >= 2;
  const isPasswordPolicyOk =
    data.password.length >= 10 &&
    /[A-Z]/.test(data.password) &&
    /[a-z]/.test(data.password) &&
    /\d/.test(data.password);
  const isEmailOk = EMAIL_REGEX.test(data.email.trim().toLowerCase());
  const isFormValid = isEmailOk && isPasswordMatch && isStrengthOk && isPasswordPolicyOk;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 relative">
        <Label htmlFor="email" className="flex items-center gap-2 ml-1">
          <Mail size={14} className="text-muted-foreground" />
          Email
        </Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            placeholder={t("Электронная почта")}
            className="h-11 rounded-full pr-10 transition-all"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isEmailOk ? (
              <CheckCircle2 size={18} className="text-green-500" />
            ) : data.email.length > 0 ? (
              <Circle size={18} className="text-muted-foreground/30" />
            ) : null}
          </div>
        </div>
        {data.email.length > 0 && !isEmailOk && (
          <p className="text-[10px] text-red-500">{t("Введите корректный email")}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password" className="flex items-center gap-2 ml-1">
          <Lock size={14} className="text-muted-foreground" />
          {t("Пароль")}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="h-11 rounded-full pr-11 shadow-sm transition-all"
            value={data.password}
            onChange={(e) => setData({ ...data, password: e.target.value })}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={showPassword ? t("Скрыть пароль") : t("Показать пароль")}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <PasswordStrength password={data.password} />
        {data.password.length > 0 && !isPasswordPolicyOk && (
          <p className="text-[10px] text-red-500">{t("Пароль: минимум 10 символов, заглавная, строчная и цифра")}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm" className="ml-1">{t("Подтвердите пароль")}</Label>
        <div className="relative">
          <Input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="••••••••"
            className={`h-11 rounded-full pr-20 transition-all ${
              data.confirm && !isPasswordMatch ? "border-red-500 focus-visible:ring-red-500" : ""
            }`}
            value={data.confirm}
            onChange={(e) => setData({ ...data, confirm: e.target.value })}
          />
          <div className="absolute right-11 top-1/2 -translate-y-1/2">
            <AnimatePresence mode="wait">
              {isPasswordMatch ? (
                <motion.div key="match" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <CheckCircle2 size={18} className="text-green-500" />
                </motion.div>
              ) : data.confirm.length > 0 ? (
                <motion.div key="no-match" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <XCircle size={18} className="text-red-500" />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirm((value) => !value)}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label={showConfirm ? t("Скрыть пароль") : t("Показать пароль")}
          >
            {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      <motion.div whileHover={isFormValid ? { scale: 1.02 } : {}} whileTap={isFormValid ? { scale: 0.98 } : {}}>
        <Button
          disabled={!isFormValid}
          onClick={onNext}
          className={`w-full h-12 mt-2 text-base font-bold transition-all duration-300 shadow-lg ${
            isFormValid
              ? "bg-primary hover:shadow-primary/25 active:shadow-inner cursor-pointer"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          <span className="flex items-center gap-2">
            {t("Продолжить")}<ArrowRight size={18} className={isFormValid ? "animate-pulse" : ""} />
          </span>
        </Button>
      </motion.div>
    </div>
  );
};
