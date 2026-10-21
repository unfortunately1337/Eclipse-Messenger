"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { MediaAvatar } from "@/components/ui/media";
import { SavedMessagesAvatar } from "./Avatars";
import { getPanelVisualStyle } from "@/lib/client/panel-visual";
import { PANEL_TRANSITION } from "@/lib/client/panel-motion";
export type ForwardRecipient = { id: string; link: string; name: string; avatarUrl?: string | null; chatType: "saved" | "direct" | "group" | "channel" };
export function ForwardRecipientPicker({ desktop, recipients, onClose, onSelect, transparentVisual, title = "Переслать" }: { desktop: boolean; transparentVisual: boolean; title?: string; recipients: ForwardRecipient[]; onClose: () => void; onSelect: (recipient: ForwardRecipient) => void }) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose]);
  const normalized = query.trim().toLocaleLowerCase();
  if (typeof document === "undefined") return null;
  return createPortal(<motion.div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/45 md:items-center md:p-5" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={PANEL_TRANSITION} onClick={onClose}>
    <motion.section role="dialog" aria-modal="true" aria-label={t(title)} initial={desktop ? {y:16,scale:0.98} : {y:"100%"}} animate={{y:0,scale:1}} exit={desktop ? {y:12,scale:0.98} : {y:"100%"}} transition={PANEL_TRANSITION} onClick={e=>e.stopPropagation()} style={getPanelVisualStyle(transparentVisual)} className="flex h-[min(78dvh,560px)] md:h-[min(70dvh,470px)] w-full flex-col overflow-hidden rounded-t-[28px] border border-transparent text-white md:w-[420px] md:rounded-[28px]">
      <header className="flex shrink-0 items-center gap-2 px-3 py-2.5"><button aria-label={(title === "Отправить" || title === t("Отправить")) ? t("Закрыть отправку") : t("Закрыть пересылку")} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"><X size={22}/></button><h2 className="text-[18px] font-semibold">{t(title)}</h2></header>
      <div className="relative mx-4 mb-2"><Search size={18} className="absolute left-4 top-3.5 text-zinc-400"/><input autoFocus={desktop} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Поиск")} aria-label={t("Поиск получателя")} className="h-11 w-full rounded-full border-0 bg-[#141416] pl-11 pr-4 text-sm outline-none"/></div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-3">{recipients.filter(r=>`${r.name} ${r.link}`.toLocaleLowerCase().includes(normalized)).map(r=><button aria-label={r.name} key={`${r.chatType}:${r.id}`} onClick={()=>onSelect(r)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1 text-left hover:bg-white/7 active:bg-white/10">{r.chatType==="saved" ? <SavedMessagesAvatar className="h-10 w-10 shrink-0"/> : <MediaAvatar src={r.avatarUrl ?? undefined} alt={r.name} fallbackText={r.name.slice(0,1)} className="h-10 w-10 shrink-0"/>}<span className="truncate text-[15px] font-medium">{r.chatType === "saved" ? t("Избранное") : r.name}</span></button>)}{!recipients.some(r=>`${r.name} ${r.link}`.toLocaleLowerCase().includes(normalized))&&<p className="p-8 text-center text-sm text-zinc-400">{t("Чаты не найдены")}</p>}</div>
    </motion.section>
  </motion.div>, document.body);
}
