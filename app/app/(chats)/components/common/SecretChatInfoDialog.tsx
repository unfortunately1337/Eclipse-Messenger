"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog } from "radix-ui";

export function SecretChatInfoDialog({ open, onOpenChange, desktop, panelStyle }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desktop: boolean;
  panelStyle?: CSSProperties;
}) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div className="fixed inset-0 z-[460] bg-black/60 backdrop-blur-[3px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }} />
            </Dialog.Overlay>
            <Dialog.Content forceMount asChild
              onEscapeKeyDown={event => { event.preventDefault(); event.stopPropagation(); onOpenChange(false); }}>
              <motion.section data-secret-chat-info
                className="app-panel-surface fixed bottom-0 left-0 right-0 z-[461] mx-auto max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] bg-[#18181c] px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 text-zinc-100 shadow-2xl outline-none md:bottom-auto md:top-1/2 md:max-w-[420px] md:rounded-[28px]"
                style={panelStyle}
                initial={reducedMotion ? false : desktop ? { opacity: 0, y: "-46%", scale: 0.96 } : { y: "100%" }}
                animate={desktop ? { opacity: 1, y: "-50%", scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={desktop ? { opacity: 0, y: "-46%", scale: 0.96 } : { y: "100%" }}
                transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}>
                <div className="mx-auto -mt-3 mb-5 h-1 w-9 rounded-full bg-white/20 md:hidden" aria-hidden />
                <Dialog.Title className="text-[20px] font-semibold leading-tight">{t("Как работает секретный чат")}</Dialog.Title>
                <Dialog.Description asChild><div className="mt-5 space-y-5 text-[14px] leading-relaxed text-zinc-400">
                  <div><h3 className="mb-1 text-[14px] font-semibold text-zinc-100">{t("Защита тремя ключами")}</h3>
                    <p>{t("Чат защищают ключ вашего устройства, ключ устройства собеседника и отдельный ключ для каждого сообщения. Приватные ключи остаются на устройствах участников.")}</p></div>
                  <div><h3 className="mb-1 text-[14px] font-semibold text-zinc-100">{t("Только на выбранное время")}</h3>
                    <p>{t("Таймер запускается после принятия приглашения. Когда время истекает, чат становится недоступен обоим участникам.")}</p></div>
                  <div><h3 className="mb-1 text-[14px] font-semibold text-zinc-100">{t("Автоматическое удаление")}</h3>
                    <p>{t("После окончания таймера все сообщения и вложения этого чата автоматически удаляются с серверов Eclipse. Восстановить их невозможно.")}</p></div>
                </div></Dialog.Description>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
