"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MdDelete } from "react-icons/md";
import { useTranslation } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import type { DecryptedMessage } from "../../types";

const RetryMessage = createContext<(message: DecryptedMessage) => Promise<void>>(async () => {});
export function OutgoingMessageActionsProvider({ retry, children }: { retry: (message: DecryptedMessage) => Promise<void>; children: ReactNode }) {
  const active = useRef(new Set<string>());
  return <RetryMessage.Provider value={async message => {
    if (active.current.has(message.id)) return;
    active.current.add(message.id);
    try { await retry(message); } finally { active.current.delete(message.id); }
  }}>{children}</RetryMessage.Provider>;
}

export function FailedMessageBadge({ onClick, isMine = true }: { onClick: () => void; isMine?: boolean }) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  return <motion.button type="button" data-message-send-failed aria-label={t("Не отправлено")} title={t("Не отправлено")}
    className={`absolute ${isMine ? "-right-[21px]" : "-left-[21px]"} bottom-1 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[13px] font-bold leading-none text-white shadow-sm`}
    initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.16, ease: "easeOut" }}
    onClick={event => { event.stopPropagation(); onClick(); }}>!</motion.button>;
}

export function FailedMessageActions({ message, close, onDelete }: { message: DecryptedMessage; close: () => void; onDelete: () => Promise<void> }) {
  const t = useTranslation();
  const retry = useContext(RetryMessage);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const retryAt = message.sendFailure?.retryAt ?? 0;
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = window.setInterval(() => { setNow(Date.now()); if (Date.now() >= retryAt) window.clearInterval(timer); }, 250);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return <>
    <Button type="button" variant="ghost" size="sm" disabled={busy || remaining > 0} onClick={async () => {
      if (Date.now() < retryAt || busy) return;
      setBusy(true); close();
      try { await retry(message); } finally { setBusy(false); }
    }} className="h-9 w-full justify-start gap-3 rounded-xl px-2.5 text-[13.5px] font-medium text-white/95 hover:bg-white/10 disabled:opacity-45">
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden className="shrink-0"><circle cx="10" cy="10" r="9" fill="currentColor" /><path d="M10 14V6M6.5 9.5 10 6l3.5 3.5" stroke="var(--background,#18181b)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {t("Повторить")}{remaining > 0 && <span className="ml-auto text-xs tabular-nums">{remaining} {t("с")}</span>}
    </Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => { close(); void onDelete(); }} className="h-9 w-full justify-start gap-3 rounded-xl px-2.5 text-[13.5px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"><MdDelete size={19} />{t("Удалить")}</Button>
  </>;
}
