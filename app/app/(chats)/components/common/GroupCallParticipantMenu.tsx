"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2, Volume2 } from "lucide-react";
import { FaVolumeMute } from "react-icons/fa";
import { useTranslation } from "@/components/LocaleProvider";
import { callOverlayMaterial } from "@/lib/client/call-window-style";
import { menuPopoverMotion } from "@/lib/client/panel-motion";
import type { GroupCallPerson } from "./GroupCallWindow";

export function GroupCallParticipantMenu({ person, anchor, glass, onClose, onAudio, onExpand }: { person: GroupCallPerson; anchor: HTMLElement; glass: boolean; onClose: () => void; onAudio: (audio: { volume: number; muted: boolean }) => void; onExpand: () => void }) {
  const t = useTranslation(), reduced = useReducedMotion(), menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const silent = person.locallyMuted || (person.volume ?? 1) === 0;
  const volume = silent ? 0 : Math.round((person.volume ?? 1) * 100);
  useLayoutEffect(() => {
    const update = () => {
      if (!anchor.isConnected) { onClose(); return; }
      const rect = anchor.getBoundingClientRect(), panel = menu.current?.getBoundingClientRect();
      if (!panel) return;
      const x = Math.max(12, Math.min(innerWidth - panel.width - 12, rect.left));
      const below = rect.bottom + 8;
      const y = below + panel.height <= innerHeight - 12 ? below : Math.max(12, rect.top - panel.height - 8);
      setPosition(previous => previous.x === x && previous.y === y ? previous : { x, y });
    };
    update(); const observer = new ResizeObserver(update); observer.observe(anchor); if (menu.current) observer.observe(menu.current);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [anchor, onClose]);
  useEffect(() => {
    menu.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); if (anchor.isConnected) anchor.focus({ preventScroll: true }); };
  }, [anchor, onClose]);
  return createPortal(<motion.div ref={menu} data-group-call-volume-menu role="dialog" aria-label={t("Настройки звука: {0}", { 0: person.name })} tabIndex={-1} {...menuPopoverMotion(reduced)}
    className="fixed z-[480] w-[228px] max-w-[calc(100vw-24px)] rounded-[22px] p-1.5 text-zinc-100 outline-none" style={{ ...callOverlayMaterial(glass), left: position.x, top: position.y }}
    onKeyDown={event => {
      if (event.key !== "Tab") return; event.stopPropagation();
      const nodes = menu.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'); if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === menu.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <p className="truncate px-3 pb-1 pt-2 text-[12px] font-semibold text-zinc-100">{person.name}</p>
    <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-1.5 text-[12px]"><span>{t("Громкость")}</span><span className="tabular-nums text-zinc-400">{volume}%</span></div>
    <input type="range" min="0" max="100" step="1" aria-label={t("Громкость собеседника")} value={volume} onChange={event => { const next = Number(event.target.value) / 100; onAudio({ volume: next, muted: next === 0 }); }} className="call-volume-slider mx-3 mb-2 h-9 w-[calc(100%-24px)] cursor-pointer" style={{ "--call-volume": `${volume}%` } as CSSProperties} />
    <button type="button" onClick={() => onAudio({ volume: person.volume && person.volume > 0 ? person.volume : 1, muted: !silent })} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/5">{silent ? <Volume2 size={18} /> : <FaVolumeMute size={18} />}{t(silent ? "Включить звук" : "Выключить звук")}</button>
    {(person.screen || person.video) && <button type="button" onClick={onExpand} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/5"><Maximize2 size={17} />{t(person.screen ? "Развернуть демонстрацию" : "Развернуть видео")}</button>}
  </motion.div>, document.body);
}
