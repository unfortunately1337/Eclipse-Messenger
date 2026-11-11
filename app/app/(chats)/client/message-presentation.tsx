"use client";

import { dateLocale, plural, translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { CSSProperties, ReactNode, memo, useEffect, useRef } from "react";
import { ClockFading } from "lucide-react";
import { IoMdEye } from "react-icons/io";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "../components/common/ReplyQuote";
import { MessageStatusTicks } from "../components/common/MessageStatus";
import { renderEmojiText } from "@/components/EmojiText";
import { truncateEmojiText } from "@/lib/custom-emoji";
import { ReactionEmoji } from "../components/common/ReactionEmoji";
import { type ReactionSummary, type RealtimeSendingPayload } from "../types";
import { MESSAGE_TIME_LABEL_CACHE_MAX, DAY_KEY_CACHE_MAX, MESSAGE_DAY_LABEL_CACHE_MAX } from "./config";
import { parseMessageContentCached } from "./message-content";
import { normalizeLastMessagePreviewCached } from "./chat-previews";

export function albumGridContainerClass(count: number) {
  if (count === 2) return "grid grid-cols-1 gap-[2px]";
  if (count === 3) return "grid grid-cols-2 gap-[2px]";
  if (count === 4) return "grid grid-cols-3 gap-[2px]";
  if (count === 5) return "grid grid-cols-6 gap-[2px]";
  return "grid grid-cols-6 gap-[2px]";
}

export function albumGridItemClass(count: number, index: number) {
  if (count === 2) {
    return "col-span-1 aspect-[16/9]";
  }
  if (count === 3) {
    return index === 0 ? "col-span-2 aspect-[16/9]" : "col-span-1 aspect-square";
  }
  if (count === 4) {
    return index === 0 ? "col-span-3 aspect-[16/9]" : "col-span-1 aspect-square";
  }
  if (count === 5) {
    return index < 2 ? "col-span-3 aspect-[16/9]" : "col-span-2 aspect-square";
  }
  // 6 items: 2 rows, 3 items per row
  return "col-span-2 aspect-square";
}

export function isWelcomeStickerSrc(src: string) {
  const normalized = src.trim();
  return normalized === "/stickers/tg-duck-greeting.tgs" || normalized === "/stickers/hallo.json";
}

export function getRealtimeSendingLabel(kind: RealtimeSendingPayload["kind"]) {
  switch (kind) {
    case "image":
      return t("отправляет фото");
    case "video":
      return t("отправляет видео");
    case "music":
      return t("отправляет музыку");
    case "voice":
      return t("отправляет голосовое");
    case "video_note":
      return t("отправляет видеосообщение");
    case "file":
    default:
      return t("отправляет файл");
  }
}

export const GROUP_NAME_COLORS = ["text-sky-400", "text-pink-400", "text-orange-400", "text-green-400"] as const;

export function pickGroupNameColor(seed?: string | null) {
  if (!seed) return GROUP_NAME_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % GROUP_NAME_COLORS.length;
  }
  return GROUP_NAME_COLORS[hash];
}

export const messageTimeLabelCache = new Map<string, string>();

export function formatMessageTimeLabel(iso: string) {
  const key = iso || "";
  const cached = messageTimeLabelCache.get(key);
  if (cached) return cached;
  const target = new Date(iso || "");
  const label = Number.isNaN(target.getTime())
    ? ""
    : target.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });
  if (messageTimeLabelCache.size > MESSAGE_TIME_LABEL_CACHE_MAX) {
    messageTimeLabelCache.clear();
  }
  messageTimeLabelCache.set(key, label);
  return label;
}

export function formatForwardMessageCount(count: number): string {
  return plural(count, ["сообщение", "сообщения", "сообщений"], "message");
}

export function resolveStackedBubbleShape(input: {
  isMine: boolean;
  chainWithPrevious: boolean;
  chainWithNext: boolean;
}) {
  const base = "rounded-[16px]";
  if (input.isMine) {
    if (input.chainWithPrevious && input.chainWithNext) {
      return `${base} rounded-tr-[5px] rounded-br-[5px]`;
    }
    if (input.chainWithPrevious) {
      return `${base} rounded-tr-[5px] rounded-br-none`;
    }
    if (input.chainWithNext) {
      return `${base} rounded-br-[5px]`;
    }
    return `${base} rounded-br-none`;
  }
  // Incoming
  if (input.chainWithPrevious && input.chainWithNext) {
    return `${base} rounded-tl-[5px] rounded-bl-[5px]`;
  }
  if (input.chainWithPrevious) {
    return `${base} rounded-tl-[5px] rounded-bl-none`;
  }
  if (input.chainWithNext) {
    return `${base} rounded-bl-[5px]`;
  }
  return `${base} rounded-bl-none`;
}

export function resolveStackedMediaShape(input: {
  isMine: boolean;
  chainWithPrevious: boolean;
  chainWithNext: boolean;
}) {
  const base = "rounded-[20px]";
  if (input.isMine) {
    if (input.chainWithPrevious && input.chainWithNext) {
      return `${base} rounded-tr-[6px] rounded-br-[6px]`;
    }
    if (input.chainWithPrevious) {
      return `${base} rounded-tr-[6px]`;
    }
    if (input.chainWithNext) {
      return `${base} rounded-br-[6px]`;
    }
    return base;
  }
  // Incoming
  if (input.chainWithPrevious && input.chainWithNext) {
    return `${base} rounded-tl-[6px] rounded-bl-[6px]`;
  }
  if (input.chainWithPrevious) {
    return `${base} rounded-tl-[6px]`;
  }
  if (input.chainWithNext) {
    return `${base} rounded-bl-[6px]`;
  }
  return base;
}

export const MESSAGE_TEXT_WRAP_CLASS = "break-words [word-break:normal] [overflow-wrap:anywhere] hyphens-none";

export type ReactionBadgeItemProps = {
  messageId: string;
  reaction: ReactionSummary;
  isWhiteBubble: boolean;
  isPulsing: boolean;
  pulseVersion: number;
  pillStyle: CSSProperties;
  onToggle: () => void;
  disabled?: boolean;
  renderTextWithEmojis: (text: string, options?: { size?: number }) => ReactNode;
};

export const ReactionBadgeItem = memo(function ReactionBadgeItem({
  messageId,
  reaction,
  disabled,
  isWhiteBubble,
  isPulsing,
  pulseVersion,
  pillStyle,
  onToggle,
}: ReactionBadgeItemProps) {
  const t = useTranslation();
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  return (
    <motion.button
      key={`${messageId}-${reaction.emoji}`}
      layout="position"
      type="button"
      data-reaction-button="true"
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      style={pillStyle}
      className={cn(
        "relative inline-flex h-[27px] items-center justify-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium leading-none select-none cursor-pointer",
        "transition-colors duration-150 hover:brightness-110 active:scale-95",
        isWhiteBubble
          ? reaction.reacted
            ? "text-zinc-950"
            : "text-zinc-700"
          : reaction.reacted
            ? "text-white"
            : "text-white/90",
      )}
      whileTap={{ scale: 0.92 }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={
        isMountedRef.current && isPulsing
          ? { scale: [1, 1.1, 0.98, 1], opacity: 1 }
          : { scale: 1, opacity: 1 }
      }
      exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.15, ease: "easeOut" } }}
      transition={
        isMountedRef.current && isPulsing
          ? { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }
          : { type: "spring", stiffness: 420, damping: 22, mass: 0.7 }
      }
    >

      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
        <ReactionEmoji emoji={reaction.emoji} pulseVersion={pulseVersion} isPulsing={isPulsing} />
      </span>
      <motion.span
        animate={isPulsing ? { scale: [1, 1.16, 1] } : { scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "inline-flex min-w-[8px] items-center justify-center text-[11.5px] md:text-[12px] leading-none font-semibold pl-0.5",
          isWhiteBubble
            ? reaction.reacted ? "text-zinc-900" : "text-zinc-600"
            : reaction.reacted ? "text-white" : "text-zinc-100",
        )}
      >
        {reaction.count}
      </motion.span>
    </motion.button>
  );
});

export function renderBubbleMeta(options: {
  timeText: string;
  showChannelViews: boolean;
  channelViewsText: string;
  showDeliveryStatus: boolean;
  isRead: boolean;
  overlay?: boolean;
  overlayClassName?: string;
  pendingLabel?: string | null;
}) {
  const { timeText, showChannelViews, channelViewsText, showDeliveryStatus, isRead, overlay = false, overlayClassName } = options;
  return (
    <span
      data-message-meta className={`inline-flex min-h-4 items-center gap-1 font-sans text-[11px] font-medium leading-4 tabular-nums ${overlay
        ? "h-5 rounded-full px-1.5 py-0 text-white [&_.message-status-ticks]:text-white"
        : "text-inherit opacity-70"
        } ${overlayClassName ?? ""}`}
      style={overlay ? {
        backgroundColor: "rgba(24, 24, 24, 0.65)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.055)",
        backdropFilter: "blur(16px) saturate(1.05)",
        WebkitBackdropFilter: "blur(16px) saturate(1.05)",
      } : undefined}
    >
      {showChannelViews ? (
        <span className="inline-flex items-center gap-0.5 mr-1.5">
          <IoMdEye size={12} />
          {channelViewsText}
        </span>
      ) : null}
      <span>{timeText}</span>
      {showDeliveryStatus ? <MessageStatusTicks read={isRead} /> : null}
    </span>
  );
}

export const chatListTimeLabelCache = new Map<string, string>();

export function formatChatListTimeLabel(iso: string) {
  const now = new Date();
  const key = `${iso || ""}|${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const cached = chatListTimeLabelCache.get(key);
  if (cached) return cached;
  const target = new Date(iso || "");
  let label = "";
  if (!Number.isNaN(target.getTime())) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const daysDiff = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000);
    if (daysDiff >= 1) {
      const WEEKDAYS_SHORT_RU = [t("Вс"), t("Пн"), t("Вт"), t("Ср"), t("Чт"), t("Пт"), t("Сб")] as const;
      label = WEEKDAYS_SHORT_RU[target.getDay()] ?? "";
    } else {
      label = target.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23",
      });
    }
  }
  if (messageTimeLabelCache.size > MESSAGE_TIME_LABEL_CACHE_MAX) {
    chatListTimeLabelCache.clear();
  }
  chatListTimeLabelCache.set(key, label);
  return label;
}

export function getReplyPreviewText(value: string) {
  const parsed = parseMessageContentCached(value || "", false);
  const base = parsed.kind === "story_reply" ? parsed.text : normalizeLastMessagePreviewCached(value || "");
  return truncateEmojiText(base, 80);
}

export function replyQuoteColors(isMine: boolean, mineThemeStyle?: CSSProperties, lineColor?: string) {
  const accent = isMine ? (mineThemeStyle ? "rgba(255,255,255,0.9)" : "#09090b") : lineColor || "var(--ui-accent, #38bdf8)";
  return {
    background: `var(--reply-preview-background, ${isMine && !mineThemeStyle ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.12)"})`,
    lineColor: isMine ? "var(--reply-preview-line-outgoing, #9ca3af)" : "var(--reply-preview-line-incoming, #e4e4e7)",
    authorColor: `var(--reply-preview-text, ${accent})`,
    previewColor: `var(--reply-preview-text, ${isMine ? (mineThemeStyle ? "rgba(255,255,255,0.86)" : "#27272a") : "#d4d4d8"})`,
  };
}

export function renderReplyBubblePreview(options: {
  isMine: boolean; author: string; preview: string; lineColor?: string;
  mineThemeStyle?: CSSProperties; onClick?: () => void; detached?: boolean;
}) {
  const colors = replyQuoteColors(options.detached ? false : options.isMine, options.mineThemeStyle, options.lineColor);
  if (options.detached) {
    colors.background = "var(--reply-preview-background, rgba(255,255,255,0.06))";
    colors.authorColor = "#ffffff";
  }
  return <ReplyQuote author={options.author} preview={renderEmojiText(options.preview, { size: 14 })} onClick={options.onClick}
    {...colors} />;
}

export function renderStoryReplyBubblePreview(options: {
  isMine: boolean; author: string; preview?: string; lineColor?: string; mineThemeStyle?: CSSProperties;
}) {
  return <ReplyQuote author={options.author}
    preview={<span className="flex min-w-0 items-center gap-1"><ClockFading size={12} className="shrink-0" /><span className="truncate">{t("История")}{options.preview ? ` · ${options.preview}` : ""}</span></span>}
    {...replyQuoteColors(options.isMine, options.mineThemeStyle, options.lineColor)} />;
}

export const dayKeyCache = new Map<string, string>();

export const messageDayLabelCache = new Map<string, string>();

export function dayKeyFromIso(iso: string) {
  const cached = dayKeyCache.get(iso);
  if (cached !== undefined) return cached;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    dayKeyCache.set(iso, "");
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const key = `${year}-${month}-${day}`;
  if (dayKeyCache.size > DAY_KEY_CACHE_MAX) {
    dayKeyCache.clear();
  }
  dayKeyCache.set(iso, key);
  return key;
}

export function formatMessageDayLabel(iso: string) {
  const todayKey = dayKeyFromIso(new Date().toISOString());
  const cacheKey = `${dateLocale()}|${todayKey}|${iso}`;
  const cached = messageDayLabelCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    messageDayLabelCache.set(cacheKey, "");
    return "";
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = dayKeyFromIso(yesterday.toISOString());
  const currentKey = dayKeyFromIso(iso);

  if (currentKey === todayKey) {
    messageDayLabelCache.set(cacheKey, t("Сегодня"));
    return t("Сегодня");
  }
  if (currentKey === yesterdayKey) {
    messageDayLabelCache.set(cacheKey, t("Вчера"));
    return t("Вчера");
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  const label = date.toLocaleDateString(dateLocale(), sameYear
    ? { day: "numeric", month: "long" }
    : { day: "numeric", month: "long", year: "numeric" });
  if (messageDayLabelCache.size > MESSAGE_DAY_LABEL_CACHE_MAX) {
    messageDayLabelCache.clear();
  }
  messageDayLabelCache.set(cacheKey, label);
  return label;
}
