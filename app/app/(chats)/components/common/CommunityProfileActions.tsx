"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { menuPopoverMotion } from "@/lib/client/panel-motion";
import { IoEllipsisHorizontal, IoNotifications, IoNotificationsOff, IoSearch } from "react-icons/io5";
import { SlidersHorizontal, LogOut, Trash2 } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";

type Props = {
  kind: "group" | "channel"; muted: boolean; glass: boolean; canManage: boolean;
  danger: "delete" | "leave" | null;
  onToggleSound: () => void; onManage: () => void; onSearch?: () => void;
  onDanger: () => void;
};

export default function CommunityProfileActions(props: Props) {
  const t = useTranslation(), reduced = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), menuId = useId();
  useEffect(() => {
    if (!moreOpen) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setMoreOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setMoreOpen(false); root.current?.querySelector<HTMLButtonElement>("[aria-expanded]")?.focus(); } };
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [moreOpen]);
  const count = 2 + Number(props.kind === "channel") + Number(props.canManage);
  const tile = "grid h-[60px] min-w-0 content-center justify-items-center gap-1 rounded-[18px] border-0 bg-white/[0.04] px-0 py-2 text-zinc-300 transition-[background-color,color,transform] hover:bg-white/[0.09] hover:text-white active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-white/50";
  const label = "max-w-full truncate text-[10.5px] leading-[13px]";
  const item = "flex min-h-11 w-full items-center gap-3 rounded-[16px] px-3 text-left text-[14px] font-medium transition-colors hover:bg-white/[0.08]";
  return <div ref={root} aria-label={t("Действия профиля")} className="relative z-20 mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
    <button type="button" className={tile} onClick={props.onToggleSound} aria-pressed={!props.muted} aria-label={t(props.muted ? "Включить звук уведомлений" : "Выключить звук уведомлений")}>
      <span className="relative block h-[22px] w-[22px]" aria-hidden><AnimatePresence initial={false}><motion.span key={props.muted ? "muted" : "sound"} className="absolute inset-0 grid place-items-center" initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.75 }} transition={{ duration: reduced ? 0 : 0.18 }}>{props.muted ? <IoNotificationsOff size={22} /> : <IoNotifications size={22} />}</motion.span></AnimatePresence></span>
      <span className={label}>{t("Звук")}</span>
    </button>
    {props.kind === "channel" && <button type="button" className={tile} onClick={props.onSearch}><IoSearch size={22} aria-hidden /><span className={label}>{t("Поиск")}</span></button>}
    {props.canManage && <button type="button" className={tile} onClick={props.onManage}><SlidersHorizontal size={22} aria-hidden /><span className={label}>{t("Управление")}</span></button>}
    <button type="button" className={tile} onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen} aria-controls={menuId}><IoEllipsisHorizontal size={22} aria-hidden /><span className={label}>{t("Ещё")}</span></button>
    <AnimatePresence>{moreOpen && <motion.div id={menuId} role="menu" aria-label={t("Ещё")} className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] max-w-full rounded-[22px] p-1.5 text-zinc-100 shadow-[0_14px_40px_rgba(0,0,0,0.28)]" style={{ backgroundColor: props.glass ? "rgba(30,30,32,0.99)" : "#1e1e20" }} {...menuPopoverMotion(reduced)}>
      {props.danger && <button type="button" role="menuitem" className={`${item} text-red-400`} onClick={() => { setMoreOpen(false); props.onDanger(); }}>{props.danger === "delete" ? <Trash2 size={18} className="shrink-0" /> : <LogOut size={18} className="shrink-0" />}{t(props.kind === "group" ? props.danger === "delete" ? "Удалить группу" : "Покинуть группу" : props.danger === "delete" ? "Удалить канал" : "Покинуть канал")}</button>}
    </motion.div>}</AnimatePresence>
  </div>;
}
