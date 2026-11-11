"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { memo } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface ProfileLinkEditorProps {
  linkEditorTarget: { kind: "group" | "channel"; currentLink: string; } | null;
  setLinkEditorTarget: React.Dispatch<React.SetStateAction<{ kind: "group" | "channel"; currentLink: string; } | null>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  linkEditorValue: string;
  setLinkEditorValue: React.Dispatch<React.SetStateAction<string>>;
  linkEditorStatus: "idle" | "checking" | "available" | "taken" | "invalid";
  savePublicLinkChange: () => Promise<void>;
  linkEditorSaving: boolean;
}

export const ProfileLinkEditor = memo(function ProfileLinkEditor({ linkEditorTarget, setLinkEditorTarget, t, linkEditorValue, setLinkEditorValue, linkEditorStatus, savePublicLinkChange, linkEditorSaving }: ProfileLinkEditorProps) {
  return (
    <AnimatePresence>
      {linkEditorTarget ? (
        <motion.div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer"
            onClick={() => setLinkEditorTarget(null)}
          />
          <motion.div
            className="app-panel-surface relative z-10 w-full max-w-sm rounded-[24px] bg-[#1a1a1c] p-6 text-white shadow-2xl ring-1 ring-white/10"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-100">
                {linkEditorTarget.kind === "channel" ? t("Ссылка канала") : t("Ссылка группы")}
              </h3>
              <button
                type="button"
                onClick={() => setLinkEditorTarget(null)}
                className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-zinc-400">{t("Имя пользователя / ссылка")}</label>
              <div className="relative flex items-center rounded-2xl bg-white/[0.05] border border-white/[0.08] px-3.5 py-3 focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-all">
                <span className="text-zinc-500 font-semibold text-[15px]">@</span>
                <input
                  type="text"
                  value={linkEditorValue}
                  onChange={(e) => setLinkEditorValue(e.target.value)}
                  placeholder="username"
                  maxLength={32}
                  className="ml-1.5 w-full bg-transparent text-[15px] font-semibold text-white placeholder-zinc-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="min-h-5 px-1 pt-1">
                {linkEditorStatus === "checking" ? (
                  <span className="text-[13px] text-zinc-400">{t("Проверка доступности...")}</span>
                ) : linkEditorStatus === "available" ? (
                  <span className="text-[13px] text-emerald-400 font-medium">{t("✓ Имя свободно")}</span>
                ) : linkEditorStatus === "taken" ? (
                  <span className="text-[13px] text-red-400 font-medium">{t("✕ Имя уже занято")}</span>
                ) : linkEditorStatus === "invalid" ? (
                  <span className="text-[13px] text-zinc-500">{t("От 4 символов: a-z, 0-9, _ (начинается с буквы)")}</span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkEditorTarget(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                {t("Отмена")}</button>
              <button
                type="button"
                onClick={() => void savePublicLinkChange()}
                disabled={linkEditorStatus !== "available" || linkEditorSaving}
                className="rounded-xl bg-[var(--ui-accent-solid,#38bdf8)] px-5 py-2.5 text-sm font-bold text-black hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:hover:brightness-100 transition-all cursor-pointer"
              >
                {linkEditorSaving ? t("Сохранение...") : t("Сохранить")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});
