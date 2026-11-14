"use client";
import { memo, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2, MicOff, MonitorUp, VolumeX } from "lucide-react";
import { PiWaveformBold } from "react-icons/pi";
import { MediaAvatar } from "@/components/ui/media";
import { useTranslation } from "@/components/LocaleProvider";
import { getChatHeaderVisualStyle } from "@/lib/client/panel-visual";
import { PANEL_EASE } from "@/lib/client/panel-motion";
import { CallAvatarVoiceHalo } from "./CallAvatarVoiceHalo";
import type { GroupCallPerson } from "./GroupCallWindow";

const SPEAKING_COLOR = "#6ee7b7";
export const GroupCallParticipantTile = memo(function GroupCallParticipantTile({ person, onSelect, onMenu, readLevel, glass, compact = false }: { person: GroupCallPerson; onSelect: () => void; onMenu?: (id: string, anchor: HTMLElement) => void; readLevel: (id: string) => number; glass: boolean; compact?: boolean }) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; id: number; x: number; y: number } | null>(null);
  const held = useRef(false);
  const cancelPress = useCallback(() => { if (press.current) clearTimeout(press.current.timer); press.current = null; }, []);
  useEffect(() => cancelPress, [cancelPress]);
  const silent = Boolean(person.locallyMuted);
  const talking = person.speaking && !person.muted && !silent;
  const name = person.local ? t("Вы") : person.name;
  const menuLabel = t("Настройки звука: {0}", { 0: name });
  const expandLabel = t(person.screen ? "Развернуть демонстрацию: {0}" : "Закрепить видео: {0}", { 0: name });
  const canExpand = Boolean(person.screen || person.video);
  return <div data-group-call-person={person.id} data-speaking={talking} data-locally-muted={silent} tabIndex={-1}
    onContextMenu={event => { if (!person.local && onMenu) { event.preventDefault(); cancelPress(); onMenu(person.id, event.currentTarget); } }}
    onPointerDown={event => {
      cancelPress(); held.current = false;
      if (person.local || !onMenu || !event.isPrimary || !["touch", "pen"].includes(event.pointerType)) return;
      const anchor = event.currentTarget;
      press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, timer: setTimeout(() => { press.current = null; held.current = true; onMenu(person.id, anchor); }, 360) };
    }}
    onPointerMove={event => { const start = press.current; if (start && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) cancelPress(); }}
    onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
    onClickCapture={event => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; } }}
    onKeyDown={event => { if (!person.local && onMenu && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) { event.preventDefault(); onMenu(person.id, event.currentTarget); } }}
    style={{ ...getChatHeaderVisualStyle(glass), WebkitTouchCallout: "none", ...(talking ? { borderColor: SPEAKING_COLOR, boxShadow: `inset 0 0 0 1px ${SPEAKING_COLOR}30` } : {}) }}
    className={`relative isolate flex aspect-[16/11] w-full min-w-0 select-none items-center justify-center overflow-hidden ${compact ? "rounded-[16px]" : "rounded-[22px]"} border bg-white/[0.025] text-white transition-[border-color,box-shadow] duration-200 ${talking ? "border-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]" : "border-white/[0.06]"}`}>
    <AnimatePresence initial={false}>
      <motion.div key={person.screen ? "screen" : person.video ? "video" : "avatar"} className={`pointer-events-none absolute inset-0 flex items-center justify-center ${person.screen ? "[&_video]:!object-contain" : "[&_video]:!object-cover"}`}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18, ease: PANEL_EASE }}>
        {person.screen || person.video || <div className="relative aspect-square w-[40%] max-w-[88px] -translate-y-1.5">
          {!reduced && !person.muted && !silent && <CallAvatarVoiceHalo proportional maxFps={30} readLevels={() => ({ local: 0, remote: readLevel(person.id) })} />}
          <MediaAvatar src={person.avatarUrl ?? undefined} alt={person.name} fallbackText={person.name.slice(0, 1)} className="relative size-full rounded-full" />
        </div>}
      </motion.div>
    </AnimatePresence>
    {person.local && person.screen && <span title={t("Вы демонстрируете экран")} className={`pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-44px)] items-center gap-1 rounded-full bg-black/60 text-white backdrop-blur-md ${compact ? "p-1" : "px-2 py-1 text-[10px]"}`}><MonitorUp size={compact ? 12 : 14} className="shrink-0" /><span className={compact ? "sr-only" : "truncate"}>{t("Вы демонстрируете экран")}</span></span>}
    <button type="button" disabled={person.local && !canExpand} className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70" aria-label={canExpand ? expandLabel : !person.local && onMenu ? menuLabel : name}
      onClick={event => { if (canExpand) onSelect(); else if (event.detail === 0 && !person.local && onMenu) onMenu(person.id, event.currentTarget); }} />
    {silent && <span title={t("Звук выключен у вас")} className={`pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-48px)] items-center gap-1 rounded-full bg-black/45 text-white ${compact ? "p-1" : "px-2 py-1 text-[10px]"}`}><VolumeX size={compact ? 12 : 14} className="shrink-0" /><span className={compact ? "sr-only" : "truncate"}>{t("Звук выключен у вас")}</span></span>}
    {canExpand && <button type="button" onClick={onSelect} aria-label={expandLabel} className={`absolute right-2 top-2 grid place-items-center rounded-full bg-black/30 text-white/85 transition-colors hover:bg-black/50 ${compact ? "size-5" : "size-7"}`}><Maximize2 size={compact ? 11 : 14} /></button>}
    <span className={`pointer-events-none absolute inset-x-0 bottom-0 flex min-w-0 items-center bg-gradient-to-t from-black/60 to-transparent ${compact ? "gap-1 px-2 pb-1.5 pt-4" : "gap-2 px-3 pb-3 pt-7"}`}>
      {silent ? <VolumeX size={compact ? 10 : 14} className="shrink-0 text-white/80" /> : person.muted ? <MicOff size={compact ? 10 : 14} className="shrink-0 text-white/65" /> : <PiWaveformBold size={compact ? 11 : 15} className={`shrink-0 ${person.speaking ? "text-white" : "text-white/40"}`} />}
      {person.screen && <MonitorUp size={compact ? 10 : 14} className="shrink-0 text-white/70" />}
      <span className={`min-w-0 flex-1 truncate text-left font-medium ${compact ? "text-[9px] leading-3" : "text-[12px]"}`}>{name}</span>
    </span>
  </div>;
});
