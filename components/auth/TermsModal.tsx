"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const t = useTranslation();
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
            className="relative w-full sm:max-w-[480px] max-h-[85vh] sm:max-h-[80vh] rounded-t-[28px] sm:rounded-[28px] bg-[#14151a]/95 border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl text-white flex flex-col overflow-hidden"
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.96, opacity: 0 }}
            transition={{
              type: "spring",
              damping: 26,
              stiffness: 340,
              mass: 0.75,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center text-white">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white tracking-tight">
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

            {/* Scrollable Terms Content */}
            <div className="overflow-y-auto px-6 py-4 text-[12.5px] leading-relaxed text-zinc-300 space-y-4 no-scrollbar select-text">
              <h2 className="text-white font-semibold text-[14px]">
                {t("Политика конфиденциальности мессенджера Eclipse")}</h2>
              <p className="text-[11px] text-zinc-500 font-mono">
                {t("Дата вступления в силу: 13 июня 2026 года")}</p>

              <div>
                <h4 className="text-zinc-200 font-medium text-[13px] mb-1">
                  {t("1. Общие положения и философия сервиса")}</h4>
                <p>
                  {t("Настоящая Политика определяет порядок обработки и защиты персональной информации пользователей мессенджера Eclipse. Главная цель — обеспечение фундаментального права на конфиденциальность общения, свободу слова и цифровую анонимность. Мы собираем исключительно технический минимум, необходимый для работы сети.")}</p>
              </div>

              <div>
                <h4 className="text-zinc-200 font-medium text-[13px] mb-1">
                  {t("2. Сквозное шифрование и Zero-Knowledge")}</h4>
                <p>
                  {t("Безопасность базируется на сквозном шифровании. Ключи генерируются исключительно на устройствах пользователей и никогда не передаются на серверы. Серверная инфраструктура оперирует зашифрованными пакетами и физически не имеет доступа к переписке.")}</p>
              </div>

              <div>
                <h4 className="text-zinc-200 font-medium text-[13px] mb-1">
                  {t("3. Состав обрабатываемых данных")}</h4>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1">
                  <li><strong className="text-zinc-300">Username:</strong> {t(" для технической идентификации в сети.")}</li>
                  <li><strong className="text-zinc-300">Email:</strong> {t(" технический инструмент для защиты от ботов и верификации.")}</li>
                  <li><strong className="text-zinc-300">{t("Никнейм и Аватар:")}</strong> {t(" для персонализации по выбору пользователя.")}</li>
                </ul>
                <p className="mt-2 text-zinc-400 text-[11.5px]">
                  {t("Eclipse не собирает и не хранит номера телефонов, адресные книги, IMEI, MAC-адреса и геолокацию.")}</p>
              </div>

              <div>
                <h4 className="text-zinc-200 font-medium text-[13px] mb-1">
                  {t("4. Инструменты анонимизации")}</h4>
                <p>
                  {t("Сервис включает автоматическую смену никнеймов, скрытие сетевых статусов («В сети», «Печатает...») и функции локального шифрования данных.")}</p>
              </div>

              <div className="border-t border-white/[0.08] pt-3">
                <h2 className="text-white font-semibold text-[14px] mb-1">
                  {t("Условия использования (Terms of Service)")}</h2>
              </div>

              <div>
                <h4 className="text-zinc-200 font-medium text-[13px] mb-1">
                  {t("1. Принятие условий")}</h4>
                <p>
                  {t("Создание учетной записи означает полное согласие с данными Условиями. Использование сервиса предоставляется на условиях «как есть».")}</p>
              </div>

              <div>
                <h4 className="text-zinc-200 font-medium text-[13px] mb-1">
                  {t("2. Правила допустимого использования")}</h4>
                <p>
                  {t("Пользователь обязуется не использовать сервис для дестабилизации инфраструктуры (DDoS, спам, вредоносный код) и уважать права других участников.")}</p>
              </div>

              <div>
                <h4 className="text-zinc-200 font-medium text-[13px] mb-1">
                  {t("3. Сохранность учетных данных")}</h4>
                <p>
                  {t("Ввиду сквозного шифрования и отсутствия мастер-паролей у администрации, пользователь несет ответственность за сохранность пароля и доступ к привязанному email.")}</p>
              </div>
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
