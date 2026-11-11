"use client";

import { useTranslation } from "@/components/LocaleProvider";
import React, { createContext, useContext, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { IoMdEye } from "react-icons/io";
import type { MessageStatusState } from "../../types";

// Keep every metadata variant (media, captions, voice notes and helper previews)
// on the same delivery state without threading props through each bubble type.
const PendingMessageContext = createContext(false);
const FailedMessageContext = createContext(false);
export function MessageDeliveryProvider({ pending, failed = false, children }: { pending: boolean; failed?: boolean; children: React.ReactNode }) {
  return <FailedMessageContext.Provider value={failed}><PendingMessageContext.Provider value={pending && !failed}>{children}</PendingMessageContext.Provider></FailedMessageContext.Provider>;
}

export function MessageStatus({ status, className }: { status: MessageStatusState; className?: string }) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  const [clockVisible, setClockVisible] = useState(false);
  const sending = status === "sending";
  useEffect(() => {
    if (!sending) return;
    const timer = window.setTimeout(() => setClockVisible(true), 350);
    return () => { window.clearTimeout(timer); setClockVisible(false); };
  }, [sending]);
  const isRead = status === "read";
  const label = sending ? t("Отправка") : isRead ? t("Прочитано") : t("Отправлено");

  return (
    <span
      className={cn(
        "message-status-ticks relative inline-flex h-[12px] w-[15px] shrink-0 items-center justify-center text-current opacity-90 select-none",
        className,
      )}
      aria-label={label}
      title={label}
      data-delivery-status={status}
    >
      <AnimatePresence initial={false}>
      {sending ? clockVisible && <motion.svg key="sending" viewBox="0 0 16 16" fill="none" aria-hidden className="absolute h-[12px] w-[12px]" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: reducedMotion ? 0 : 0.14 }}>
        <circle cx="8" cy="8" r="6.1" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 4.3V8l2.4 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg> : <motion.svg
        key="confirmed"
        viewBox="0 0 16 11"
        fill="none"
        className="absolute h-[10px] w-[15px] overflow-visible"
        aria-hidden
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.15 }}
      >
        {/* Base left checkmark (always visible for sent and read) */}
        <path
          d="M1.2 5.5L4.5 8.8L10.8 2.5"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Second right checkmark with crisp snappy Telegram pop-in */}
        <AnimatePresence>
          {isRead ? (
            <motion.path
              key="second-tick"
              d="M5.4 5.5L8.7 8.8L15 2.5"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.4, x: -2.5 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.4, x: -1 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : null}
        </AnimatePresence>
      </motion.svg>}
      </AnimatePresence>
    </span>
  );
}

export function MessageStatusTicks({ read }: { read: boolean }) {
  const pending = useContext(PendingMessageContext);
  const failed = useContext(FailedMessageContext);
  if (failed) return null;
  return <MessageStatus status={pending ? "sending" : read ? "read" : "sent"} />;
}

export function MessageMeta({ timeText, showChannelViews = false, channelViewsText, showDeliveryStatus = false, isRead = false, className }: {
  timeText?: string; showChannelViews?: boolean; channelViewsText?: string; showDeliveryStatus?: boolean; isRead?: boolean; className?: string;
}) {
  const pending = useContext(PendingMessageContext);
  return <span data-message-meta className={cn(className, "inline-flex min-h-4 shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-4 tabular-nums select-none")}>
    {showChannelViews && !pending && <span className="inline-flex items-center gap-0.5"><IoMdEye size={12} /><span>{channelViewsText}</span></span>}
    <span>{timeText}</span>
    {(showDeliveryStatus || pending) && <MessageStatusTicks read={isRead} />}
  </span>;
}
