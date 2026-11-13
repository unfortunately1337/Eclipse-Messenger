"use client";

import { type TranslationValues, translate as t } from "@/lib/i18n/translate";
import { PollOptionsEditor } from "@/components/PollOptionsEditor";
import { memo } from "react";
import { Link as LinkIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";
import { Button } from "@/components/ui/button";
import { appToast as toast } from "@/lib/client/app-toast";
import { sanitizeExternalUrl } from "@/lib/client/safe-content";

export interface CreatePollDialogProps {
  pollDialogOpen: boolean;
  setPollDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  t: (source: string, values?: TranslationValues | undefined) => string;
  pollQuestion: string;
  setPollQuestion: React.Dispatch<React.SetStateAction<string>>;
  pollOptions: string[];
  setPollOptions: React.Dispatch<React.SetStateAction<string[]>>;
  pollQuizMode: boolean;
  pollCorrectOptionIndex: number | null;
  setPollCorrectOptionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPollQuizMode: React.Dispatch<React.SetStateAction<boolean>>;
  pollExpiresInHours: number | null;
  setPollExpiresInHours: React.Dispatch<React.SetStateAction<number | null>>;
  sendPollMessage: (question: string, options: string[], quizMode: boolean, correctOptionIndex: number | null, expiresInHours: number | null) => Promise<void>;
  externalLinkPrompt: { url: string; host: string; } | null;
  setExternalLinkPrompt: React.Dispatch<React.SetStateAction<{ url: string; host: string; } | null>>;
}

export const CreatePollDialog = memo(function CreatePollDialog({ pollDialogOpen, setPollDialogOpen, t, pollQuestion, setPollQuestion, pollOptions, setPollOptions, pollQuizMode, pollCorrectOptionIndex, setPollCorrectOptionIndex, setPollQuizMode, pollExpiresInHours, setPollExpiresInHours, sendPollMessage, externalLinkPrompt, setExternalLinkPrompt }: CreatePollDialogProps) {
  return (
    <AnimatePresence>
      {pollDialogOpen ? (
        <motion.div
          className="fixed inset-0 z-[96] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/80"
            onClick={() => setPollDialogOpen(false)}
            aria-label={t("Закрыть")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
          <motion.div
            className="app-panel-surface relative max-h-[calc(100dvh-32px)] w-full max-w-[420px] overflow-y-auto no-scrollbar rounded-[28px] bg-[#181818]/96 p-6 text-white shadow-[0_32px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-2xl flex flex-col gap-4.5"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <button
              type="button"
              onClick={() => setPollDialogOpen(false)}
              className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col gap-0.5">
              <h3 className="text-lg font-bold text-zinc-100">{t("Создать опрос")}</h3>
            </div>

            {/* Question Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t("Вопрос")}</label>
              <input
                type="text"
                placeholder={t("Задайте вопрос")}
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                maxLength={255}
                className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:border-white/10 focus:border-[var(--ui-accent-solid,#38bdf8)] px-4 py-3 text-[13.5px] text-white placeholder-zinc-500 focus:bg-[#202020] focus:outline-none transition-all duration-200"
              />
            </div>

            <PollOptionsEditor options={pollOptions} onChange={setPollOptions} quizMode={pollQuizMode} correctIndex={pollCorrectOptionIndex} onCorrectIndexChange={setPollCorrectOptionIndex} />

            {/* Quiz Mode Switch */}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-zinc-100">{t("Режим викторины")}</span>
                <span className="text-[11px] text-zinc-400">{t("Один правильный вариант ответа")}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPollQuizMode(!pollQuizMode);
                  setPollCorrectOptionIndex(null);
                }}
                className={`relative h-5 w-9 rounded-full transition-all duration-200 ${pollQuizMode ? "bg-[var(--ui-accent-solid,#38bdf8)]" : "bg-white/10"
                  }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform duration-200 ${pollQuizMode ? "translate-x-4 bg-zinc-950" : "bg-white"
                    }`}
                />
              </button>
            </div>

            {/* Expiry Selector */}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3.5">
              <span className="text-[13px] font-semibold text-zinc-100">{t("Время жизни опроса")}</span>
              <select
                value={pollExpiresInHours ?? 24}
                onChange={(e) => {
                  setPollExpiresInHours(Number(e.target.value));
                }}
                className="rounded-xl bg-[#222222] border border-white/8 text-[12.5px] text-zinc-200 px-3 py-1.5 focus:outline-none hover:border-white/12 transition-all cursor-pointer"
              >
                <option value="1">{t("1 час")}</option>
                <option value="8">{t("8 часов")}</option>
                <option value="24">{t("24 часа")}</option>
                <option value="168">{t("7 дней")}</option>
              </select>
            </div>

            {/* Submit Button */}
            <Button
              type="button"
              disabled={
                !pollQuestion.trim() ||
                pollOptions.filter((o) => o.trim()).length < 2 ||
                (pollQuizMode && pollCorrectOptionIndex === null)
              }
              onClick={async () => {
                setPollDialogOpen(false);
                await sendPollMessage(
                  pollQuestion,
                  pollOptions,
                  pollQuizMode,
                  pollCorrectOptionIndex,
                  pollExpiresInHours,
                );
              }}
              className="mt-2 h-11 w-full rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 active:scale-[0.995] disabled:opacity-20 disabled:hover:bg-white disabled:active:scale-100"
            >
              {t("Отправить опрос")}</Button>
          </motion.div>
        </motion.div>
      ) : null}

      {externalLinkPrompt ? (
        <ConfirmationSheet
          open
          onOpenChange={(open) => { if (!open) setExternalLinkPrompt(null); }}
          title={t("Возможный риск перехода")}
          description={<>{t("Ссылка ведет на внешний сайт")}{" "}<span className="font-semibold">{externalLinkPrompt.host}</span>{t(". Это может быть мошеннический ресурс. Не вводите пароль, коды подтверждения и данные карты, если не уверены в сайте.")}</>}
          actionLabel={t("Перейти")}
          actionIcon={LinkIcon}
          actionClassName="text-[var(--ui-accent-solid,#c4b5fd)] hover:text-[var(--ui-accent-solid,#c4b5fd)]"
          zIndex={300}
          onAction={() => {
            const safeUrl = sanitizeExternalUrl(externalLinkPrompt.url);
            if (safeUrl) window.open(safeUrl, "_blank", "noopener,noreferrer");
            else toast.error(t("Недопустимая или небезопасная ссылка"));
            setExternalLinkPrompt(null);
          }}
        />
      ) : null}
    </AnimatePresence>
  );
});
