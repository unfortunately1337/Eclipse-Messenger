"use client";
import { useTranslation } from "@/components/LocaleProvider";


import { useId, type ReactNode } from "react";
import { Camera, ChevronRight, Info } from "lucide-react";
import { FaHeart, FaLock } from "react-icons/fa";
import { MdAdminPanelSettings } from "react-icons/md";
import { IoPeopleSharp } from "react-icons/io5";
import { MediaAvatar } from "@/components/ui/media";
import { showAppToast } from "@/lib/client/app-toast";

export function CommunityDescription({ description }: { description?: string | null }) {
  const t = useTranslation();
  const text = description?.trim();
  if (!text) return null;
  return <button type="button" aria-label={t("Скопировать описание")} onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        showAppToast({ title: t("Описание скопировано"), type: "success", icon: "copy" });
      } catch {
        showAppToast({ title: t("Не удалось скопировать описание"), type: "error" });
      }
    }} className="flex min-h-14 w-full items-center gap-3.5 rounded-[18px] px-4 py-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]">
      <Info size={20} className="shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1">
        <span className="block whitespace-pre-wrap break-words text-[15px] font-semibold leading-snug text-white">{text}</span>
        <span className="mt-0.5 block text-[12.5px] text-zinc-400">{t("Описание")}</span>
      </span>
    </button>;
}

type Props = {
  kind: "group" | "channel";
  name: string;
  description: string;
  avatarUrl?: string | null;
  hasRealAvatar: boolean;
  isPublic: boolean;
  canEditName: boolean;
  canEditAvatar: boolean;
  canEditType: boolean;
  canManageAdmins: boolean;
  canEditReactions: boolean;
  reactionsLabel: string;
  onReactions: () => void;
  membersCount: number | string;
  adminsCount: number;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAvatarChange: () => void;
  onType: () => void;
  onMembers: () => void;
  onAdmins: () => void;
  avatarInput: ReactNode;
  inviteControl: ReactNode;
};

export function CommunitySettingsPanel(props: Props) {
  const t = useTranslation();
  const id = useId(), group = props.kind === "group";
  const rowClass = "flex min-h-14 w-full items-center gap-3.5 rounded-[18px] px-4 py-3 text-left transition-colors duration-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50";
  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <div className="flex justify-center py-4">
        <button type="button" disabled={!props.canEditAvatar} onClick={props.onAvatarChange}
          aria-label={group ? t("Изменить аватар группы") : t("Изменить аватар канала")}
          className="group relative rounded-full disabled:cursor-default">
          <MediaAvatar src={props.avatarUrl ?? undefined} alt={props.name}
            className="h-[108px] w-[108px] shadow-[0_12px_32px_rgba(0,0,0,0.2)]" fallbackText={props.name.slice(0, 1)} autoPlay />
          {props.canEditAvatar && <span className={props.hasRealAvatar
            ? "absolute inset-0 grid place-items-center rounded-full bg-black/35 text-white transition-colors duration-200 group-hover:bg-black/45"
            : "absolute inset-0 grid place-items-center rounded-full bg-[var(--ui-accent-solid,#38bdf8)] text-[color:var(--ui-accent-contrast,#fff)] transition-opacity duration-200 group-hover:opacity-90"}><Camera size={36} /></span>}
        </button>
        {props.avatarInput}
      </div>
      <div className="space-y-3 rounded-[24px] bg-white/[0.04] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
        <label htmlFor={`${id}-name`} className="block rounded-[18px] border border-white/[0.08] bg-transparent px-4 py-3.5 focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-colors duration-200">
          <input id={`${id}-name`} aria-label={group ? t("Название группы") : t("Название канала")} placeholder={group ? t("Название группы") : t("Название канала")} value={props.name} onChange={event => props.onNameChange(event.target.value)} disabled={!props.canEditName}
            maxLength={60} className="w-full bg-transparent text-[15px] font-normal text-white outline-none placeholder:text-zinc-500 disabled:opacity-60" />
        </label>
        <label htmlFor={`${id}-description`} className="block rounded-[18px] border border-white/[0.08] bg-transparent px-4 py-3 focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-colors duration-200">
          <textarea id={`${id}-description`} aria-label={t("Описание")} value={props.description} onChange={event => props.onDescriptionChange(event.target.value)} disabled={!props.canEditName}
            placeholder={t("Описание")} rows={2} maxLength={255} className="min-h-[46px] block w-full resize-none bg-transparent text-[15px] font-normal leading-relaxed text-white outline-none placeholder:text-zinc-500 disabled:opacity-60" />
          <span className="block text-right text-[11px] text-zinc-500">{props.description.length}/255</span>
        </label>
      </div>
      <div className="overflow-hidden rounded-[24px] bg-white/[0.04] p-1">
        {props.canEditType && <button type="button" onClick={props.onType} className={rowClass}>
          <span className="grid h-[21px] w-[21px] shrink-0 place-items-center text-zinc-400"><FaLock size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-zinc-100">{group ? t("Тип группы") : t("Тип канала")}</span><span className="mt-0.5 block text-[13px] text-zinc-400">{props.isPublic ? t("Публичный") : t("Приватный")}</span></span>
          <ChevronRight size={17} className="text-zinc-500" />
        </button>}
        <button type="button" onClick={props.onMembers} className={rowClass}>
          <IoPeopleSharp size={21} className="shrink-0 text-zinc-400" /><span className="min-w-0 flex-1 text-[15px] font-semibold text-zinc-100">{group ? t("Участники") : t("Подписчики")}</span>
          <span className="text-[14px] text-zinc-400">{props.membersCount}</span><ChevronRight size={17} className="text-zinc-500" />
        </button>
        {props.canManageAdmins && <button type="button" onClick={props.onAdmins} className={rowClass}>
          <MdAdminPanelSettings size={21} className="shrink-0 text-zinc-400" /><span className="min-w-0 flex-1 text-[15px] font-semibold text-zinc-100">{t("Администраторы")}</span>
          <span className="text-[14px] text-zinc-400">{props.adminsCount}</span><ChevronRight size={17} className="text-zinc-500" />
        </button>}
        {props.canEditReactions && <button type="button" onClick={props.onReactions} className={rowClass}>
          <FaHeart size={21} className="shrink-0 text-zinc-400" /><span className="min-w-0 flex-1 text-[15px] font-semibold text-zinc-100">{t("Реакции")}</span>
          <span className="text-[13px] text-zinc-400">{props.reactionsLabel}</span><ChevronRight size={17} className="text-zinc-500" />
        </button>}
        {props.inviteControl}
      </div>
    </div>
  );
}

export function CommunityTypePanel({ kind, isPublic, link, saving, onPublicChange, onLinkChange }: {
  kind: "group" | "channel"; isPublic: boolean; link: string; saving: boolean;
  onPublicChange: (value: boolean) => void; onLinkChange: (value: string) => void;
}) {
  const t = useTranslation();
  const group = kind === "group", id = useId();
  return <div className="space-y-4 px-4 pb-8 pt-4">
    <div role="radiogroup" aria-label={group ? t("Тип группы") : t("Тип канала")} className="rounded-[24px] bg-white/[0.04] p-1">
      {[false, true].map(value => <button key={String(value)} role="radio" aria-checked={isPublic === value} disabled={saving} onClick={() => onPublicChange(value)}
        className="flex w-full items-center gap-3.5 rounded-[18px] px-4 py-4 text-left transition-colors duration-200 hover:bg-white/[0.06] disabled:opacity-50">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200 ${isPublic === value ? "border-[var(--ui-accent-solid,#38bdf8)]" : "border-zinc-500"}`}><span className={`h-2.5 w-2.5 rounded-full bg-[var(--ui-accent-solid,#38bdf8)] transition-transform duration-200 ${isPublic === value ? "scale-100" : "scale-0"}`} /></span>
        <span><span className="block text-[15px] font-semibold text-zinc-100">{value ? (group ? t("Публичная группа") : t("Публичный канал")) : (group ? t("Приватная группа") : t("Приватный канал"))}</span>
          <span className="mt-1 block text-[13px] leading-5 text-zinc-400">{value ? (group ? t("Публичные группы доступны для входа всем желающим через поиск.") : t("Публичные каналы доступны для входа всем желающим через поиск.")) : (group ? t("Приватные группы доступны только по приглашению участников.") : t("Приватные каналы доступны только по ссылке-приглашению."))}</span></span>
      </button>)}
    </div>
    {isPublic && <label htmlFor={id} className="block rounded-[24px] bg-white/[0.04] p-4">
      <span className="mb-3 block text-[13px] font-medium text-zinc-400">{group ? t("Уникальное имя группы") : t("Уникальное имя канала")}</span>
      <span className="flex items-center gap-1 rounded-[18px] border border-white/[0.08] px-4 py-3.5 focus-within:border-[var(--ui-accent-solid,#38bdf8)] transition-colors duration-200"><span className="text-zinc-400">@</span><input id={id} aria-label={group ? t("Уникальное имя группы") : t("Уникальное имя канала")} value={link} onChange={event => onLinkChange(event.target.value.replace(/^@+/, "").toLowerCase())} disabled={saving} maxLength={32} autoComplete="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-100 outline-none" /></span>
      <span className="mt-3 block text-[12px] leading-5 text-zinc-400">{group ? t("Выберите уникальное имя. По нему другие люди смогут найти группу в поиске и присоединиться.") : t("Выберите уникальное имя. По нему другие люди смогут найти канал в поиске и присоединиться.")}<br />{t("Минимальная длина — 4 символа (буквы, цифры и знак подчеркивания).")}</span>
    </label>}
  </div>;
}
