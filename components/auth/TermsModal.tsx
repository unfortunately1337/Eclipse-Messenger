"use client";
import { useTranslation } from "@/components/LocaleProvider";

import { useEffect, useId } from "react";
import { LegalDocuments } from "@/components/auth/LegalDocuments";
import { AnimatePresence, motion } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const t = useTranslation();
  const titleId = useId();
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full sm:max-w-[480px] max-h-[85dvh] sm:max-h-[80dvh] rounded-t-[28px] sm:rounded-[28px] bg-[#14151a]/95 border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl text-white flex flex-col overflow-hidden"
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.96, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 26,
              stiffness: 340,
              mass: 0.75,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center text-white">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 id={titleId} className="text-[15px] font-bold text-white tracking-tight">
                    {t("Правила сервиса")}</h3>
                  <p className="text-[11.5px] text-zinc-400">
                    {t("Политика конфиденциальности и условия Eclipse")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("Закрыть")}
                className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-4 no-scrollbar">
              <LegalDocuments />
            </div>

            {/* Footer */}
            <div className="p-4 px-6 shrink-0 bg-[#14151a]">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 rounded-xl bg-white text-zinc-950 font-semibold text-[13.5px] hover:bg-zinc-200 transition-colors flex items-center justify-center cursor-pointer active:scale-[0.99]"
              >
                {t("Понятно")}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
