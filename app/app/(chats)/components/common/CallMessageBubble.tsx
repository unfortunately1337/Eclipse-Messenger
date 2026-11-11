"use client";

import type { CSSProperties, ReactNode } from "react";
import { FiArrowDownLeft, FiArrowUpRight, FiPhone, FiVideo } from "react-icons/fi";
import { useTranslation } from "@/components/LocaleProvider";
import { callMessageTitle, formatCallDuration, type CallMessageData } from "@/lib/call-history";
import { MessageBubbleTail } from "./MessageBubbles";

type Props = {
  call: CallMessageData;
  selfId: string;
  timeText: string;
  className: string;
  hasTail: boolean;
  style?: CSSProperties;
  disabled: boolean;
  onCall: () => void;
  reactionsSlot?: ReactNode;
};

export default function CallMessageBubble({ call, selfId, timeText, className, hasTail, style, disabled, onCall, reactionsSlot }: Props) {
  const t = useTranslation();
  const outgoing = call.callerId === selfId;
  const arrowColor = call.status === "ended" && call.outcome === "missed" ? "text-zinc-400"
    : call.status === "ended" && (call.outcome === "cancelled" || call.outcome === "declined") ? "text-red-500" : "text-emerald-500";
  const Arrow = outgoing ? FiArrowUpRight : FiArrowDownLeft;
  const Icon = call.mode === "video" ? FiVideo : FiPhone;
  const detail = call.status === "ended" && call.outcome === "completed" ? formatCallDuration(call.durationSeconds) : "";
  const subtitle = detail ? `${timeText}, ${detail}` : timeText;

  return (
    <div className={`flex px-1 ${outgoing ? "justify-end" : "justify-start"}`}>
      <div data-call-message-bubble className={`relative w-[216px] max-w-full ${className}`} style={style}>
        <MessageBubbleTail isMine={outgoing} hasTail={hasTail} mineGradientStyle={style} />
        <button data-call-message-action type="button" onClick={onCall} disabled={disabled} aria-label={`${t(callMessageTitle(call, selfId))}. ${subtitle}. ${t("Позвонить")}`}
          className="relative z-[1] flex min-h-[60px] w-full items-center gap-3 rounded-[inherit] px-3 py-2.5 text-left transition-opacity hover:opacity-90 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-accent-solid,#fff)]">
        <span className="relative z-[1] min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-[19px]">{t(callMessageTitle(call, selfId))}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[12px] leading-4 tabular-nums">
            <Arrow size={15} strokeWidth={2.25} className={`shrink-0 ${arrowColor}`} aria-hidden />
            <span className="opacity-60">{subtitle}</span>
          </span>
        </span>
        <Icon size={24} strokeWidth={1.8} className="relative z-[1] shrink-0 opacity-70" aria-hidden />
        </button>
        {reactionsSlot ? <div className="relative z-[1] px-3 pb-2" onClick={event => event.stopPropagation()}>{reactionsSlot}</div> : null}
      </div>
    </div>
  );
}
