"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { IoMdEye } from "react-icons/io";
import type { MessageStatusState } from "../../types";

export function MessageStatus({ status, className }: { status: MessageStatusState; className?: string }) {
  const t = useTranslation();
  const isRead = status === "read";

  return (
    <span
      className={cn(
        "message-status-ticks inline-flex h-[10px] w-[15px] shrink-0 items-center justify-center text-current opacity-90 select-none",
        className,
      )}
      aria-label={isRead ? t("Прочитано") : t("Отправлено")}
      title={isRead ? t("Прочитано") : t("Отправлено")}
    >
      <svg
        viewBox="0 0 16 11"
        fill="none"
        className="h-[10px] w-[15px] overflow-visible"
        aria-hidden
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
      </svg>
    </span>
  );
}

export function MessageStatusTicks({ read }: { read: boolean }) {
  const t = useTranslation();
  return <MessageStatus status={read ? "read" : "sent"} />;
}

export function MessageMeta({ timeText, showChannelViews = false, channelViewsText, showDeliveryStatus = false, isRead = false, className }: {
  timeText?: string; showChannelViews?: boolean; channelViewsText?: string; showDeliveryStatus?: boolean; isRead?: boolean; className?: string;
}) {
  return <span data-message-meta className={cn(className, "inline-flex min-h-4 shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-4 tabular-nums select-none")}>
    {showChannelViews && <span className="inline-flex items-center gap-0.5"><IoMdEye size={12} /><span>{channelViewsText}</span></span>}
    <span>{timeText}</span>
    {showDeliveryStatus && <MessageStatusTicks read={isRead} />}
  </span>;
}
