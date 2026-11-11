"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { communityUrl, invitationUrl } from "@/lib/client/deployment-url";
import { ReactNode, useRef } from "react";
import { AtSign, ChevronRight, Copy, Laptop, Link as LinkIcon, Lock, Monitor, Smartphone, Tablet, UserPlus } from "lucide-react";
import { MdDelete } from "react-icons/md";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function CommunityInviteLinkRow({
  kind,
  link,
  isPublic,
  activeKind,
  activeLink,
  token,
  loading,
  actionLoading,
  onEnsure,
  onCopy,
  onRevoke,
}: {
  kind: "group" | "channel";
  link: string;
  isPublic: boolean;
  activeKind: "group" | "channel" | null;
  activeLink: string | null;
  token: string | null;
  loading: boolean;
  actionLoading: boolean;
  onEnsure: () => void;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  const t = useTranslation();
  const isActiveTarget = activeKind === kind && activeLink === link;
  const inviteUrl = isActiveTarget && token ? invitationUrl(token) : null;
  const isLoading = isActiveTarget && loading;

  return (
    <div className="flex min-h-14 w-full items-center gap-3 px-4 py-3">
      {isPublic ? <AtSign size={20} className="shrink-0 text-zinc-400" /> : <Lock size={20} className="shrink-0 text-zinc-400" />}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={isPublic ? undefined : onEnsure}
        disabled={isPublic || isLoading || actionLoading}
      >
        <span className="block truncate text-[15px] font-semibold">
          {isPublic ? communityUrl(link, kind) : inviteUrl ?? t("Ссылка для вступления")}
        </span>
        <span className="mt-0.5 block text-[13px] text-zinc-500">
          {isPublic
            ? t("Публичная ссылка {0}", { 0: kind === "channel" ? t("канала") : t("группы") })
            : inviteUrl
              ? t("Ссылка активна")
              : isLoading
                ? t("Создаём ссылку...")
                : t("Доступ по приглашению")}
        </span>
      </button>
      {isLoading ? (
        <Spinner className="h-4 w-4 shrink-0 text-zinc-400" />
      ) : inviteUrl ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            disabled={actionLoading}
            className="grid h-9 w-9 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
            aria-label={t("Копировать ссылку")}
          >
            <Copy size={17} />
          </button>
          <button
            type="button"
            onClick={onRevoke}
            disabled={actionLoading}
            className="grid h-9 w-9 place-items-center rounded-full text-red-300 transition-colors hover:bg-red-500/[0.1] hover:text-red-200 disabled:opacity-50"
            aria-label={t("Удалить ссылку")}
          >
            <MdDelete size={19} />
          </button>
        </span>
      ) : !isPublic ? (
        <button
          type="button"
          onClick={onEnsure}
          disabled={actionLoading}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
          aria-label={t("Сгенерировать ссылку")}
        >
          <LinkIcon size={18} />
        </button>
      ) : null}
    </div>
  );
}

export function CommunityActionButtons({
  onAdd,
  addLabel = t("Добавить"),
}: {
  onAdd: () => void;
  addLabel?: string;
}) {
  const t = useTranslation();
  const buttonClassName =
    "inline-flex h-11 items-center justify-center gap-2 rounded-[16px] border-0 bg-white/[0.07] px-4 text-[14px] font-semibold text-zinc-100 shadow-none transition-colors hover:bg-white/[0.11] active:bg-white/[0.13]";

  return (
    <div className="mt-3 flex">
      <button type="button" className={cn(buttonClassName, "w-full")} onClick={onAdd}>
        <UserPlus size={17} />
        {addLabel}
      </button>
    </div>
  );
}

export function ScrollableTabsBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeftRef.current = containerRef.current.scrollLeft;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    containerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const onMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (e.deltaY !== 0) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUpOrLeave}
      onMouseLeave={onMouseUpOrLeave}
      onWheel={onWheel}
      className={cn(
        "overflow-x-auto no-scrollbar rounded-[24px] bg-white/[0.04] p-1.5 min-h-[52px] shadow-[0_10px_28px_rgba(0,0,0,0.12)] flex items-center gap-1.5 select-none",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CommunityDetailsSkeleton({ withMembers = false }: { withMembers?: boolean }) {
  const t = useTranslation();
  return (
    <div className="flex flex-col items-center px-4 pt-6 space-y-4" aria-hidden="true">
      <Skeleton className="h-[92px] w-[92px] rounded-full" />
      <Skeleton className="h-5 w-36 rounded-md" />
      <Skeleton className="h-4 w-24 rounded-md" />
      <div className="w-full mt-6 space-y-3">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        {withMembers && (
          <>
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </>
        )}
      </div>
    </div>
  );
}

export function PrivacySection({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslation();
  return (
    <section>
      <p className="px-1 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{title}</p>
      <div className="overflow-hidden rounded-[18px] bg-white/[0.035] shadow-[0_14px_32px_rgba(0,0,0,0.14)]">
        {children}
      </div>
    </section>
  );
}

export function PrivacyNavigationRow({
  label,
  value,
  onClick,
  disabled,
}: {
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const t = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-4 border-b border-white/[0.045] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.04] disabled:opacity-55"
    >
      <span className="min-w-0 flex-1 text-[15px] font-medium text-zinc-100">{label}</span>
      <span className="max-w-[44%] truncate text-right text-[14px] font-medium text-zinc-500">{value}</span>
      <ChevronRight size={17} className="shrink-0 text-zinc-600" />
    </button>
  );
}

export function PrivacyRadioRow({
  label,
  checked,
  onClick,
  disabled,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const t = useTranslation();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[58px] w-full items-center gap-4 border-b border-white/[0.045] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.04] disabled:opacity-55"
    >
      <span className="min-w-0 flex-1 text-[16px] font-medium text-zinc-100">{label}</span>
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
          checked ? "border-[color:var(--ui-accent-solid)]" : "border-zinc-600",
        )}
      >
        <span
          className={cn(
            "h-3 w-3 rounded-full transition-transform",
            checked ? "scale-100 bg-[var(--ui-accent-solid)]" : "scale-0 bg-transparent",
          )}
        />
      </span>
    </button>
  );
}

export function PrivacyToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const t = useTranslation();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="flex min-h-[54px] w-full items-center gap-3 border-b border-white/[0.05] px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-white/[0.045] disabled:opacity-55"
    >
      <span className="min-w-0 flex-1 text-[15px] font-medium text-zinc-100">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full ring-1 transition-colors",
          checked ? "bg-white ring-white" : "bg-white/[0.075] ring-white/[0.04]",
        )}
      >
        <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform", checked ? "translate-x-5 bg-zinc-950" : "translate-x-0 bg-zinc-500")} />
      </span>
    </button>
  );
}

export function PrivacyChoiceRow<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const t = useTranslation();
  return (
    <div className="border-b border-white/[0.05] px-4 py-3 last:border-b-0">
      <p className="mb-2.5 text-[15px] font-medium text-zinc-100">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={`${option.label}-${String(option.value)}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-55",
                active
                  ? "bg-white/[0.18] text-zinc-50 ring-1 ring-white/[0.07]"
                  : "bg-white/[0.065] text-zinc-400 hover:bg-white/[0.1] hover:text-zinc-200",
              )}
            >
              {t(option.label ?? "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsSessionIcon({ userAgent, size = 22 }: { userAgent?: string | null; size?: number }) {
  const t = useTranslation();
  const ua = (userAgent ?? "").toLowerCase();
  if (ua.includes("iphone") || (ua.includes("android") && ua.includes("mobile"))) {
    return <Smartphone size={size} />;
  }
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return <Tablet size={size} />;
  }
  if (ua.includes("windows") || ua.includes("linux")) {
    return <Monitor size={size} />;
  }
  if (ua.includes("mac os") || ua.includes("macintosh")) {
    return <Laptop size={size} />;
  }
  if (ua.includes("android")) {
    return <Tablet size={size} />;
  }
  return <Monitor size={size} />;
}

export function contactDisplayName(chat: { displayName: string; contactAlias?: string | null }, profileName?: string | null) {
  return chat.contactAlias?.trim() || profileName || chat.displayName;
}

export const SAVED_MESSAGES_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#ff845e", "#d45246"],
  ["#8e85ee", "#5f62d6"],
  ["#5fb2ff", "#3b82f6"],
  ["#67d67c", "#34c759"],
  ["#f7c04a", "#f59e0b"],
  ["#ef6fa8", "#db2777"],
  ["#57c7d4", "#0891b2"],
];

export function pickSavedMessagesPalette(displayName?: string | null, link?: string | null) {
  const seedSource = `${(displayName ?? "").trim().toLowerCase()}::${(link ?? "").trim().toLowerCase()}`;
  let hash = 0;
  for (let index = 0; index < seedSource.length; index += 1) {
    hash = (hash * 31 + seedSource.charCodeAt(index)) >>> 0;
  }
  return SAVED_MESSAGES_PALETTE[hash % SAVED_MESSAGES_PALETTE.length] ?? SAVED_MESSAGES_PALETTE[1];
}

export function isGeneratedDefaultAvatarUrl(avatarUrl?: string | null) {
  const value = (avatarUrl ?? "").trim();
  return value.startsWith("data:image/svg+xml;charset=UTF-8,");
}

export const getArcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
};
