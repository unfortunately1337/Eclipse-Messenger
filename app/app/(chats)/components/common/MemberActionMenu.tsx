"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trash2, UserCog } from "lucide-react";
type Actions = { role?: () => void; remove?: () => void };
type Menu = Actions & { x: number; y: number };
export function useMemberContextMenu(desktop: boolean) {
 const [menu, setMenu] = useState<Menu | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null), start = useRef<{ x: number; y: number } | null>(null), suppress = useRef(false);
 const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; start.current = null; };
 useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
 function bind(actions: Actions): HTMLAttributes<HTMLDivElement> {
  if (!actions.role && !actions.remove) return {};
  const open = (x: number, y: number) => { suppress.current = !desktop; setMenu({ ...actions, x: Math.min(window.innerWidth - 256, Math.max(12, x - 120)), y: Math.min(window.innerHeight - 124, Math.max(12, y + 12)) }); };
  return {
   onPointerDown: event => { if (desktop || event.pointerType === "mouse") return; cancel(); suppress.current = false; start.current = { x: event.clientX, y: event.clientY }; const { x, y } = start.current; timer.current = setTimeout(() => { timer.current = null; open(x, y); }, 450); },
   onPointerMove: event => { if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10) cancel(); },
   onPointerUp: cancel, onPointerCancel: cancel,
   onContextMenu: event => { event.preventDefault(); cancel(); open(event.clientX, event.clientY); },
   onClickCapture: event => { if (suppress.current) { event.preventDefault(); event.stopPropagation(); suppress.current = false; } },
   style: { WebkitTouchCallout: "none", userSelect: "none", touchAction: "pan-y" } as HTMLAttributes<HTMLDivElement>["style"],
  };
 }
 return { menu, close: () => setMenu(null), bind };
}
export function MemberActionMenu({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const t = useTranslation();
 const reduced = useReducedMotion(), ref = useRef<HTMLDivElement>(null);
 useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLButtonElement>("button")?.focus(); return () => { previous?.focus(); }; }, []);
 return <>
  <motion.button type="button" aria-label={t("Закрыть меню участника")} className="fixed inset-0 z-[150] bg-black/25" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.16 }} />
  <motion.div ref={ref} role="menu" aria-label={t("Действия с участником")} className="app-panel-surface app-chat-menu-surface fixed z-[151] w-[244px] overflow-hidden rounded-[22px] border border-transparent bg-[#1c1c1e] p-1.5 text-zinc-100 shadow-[0_14px_45px_rgba(0,0,0,0.35)]" style={{ left: menu.x, top: menu.y, transformOrigin: "top center" }} initial={{ opacity: 0, scale: reduced ? 1 : 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduced ? 1 : 0.97 }} transition={{ duration: reduced ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }} onKeyDown={event => { if (event.key === "Escape") onClose(); if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); const items = [...ref.current!.querySelectorAll('button')]; const index = items.indexOf(document.activeElement as HTMLButtonElement); items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus(); } }}>
   {menu.role && <button role="menuitem" className="flex min-h-12 w-full items-center gap-3 rounded-[16px] px-3.5 text-left text-[14px] font-medium hover:bg-white/5" onClick={() => { onClose(); menu.role?.(); }}><UserCog size={18} className="size-5 shrink-0 text-zinc-400" /><span>{t("Выдать роль")}</span></button>}
   {menu.remove && <button role="menuitem" className="flex min-h-12 w-full items-center gap-3 rounded-[16px] px-3.5 text-left text-[14px] font-medium text-red-400 hover:bg-white/5" onClick={() => { onClose(); menu.remove?.(); }}><Trash2 size={18} className="size-5 shrink-0" /><span>{t("Удалить")}</span></button>}
  </motion.div>
 </>;
}
