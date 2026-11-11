"use client";
import { useTranslation } from "@/components/LocaleProvider";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog } from "radix-ui";
import { PANEL_TRANSITION, PANEL_EXIT_TRANSITION } from "@/lib/client/panel-motion";
import { secretSafetyCode } from "@/lib/client/secret-device-keys";
import { getProfileMenuVisualStyle } from "@/lib/client/panel-visual";

export function SecretKeyVerification({ open, onClose, chatId, ownKey, peerKey, initialExpiresAt, transparentVisual = true }: {
  open: boolean; onClose: () => void; chatId: string; ownKey?: string; peerKey?: string; initialExpiresAt?: string | null; transparentVisual?: boolean;
}) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  const identity = JSON.stringify([chatId, ownKey, peerKey]);
  const [result, setResult] = useState<{ identity: string; code?: string; failed?: boolean } | null>(null);
  const ready = Boolean(ownKey && peerKey);
  const current = result?.identity === identity ? result : null;
  useEffect(() => {
    if (!open || !ownKey || !peerKey) return;
    let cancelled = false;
    void secretSafetyCode(chatId, [ownKey, peerKey]).then(code => {
      if (!cancelled) setResult({ identity, code });
    }).catch(() => { if (!cancelled) setResult({ identity, failed: true }); });
    return () => { cancelled = true; };
  }, [open, chatId, ownKey, peerKey, identity]);
  return <AnimatePresence>{open && <Dialog.Portal forceMount>
    <Dialog.Overlay forceMount asChild>
      <motion.div className="fixed inset-0 z-[460] bg-black/45 backdrop-blur-[3px]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.14 }} />
    </Dialog.Overlay>
    <div className="pointer-events-none fixed inset-0 z-[461] flex items-center justify-center p-4">
    <Dialog.Content forceMount asChild onEscapeKeyDown={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
      <motion.section data-secret-key-verification
        className="pointer-events-auto max-h-[calc(100dvh-32px)] w-full max-w-[344px] overflow-y-auto rounded-[24px] border p-5 text-zinc-100 outline-none"
        style={getProfileMenuVisualStyle(transparentVisual)}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 8, scale: reducedMotion ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { ...PANEL_TRANSITION, duration: reducedMotion ? 0 : PANEL_TRANSITION.duration } }}
        exit={{ opacity: 0, y: reducedMotion ? 0 : 4, scale: reducedMotion ? 1 : 0.99, transition: { ...PANEL_EXIT_TRANSITION, duration: reducedMotion ? 0 : PANEL_EXIT_TRANSITION.duration } }}>
        <Dialog.Title className="text-center text-[16px] font-semibold leading-6">{t("Секретный чат")}</Dialog.Title>
        <Dialog.Description className="mt-1.5 text-[12px] leading-[18px] text-zinc-400">{t(initialExpiresAt
          ? "Таймер показывает, сколько осталось до удаления чата и сообщений у обоих участников."
          : "Таймер запустится после принятия приглашения и покажет время до удаления чата у обоих участников.")}</Dialog.Description>
        <h3 className="mb-2 mt-4 text-center text-[13px] font-medium leading-5">{t("Код защиты")}</h3>
        <div className="rounded-[16px] bg-white/[0.04] px-3 py-3 text-center" role="status" aria-live="polite">
          {current?.code ? <div data-secret-safety-code className="grid select-text grid-cols-4 gap-x-2 gap-y-1 font-mono text-[13px] leading-5 tabular-nums">
            {current.code.split(" ").map((group, index) => <span key={index}>{group}{" "}</span>)}
          </div> : <p className="text-[12px] leading-[18px] text-zinc-400">{t(current?.failed ? "Не удалось вычислить код защиты. Откройте его ещё раз." : ready ? "Вычисляем код…" : "Код появится после согласования ключей устройств.")}</p>}
        </div>
        <p className="mt-3 text-[12px] leading-[18px] text-zinc-400">{t("Сравните код с собеседником по доверенному каналу: это проверка ключей устройств. Если код отличается, создайте новый чат.")}</p>
      </motion.section>
    </Dialog.Content>
    </div>
  </Dialog.Portal>}</AnimatePresence>;
}
