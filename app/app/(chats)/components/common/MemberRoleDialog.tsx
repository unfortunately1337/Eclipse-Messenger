"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { panelOverlayMotion } from "@/lib/client/panel-motion";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Minus } from "lucide-react";
import { MediaAvatar } from "@/components/ui/media";
import { Spinner } from "@/components/ui/spinner";
type Permission = { id: string; label: string; enabled: boolean; onChange: (enabled: boolean) => void };
type Props = {
 panelThemeStyle?: CSSProperties;
 member: { displayName: string; avatarUrl?: string | null; link?: string; contactAlias?: string | null };
 desktop: boolean; channel: boolean; statusText: string; online: boolean; backdropClassName?: string;
 roleName: string; onRoleNameChange: (value: string) => void; messagePermissions: Permission[]; permissions: Permission[];
 saving: boolean; onClose: () => void; onSave: () => void;
};
function Mark({ checked, mixed = false }: { checked: boolean; mixed?: boolean }) {
  const t = useTranslation();
 return <span aria-hidden className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] border transition-colors duration-200 ${checked ? "border-zinc-100 bg-zinc-100 text-zinc-950" : "border-zinc-500 bg-transparent"}`}>{checked && (mixed ? <Minus size={15} /> : <Check size={16} strokeWidth={2.8} />)}</span>;
}
function PermissionRow({ item, saving }: { item: Permission; saving: boolean }) {
  const t = useTranslation();
 return <button type="button" role="checkbox" aria-label={t(item.label ?? "")} aria-checked={item.enabled} disabled={saving} onClick={() => item.onChange(!item.enabled)} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-50"><span className="min-w-0 flex-1 text-[14px] leading-5 text-zinc-200">{t(item.label ?? "")}</span><Mark checked={item.enabled} /></button>;
}
function PermissionGroup({ label, items, saving }: { label: string; items: Permission[]; saving: boolean }) {
  const t = useTranslation();
 const [open, setOpen] = useState(false), reduced = useReducedMotion(), id = useId(), count = items.filter(item => item.enabled).length;
 return <div className="overflow-hidden rounded-[22px] bg-white/[0.04]">
   <div className="flex min-h-14 items-center gap-1 pl-4 pr-3">
     <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left"><span className="min-w-0 flex-1 text-[14px] font-medium">{label}</span><span className="text-[12px] tabular-nums text-zinc-400">{count}/{items.length}</span><ChevronDown size={17} className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} /></button>
     <button type="button" role="checkbox" aria-label={t("Все права: {0}", { 0: label.toLowerCase() })} aria-checked={count === items.length ? true : count ? "mixed" : false} disabled={saving} onClick={() => items.forEach(item => item.onChange(count !== items.length))} className="grid h-11 w-11 shrink-0 place-items-center disabled:opacity-50"><Mark checked={count > 0} mixed={count > 0 && count < items.length} /></button>
   </div>
   <AnimatePresence initial={false}>{open && <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden"><div className="border-t border-white/[0.04]">{items.map(item => <PermissionRow key={item.id} item={item} saving={saving} />)}</div></motion.div>}</AnimatePresence>
 </div>;
}
export function MemberRoleDialog(props: Props) {
  const t = useTranslation();
 const { member, desktop, saving, onClose } = props, reduced = useReducedMotion(), title = useId();
 const ref = useRef<HTMLElement>(null), [host, setHost] = useState<Element | null>(null);
 useEffect(() => { const frame = requestAnimationFrame(() => setHost(desktop ? document.querySelector("[data-community-details]") : null)); return () => cancelAnimationFrame(frame); }, [desktop]);
 useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus(); return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); }; }, [host]);
 const name = member.contactAlias?.trim() || member.displayName;
 const general = props.permissions.filter(item => !["avatar", "name"].includes(item.id)), details = props.permissions.filter(item => ["avatar", "name"].includes(item.id));
 const content = <motion.section style={desktop ? undefined : props.panelThemeStyle} data-community-overlay data-app-panel={!desktop || undefined} ref={ref} role="dialog" aria-modal={!desktop} aria-labelledby={title} tabIndex={-1} className={`${desktop ? "absolute bg-transparent" : "fixed bg-[#171719]"} inset-0 z-[122] flex min-h-0 flex-col overflow-hidden text-zinc-100 outline-none`} {...panelOverlayMotion(reduced)} onKeyDown={event => {
   if (event.key === "Escape") { event.stopPropagation(); if (!saving) onClose(); }
   if (event.key === "Tab" && !desktop) { const controls = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'); if (controls?.length) { const first = controls[0], last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }
 }}>
 <header className="flex h-14 shrink-0 items-center gap-3 px-4"><button type="button" aria-label={t("Назад")} disabled={saving} onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/5"><ArrowLeft size={23} /></button><h2 id={title} className="min-w-0 flex-1 truncate text-[20px] font-semibold">{t("Выдача роли")}</h2><button type="button" aria-label={t("Сохранить роль")} aria-busy={saving} disabled={saving} onClick={props.onSave} className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/5 disabled:opacity-50">{saving ? <Spinner className="h-5 w-5" /> : <Check size={23} />}</button></header>
 <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
 <div className="flex flex-col items-center pb-2 pt-6"><MediaAvatar src={member.avatarUrl ?? undefined} alt={name} className="h-[92px] w-[92px] rounded-full" imgClassName="text-[32px]" fallbackText={name.slice(0, 1)} autoPlay /><p className="mt-4 max-w-full truncate text-[20px] font-semibold">{name}</p><p className={`mt-1 text-[13px] ${props.online ? "text-[color:var(--ui-accent-solid,#38bdf8)]" : "text-zinc-400"}`}>{props.statusText}</p></div>
 <label className="block rounded-[24px] bg-white/[0.04] p-4"><span className="mb-2 block px-1 text-[13px] text-zinc-400">{t("Название роли")}</span><input aria-label={t("Название роли")} value={props.roleName} onChange={event => props.onRoleNameChange(event.target.value)} maxLength={40} disabled={saving} placeholder={t("Администратор")} className="w-full rounded-[18px] border border-white/[0.08] bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-zinc-500 focus:border-[var(--ui-accent-solid,#38bdf8)]" /></label>
 <p className="px-3 text-[13px] font-medium text-zinc-400">{t("Возможности")}</p>
 <PermissionGroup label={props.channel ? t("Управление публикациями") : t("Управление сообщениями")} items={props.messagePermissions} saving={saving} />
 <PermissionGroup label={props.channel ? t("Изменение канала") : t("Изменение группы")} items={details} saving={saving} />
 <div className="overflow-hidden rounded-[22px] bg-white/[0.04]">{general.map(item => <PermissionRow key={item.id} item={item} saving={saving} />)}</div>
 </div></motion.section>;
 return desktop ? (host ? createPortal(content, host) : null) : content;
}
