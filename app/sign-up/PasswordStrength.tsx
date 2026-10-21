"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { motion, AnimatePresence } from "framer-motion";

export const getStrength = (pass: string) => {
  let score = 0;
  if (pass.length > 6) score += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
  if (/\d/.test(pass)) score += 1;
  if (/[^a-zA-Z\d]/.test(pass)) score += 1;
  return score;
};

export const PasswordStrength = ({ password }: { password: string }) => {
  const t = useTranslation();
  const strength = getStrength(password);

  const colors = [
    "bg-zinc-800",
    "bg-red-500/80",
    "bg-amber-500/80",
    "bg-emerald-500/80",
    "bg-blue-500/80"
  ];

  const labels = [
    "",
    t("простой пароль"),
    t("средняя сложность"),
    t("надежный пароль"),
    t("отличный пароль")
  ];

  return (
    <div className="h-9 flex items-center justify-center">
      <AnimatePresence>
        {password ? (
          <motion.div
            key="strength-indicator"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center gap-1.5"
          >
            {/* 4 minimal dots */}
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                    strength >= step ? colors[strength] : "bg-zinc-800"
                  }`}
                />
              ))}
            </div>
            {/* Small clean text */}
            <span className="text-[11px] text-zinc-500 font-medium tracking-wide">
              {labels[strength]}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
