"use client";
import { PollOptionsEditor } from "@/components/PollOptionsEditor";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useState } from "react";
import { X, HelpCircle, Clock } from "lucide-react";


interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    question: string;
    options: string[];
    quizMode: boolean;
    correctOptionIndex: number | null;
    expiresAt: string | null;
  }) => void;
}

export default function CreatePollModal({ isOpen, onClose, onSubmit }: CreatePollModalProps) {
  const t = useTranslation();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [quizMode, setQuizMode] = useState(false);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [duration, setDuration] = useState("1d"); // 1h, 12h, 1d, 1w

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filteredOptions = options.map((opt: string) => opt.trim()).filter(Boolean);

    // Validations
    if (!question.trim()) return;
    if (filteredOptions.length < 2) return;
    if (quizMode && (correctIdx === null || correctIdx >= filteredOptions.length)) return;

    // Calculate expiry date
    let expiresAt: string | null = null;
    const now = new Date();
    if (duration === "1h") {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (duration === "12h") {
      expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
    } else if (duration === "1d") {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (duration === "1w") {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    onSubmit({
      question: question.trim(),
      options: filteredOptions,
      quizMode,
      correctOptionIndex: quizMode ? correctIdx : null,
      expiresAt,
    });

    // Reset fields
    setQuestion("");
    setOptions(["", ""]);
    setQuizMode(false);
    setCorrectIdx(null);
    setDuration("1d");
    onClose();
  };

  const isValid =
    question.trim().length > 0 &&
    options.filter((opt: string) => opt.trim()).length >= 2 &&
    (!quizMode || correctIdx !== null);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm select-none">
      <div className="relative max-h-[calc(100dvh-32px)] w-full max-w-[420px] overflow-y-auto no-scrollbar rounded-[24px] border border-white/10 bg-zinc-900 p-6 text-zinc-100 shadow-[0_24px_50px_rgba(0,0,0,0.5)] flex flex-col gap-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          type="button"
        >
          <X size={20} />
        </button>

        <div>
          <h3 className="text-lg font-bold text-white">{t("Создание опроса")}</h3>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Question */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-white/50 tracking-wide uppercase">{t("Вопрос")}</label>
            <input
              type="text"
              placeholder={t("Задайте вопрос")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={256}
              required
              className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-3.5 text-[13px] text-zinc-100 placeholder-white/20 focus:border-white/20 focus:bg-white/7 transition-all outline-none"
            />
          </div>

          <PollOptionsEditor options={options} onChange={setOptions} quizMode={quizMode} correctIndex={correctIdx} onCorrectIndexChange={setCorrectIdx} />

          {/* Quiz Mode Toggle */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-2">
              <HelpCircle size={16} className="text-zinc-400" />
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-white/90">{t("Режим викторины")}</span>
                <span className="text-[10px] text-white/30">{t("Один правильный ответ")}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuizMode(!quizMode);
                setCorrectIdx(null);
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                quizMode ? "bg-white" : "bg-white/10"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out mt-0.25 ${
                  quizMode ? "translate-x-4 bg-zinc-950" : "translate-x-0.25 bg-white"
                }`}
              />
            </button>
          </div>

          {/* Expiration Duration */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-zinc-400" />
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-white/90">{t("Срок действия")}</span>
                <span className="text-[10px] text-white/30">{t("По истечении опрос закроется")}</span>
              </div>
            </div>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="bg-zinc-800 border border-white/10 rounded-xl px-2 py-1 text-xs text-white outline-none cursor-pointer focus:border-white/20 transition-all"
            >
              <option value="1h">{t("1 час")}</option>
              <option value="12h">{t("12 часов")}</option>
              <option value="1d">{t("1 день")}</option>
              <option value="1w">{t("1 неделя")}</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-2 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors"
            >
              {t("Отмена")}</button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 h-10 bg-white hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-zinc-950 rounded-xl text-xs font-bold text-zinc-950 transition-all"
            >
              {t("Создать")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
