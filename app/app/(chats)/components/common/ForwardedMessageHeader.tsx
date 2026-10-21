"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { MediaAvatar } from "@/components/ui/media";
import { buildInitials, generateDefaultAvatarDataUrl } from "@/lib/default-avatar";
import type { ForwardAuthor } from "@/lib/client/message-forwarding";
import { VerifiedTitle } from "./VerifiedTitle";
export function ForwardedMessageHeader({ author, selfId, onAuthorClick, compact = false, detached = false }: { author: ForwardAuthor; compact?: boolean; detached?: boolean; selfId?: string | null; onAuthorClick?: (author: ForwardAuthor) => void }) {
  const t = useTranslation();
  const name = author.name;
  return <div data-forwarded-message data-forwarded-detached={detached || undefined} className={detached ? "min-w-0 text-[12px] leading-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" : compact ? "mb-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-inherit" : "mb-1 text-[12px] leading-4 text-inherit"}>
    <div className="shrink-0 whitespace-nowrap opacity-80">{t("Переслано от")}</div>
    <button type="button" disabled={!onAuthorClick} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onAuthorClick?.(author);}} aria-label={t("Открыть профиль: {0}", { 0: name })} className={`${compact ? "flex-1 gap-1" : "mt-0.5 gap-1.5"} flex max-w-full min-w-0 items-center text-left font-semibold transition-opacity hover:opacity-75 disabled:opacity-100`}>
      <MediaAvatar src={author.avatarUrl || generateDefaultAvatarDataUrl(name, author.link ?? "")} alt={name} fallbackText={buildInitials(name)} className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} /><VerifiedTitle badgeSize={12} statusSize={compact ? 13 : 14} kind={author.kind === "channel" ? "channel" : "user"} link={author.link ?? ""}>{name}</VerifiedTitle>
    </button>
  </div>;
}
