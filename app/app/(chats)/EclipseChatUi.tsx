"use client";
import { localizeSystemText, translate as t } from "@/lib/i18n/translate";
import { useLanguage, useTranslation } from "@/components/LocaleProvider";


import { useEffect, useState, type CSSProperties } from "react";
import { MessageBubbleTail } from "./components/common/MessageBubbles";
import { VscVerifiedFilled } from "react-icons/vsc";
import { GiNestedEclipses } from "react-icons/gi";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/http";
import type { EclipseMessageAction, EclipseSystemPayload } from "@/lib/eclipse-system";
import { ECLIPSE_LIST_STATUS } from "@/lib/eclipse-system";
import { cn } from "@/lib/utils";
import { Popover } from "radix-ui";

export const ECLIPSE_INLINE_ACTION_CLASS_NAME = "inline-flex min-h-[38px] w-full items-center justify-center rounded-[14px] bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] px-4 py-2.5 text-center text-[13px] font-medium text-zinc-100 hover:text-white backdrop-blur-[4px] active:scale-[0.985] transition-all duration-150 disabled:opacity-50 select-none cursor-pointer";

export function VerifiedBadge({ className, kind = "user", showDetails = false, size = 16 }: { className?: string; kind?: "user" | "bot" | "group" | "channel"; showDetails?: boolean; size?: number }) {
  const t = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const supportsHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const label = kind === "bot" ? t("Подтверждённый бот") : kind === "group" ? t("Подтверждённая группа") : kind === "channel" ? t("Подтверждённый канал") : t("Подтверждённый аккаунт");
  const description = kind === "bot" ? t("Бот подтверждён Eclipse") : kind === "group" ? t("Группа подтверждена Eclipse") : kind === "channel" ? t("Канал подтверждён Eclipse") : t("Аккаунт подтверждён Eclipse");
  if (!showDetails) return (
    <span data-verification-badge style={{width:size,height:size}} role="img" aria-label={label} className={cn("relative inline-flex h-4 w-4 shrink-0 items-center justify-center text-white", className)}>
      <span data-verification-core style={{width:size*.625,height:size*.625}} className="absolute h-2.5 w-2.5 rounded-full bg-zinc-950" />
      <VscVerifiedFilled className="relative z-10 text-white" size={size} aria-hidden />
    </span>
  );
  return (
    <Popover.Root open={detailsOpen} onOpenChange={setDetailsOpen}>
      <Popover.Trigger asChild>
        <span data-verification-badge style={{width:size,height:size}} role="button" tabIndex={0} aria-label={label} onClick={event => { event.stopPropagation(); if (supportsHover() && event.detail !== 0) event.preventDefault(); }}
          onPointerEnter={event => { if (event.pointerType === "mouse" && supportsHover()) setDetailsOpen(true); }}
          onPointerLeave={event => { if (event.pointerType === "mouse" && supportsHover()) setDetailsOpen(false); }}
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}
          className={cn("relative inline-flex cursor-pointer items-center justify-center h-4 w-4 shrink-0 rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70", className)}>
          <span data-verification-core style={{width:size*.625,height:size*.625}} className="absolute h-2.5 w-2.5 rounded-full bg-zinc-950" />
          <VscVerifiedFilled className="relative z-10 text-white" size={size} aria-hidden />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content data-slot="dropdown-menu-content" data-verification-details side="bottom" sideOffset={8} collisionPadding={12} align="center"
          onClick={event => { event.stopPropagation(); if (!supportsHover()) setDetailsOpen(false); }} onPointerDown={event => event.stopPropagation()}
          className="z-[500] flex h-9 max-w-[calc(100vw-24px)] items-center gap-2 rounded-[14px] border border-white/8 bg-[#1c1c1e] px-3 text-left text-zinc-100 shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150">
          <span className="ml-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center"><VscVerifiedFilled size={18} className="block text-white" aria-hidden /></span>
          <p className="m-0 whitespace-nowrap text-[12px] font-bold leading-4">{description}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function EclipseBotAvatar({ className = "h-10 w-10" }: { className?: string }) {
  const t = useTranslation();
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full bg-black text-white overflow-hidden shrink-0",
        className,
      )}
    >
      <GiNestedEclipses
        className="h-[70%] w-[70%] text-white"
        aria-hidden
      />
    </div>
  );
}

export function EclipseChatListStatus() {
  const t = useTranslation();
  return <span className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">{t(ECLIPSE_LIST_STATUS)}</span>;
}

export function EclipseVerifiedTitle({ title, className, showDetails = false }: { title: string; className?: string; showDetails?: boolean }) {
  const t = useTranslation();
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="truncate">{title}</span>
      <VerifiedBadge className="text-white" kind="bot" showDetails={showDetails} />
    </span>
  );
}

function EclipseActionButton({
  action,
  messageId,
  disabled,
}: {
  action: EclipseMessageAction;
  messageId: string;
  disabled?: boolean;
}) {
  const t = useTranslation();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async (event) => {
        event.stopPropagation();
        try {
          const result = await apiRequest<{ redirectTo?: string }>("/api/eclipse/actions", {
            method: "POST",
            body: JSON.stringify({ messageId, actionId: action.id }),
          });
          if (result.redirectTo) {
            router.push(result.redirectTo);
          }
        } catch {
          // ignore action errors for now
        }
      }}
      className={ECLIPSE_INLINE_ACTION_CLASS_NAME}
    >
      {t(action.label ?? "")}
    </button>
  );
}

export function EclipseSystemMessageBubble({
  messageId,
  payload,
  timeText,
  createdAt,
  isMine = payload.botRole === "user",
  hasTail = true,
  bubbleShapeClass,
  bubbleClassName,
  mineGradientStyle,
  serviceStyle,
}: {
  messageId: string;
  payload: EclipseSystemPayload;
  timeText: string;
  createdAt?: string;
  isMine?: boolean;
  hasTail?: boolean;
  bubbleShapeClass?: string;
  bubbleClassName?: string;
  mineGradientStyle?: CSSProperties;
  serviceStyle?: CSSProperties;
}) {
  const t = useTranslation();
  const [isExpired, setIsExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!createdAt) return;
    const createdTime = new Date(createdAt).getTime();
    const expireTime = createdTime + 10 * 60 * 60 * 1000;
    const timeLeft = expireTime - Date.now();

    if (timeLeft <= 0) {
      setIsExpired(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsExpired(true);
    }, timeLeft);

    return () => clearTimeout(timer);
  }, [createdAt]);

  const messageTitle = payload.eventType === "bot_management" && payload.botRole === "assistant"
    && payload.title === "Eclipse API" && payload.body === "Выберите раздел в меню."
    ? "Eclipse" : payload.title;

  const visibleActions = isExpired
    ? []
    : (payload.actions?.filter((action) => action.action !== "not_me") ?? []);

  if (["community_created", "service"].includes(payload.eventType) && !payload.body && !visibleActions.length && !payload.botToken) {
    return (
      <span
        className="chat-service-pill"
        style={serviceStyle}
      >
        {t(payload.title)}
      </span>
    );
  }

  return (
    <div className="min-w-0 max-w-[86%] sm:max-w-[82%] md:max-w-[60%] xl:max-w-[56%] flex flex-col items-stretch">
      <div className={cn("relative px-3 py-2 border-0", bubbleShapeClass ?? (isMine ? "rounded-[16px] rounded-br-none" : "rounded-[16px] rounded-bl-none"), bubbleClassName ?? (isMine ? "bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.18)]" : "bg-[#212121] text-zinc-50 shadow-[0_1px_2px_rgba(0,0,0,0.24)]"))} style={isMine ? mineGradientStyle : undefined}>
        <MessageBubbleTail isMine={isMine} hasTail={hasTail} mineGradientStyle={mineGradientStyle} />
        <div className="relative z-[2]">
          {payload.title && <div className="text-[14.5px] font-semibold leading-snug">{payload.botRole === "user" ? messageTitle : localizeSystemText(messageTitle ?? "")}{!payload.body && <span className="inline-block w-11" aria-hidden />}</div>}
          {payload.body && (
            <div className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] font-normal leading-[1.4]", payload.title && "mt-1")}>
              <span>{payload.botRole === "user" ? payload.body : localizeSystemText(payload.body)}</span><span className="inline-block w-11" aria-hidden />
            </div>
          )}
          <span className="absolute bottom-[2px] right-0 text-[11px] leading-none opacity-75 select-none">{timeText}</span>
        </div>
      </div>
      {payload.botToken || visibleActions.length > 0 ? (
        <div className="mt-1.5 flex w-full flex-col gap-1.5">
          {payload.botToken && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!navigator.clipboard?.writeText) { setCopyError(true); return; }
                void navigator.clipboard.writeText(payload.botToken!).then(() => { setCopied(true); setCopyError(false); }).catch(() => setCopyError(true));
              }}
              className={ECLIPSE_INLINE_ACTION_CLASS_NAME}
            >
              {copyError ? t("Не удалось скопировать — выделите токен в сообщении") : copied ? t("Токен скопирован") : t("Скопировать токен")}
            </button>
          )}
          {visibleActions.map((action) => (
            <EclipseActionButton key={action.id} action={action} messageId={messageId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
