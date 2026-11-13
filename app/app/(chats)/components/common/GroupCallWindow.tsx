"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MicOff, MonitorUp, PhoneOff, Users, Volume2, X } from "lucide-react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { BsCameraVideoFill, BsCameraVideoOffFill } from "react-icons/bs";
import { IoIosCall } from "react-icons/io";
import { PiWaveformBold } from "react-icons/pi";
import { MediaAvatar } from "@/components/ui/media";
import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";
import { useLanguage, useTranslation } from "@/components/LocaleProvider";
import { plural } from "@/lib/i18n/translate";
import { getChatHeaderVisualStyle } from "@/lib/client/panel-visual";
import { PANEL_EASE, PANEL_TRANSITION } from "@/lib/client/panel-motion";
import { CallElapsed } from "./CallElapsed";
import { CallConnectionEmojis } from "./CallConnectionEmojis";
import { CallAmbientGradient } from "./CallAmbientGradient";
import { GroupCallVoiceWaves } from "./GroupCallVoiceWaves";
import { CallAvatarVoiceHalo } from "./CallAvatarVoiceHalo";
import { useCallTrayTarget } from "../../hooks/useCallTrayTarget";
import { callControlStyle, callWindowMaterial } from "@/lib/client/call-window-style";
import { CALL_END_FEEDBACK_MS } from "@/lib/client/call-window-motion";
import { groupVoiceChannel, GROUP_VOICE_COLORS, type GroupVoiceSample } from "@/lib/client/group-call-voice";

export type GroupCallPerson = {
  id: string; name: string; avatarUrl?: string | null; local: boolean;
  muted: boolean; speaking: boolean; color?: string; video?: ReactNode; screen?: ReactNode;
};
type Props = {
  callId: string; readVoiceLevels?: () => GroupVoiceSample[];
  title: string; status: string; startedAt: number | null; people: GroupCallPerson[];
  minimized: boolean; glass: boolean; busy: boolean; controlsDisabled: boolean; finished: boolean;
  microphone: boolean; camera: boolean; sharing: boolean; canShare: boolean; canEnd: boolean;
  audioBlocked: boolean; onEnableAudio: () => void;
  onMinimize: () => void; onExpand: () => void; onLeave: () => void; onEnd: () => void;
  onMicrophone: () => void; onCamera: () => void; onShare: () => void;
};

const Tile = memo(function Tile({ person, compact, onSelect, readLevel }: { person: GroupCallPerson; compact?: boolean; onSelect: () => void; readLevel: (id: string) => number }) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  return <button type="button" data-group-call-person={person.id} data-speaking={person.speaking && !person.muted} onClick={onSelect}
    aria-label={t("Закрепить видео: {0}", { 0: person.local ? t("Вы") : person.name })}
    style={person.speaking && !person.muted ? { borderColor: person.color ?? "#fff", boxShadow: `inset 0 0 0 1px ${person.color ?? "#fff"}30` } : undefined}
    className={`relative isolate flex min-w-0 items-center justify-center overflow-hidden rounded-[22px] border bg-white/[0.025] text-white transition-[border-color,box-shadow] duration-200 ${compact ? "aspect-[4/3] w-36 shrink-0" : "aspect-[16/11] w-full"} ${person.speaking && !person.muted ? "border-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]" : "border-white/[0.06]"}`}>
    <AnimatePresence initial={false}>
      <motion.div key={person.video ? "video" : "avatar"} className="pointer-events-none absolute inset-0 flex items-center justify-center [&_video]:!object-cover"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18, ease: PANEL_EASE }}>
        {person.video ?? <div className={`relative ${compact ? "size-12" : "size-[72px] sm:size-[88px]"}`}>
          {!reduced && !person.muted && <CallAvatarVoiceHalo color={person.color} maxFps={30} readLevels={() => ({ local: 0, remote: readLevel(person.id) })} />}
          <MediaAvatar src={person.avatarUrl ?? undefined} alt={person.name} fallbackText={person.name.slice(0, 1)} className="relative size-full rounded-full" />
        </div>}
      </motion.div>
    </AnimatePresence>
    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex min-w-0 items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-7">
      {person.muted ? <MicOff size={14} className="shrink-0 text-white/65" /> : <PiWaveformBold size={15} className={`shrink-0 ${person.speaking ? "text-white" : "text-white/40"}`} />}
      <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium">{person.local ? t("Вы") : person.name}</span>
      {person.screen && <MonitorUp size={14} className="shrink-0 text-white/70" />}
    </span>
  </button>;
});

export default function GroupCallWindow(props: Props) {
  const t = useTranslation(), { locale } = useLanguage(), reduced = useReducedMotion();
  const [participantsOpen, setParticipantsOpen] = useState(false), [endOpen, setEndOpen] = useState(false), [pinnedId, setPinnedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { readVoiceLevels } = props;
  const voiceCache = useRef({ frame: -1, levels: new Map<string, number>() });
  const readLevel = useCallback((id: string) => {
    // Every tile shares one sample of all participants per animation frame.
    const frame = Math.floor(performance.now() / (1000 / 30));
    if (voiceCache.current.frame !== frame) voiceCache.current = { frame, levels: new Map((readVoiceLevels?.() ?? []).map(sample => [sample.id, sample.level])) };
    return voiceCache.current.levels.get(id) ?? 0;
  }, [readVoiceLevels]);
  const overlay = useRef<HTMLElement>(null), drawerButton = useRef<HTMLButtonElement>(null), drawerId = useId(), headingId = useId();
  const { minimized, people, finished, onMinimize } = props;
  const material = { ...getChatHeaderVisualStyle(props.glass), border: 0 };
  const windowMaterial = callWindowMaterial(props.glass);
  const miniTarget = useCallTrayTarget();
  const [emojisAt] = useState(() => Date.now());
  useEffect(() => {
    if (!finished) return;
    // Dismiss during useCalls' closing retention, before its presentation unmounts.
    const timer = window.setTimeout(() => setDismissed(true), CALL_END_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [finished]);
  useLayoutEffect(() => {
    if (minimized) return;
    const sidebar = document.querySelector<HTMLElement>("[data-call-sidebar]");
    if (!sidebar) return;
    const sync = () => overlay.current?.style.setProperty("--call-panel-left", `${Math.round(sidebar.getBoundingClientRect().right + 12)}px`);
    sync(); const observer = new ResizeObserver(sync); observer.observe(sidebar); window.addEventListener("resize", sync);
    return () => { observer.disconnect(); window.removeEventListener("resize", sync); };
  }, [minimized]);
  useEffect(() => {
    if (minimized) return;
    const previous = document.activeElement as HTMLElement | null;
    overlay.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [minimized]);
  const pinned = people.find(person => person.id === pinnedId);
  const sharing = people.find(person => person.screen);
  const stage = pinned ?? sharing;
  const stageVideo = pinned ? pinned.video : sharing?.screen;
  const count = plural(people.length, ["участник", "участника", "участников"], "participant", locale);
  const control = callControlStyle(props.glass);
  const label = "mt-2 block text-center text-[10px] leading-4 text-zinc-400";
  const tiles = people.map(person => ({ ...person, color: GROUP_VOICE_COLORS[groupVoiceChannel(props.callId, person.id, person.local)] }));
  const leave = () => { if (props.canEnd && !finished) setEndOpen(true); else props.onLeave(); };
  const choose = (id: string) => setPinnedId(previous => previous === id ? null : id);
  return <>
    {miniTarget && createPortal(<AnimatePresence propagate>{minimized && !dismissed && <motion.div key="mini" data-group-call-tray className="w-full overflow-hidden"
      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .24, ease: PANEL_EASE }}>
      <div className={miniTarget.id === "global-music-list-slot" ? "pb-3 pt-0.5" : ""}>
      <motion.aside data-group-call-mini aria-label={t("Видеочат")} className="relative isolate flex h-9 w-full items-center gap-2 overflow-hidden rounded-full px-3 text-white [&>button]:relative [&>button]:z-10" style={material}
      initial={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : -7 }} transition={{ duration: reduced ? .12 : .24, ease: [.22, 1, .36, 1] }}>
      <GroupCallVoiceWaves callId={props.callId} readLevels={props.readVoiceLevels} />
      <button type="button" onClick={props.onExpand} aria-label={t("Открыть видеочат")} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"><PiWaveformBold size={16} className="shrink-0 text-zinc-300" /><span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{props.title}</span><span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{props.startedAt !== null ? <CallElapsed startedAt={props.startedAt} /> : t(props.status)}</span></button>
      <button type="button" disabled={props.controlsDisabled} onClick={props.onMicrophone} aria-label={t(props.microphone ? "Выключить микрофон" : "Включить микрофон")} aria-pressed={props.microphone} className={control + " size-7 " + (props.microphone ? "text-zinc-300" : "text-red-400")}>{props.microphone ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}</button>
    </motion.aside></div></motion.div>}</AnimatePresence>, miniTarget)}
    <AnimatePresence propagate>{!minimized && !dismissed && <motion.section key="full" ref={overlay} data-group-call-window role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}
        initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 12, transition: { duration: reduced ? 0 : .2, ease: PANEL_EASE } }} transition={{ duration: reduced ? 0 : .28, ease: PANEL_EASE }} style={windowMaterial}
        className="fixed inset-0 z-[450] flex min-h-0 flex-col overflow-hidden bg-[#18181b] text-white outline-none md:inset-y-3 md:right-3 md:left-[var(--call-panel-left,362px)] md:rounded-[28px] lg:left-[var(--call-panel-left,382px)]"
        onKeyDown={event => {
          if (endOpen) return;
          if (event.key === "Escape") { event.stopPropagation(); if (participantsOpen) { setParticipantsOpen(false); drawerButton.current?.focus(); } else onMinimize(); }
          if (event.key === "Tab") { const nodes = overlay.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'); if (nodes?.length) { const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay.current)) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }
        }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">{props.startedAt !== null && !finished && <motion.div className="absolute -inset-1/2 rounded-full" style={{ background: "radial-gradient(circle,rgba(34,112,78,.55),rgba(17,57,43,.7) 55%,rgba(14,40,33,.8))" }} initial={{ scale: reduced ? 1 : 0 }} animate={{ scale: 1 }} transition={{ duration: reduced ? 0 : 1.1, ease: [.4,0,.2,1] }} />}<CallAmbientGradient glass={props.glass} connecting={!props.startedAt} reducedMotion={Boolean(reduced)} /></div>
        <header className="relative z-10 flex h-[76px] shrink-0 items-center justify-center px-4 pt-[env(safe-area-inset-top)] sm:px-5">
          <button type="button" onClick={onMinimize} aria-label={t("Свернуть видеочат")} className={control + " absolute left-4 size-10 text-zinc-200 md:left-5"}><ChevronDown size={23} /></button>
          {!finished && <CallConnectionEmojis callId={props.callId} startedAt={emojisAt} glass={props.glass} />}
          <button ref={drawerButton} type="button" onClick={() => setParticipantsOpen(value => !value)} aria-label={t("Участники")} aria-expanded={participantsOpen} aria-controls={drawerId} className={control + " absolute right-4 size-10 text-zinc-200 md:right-5"}><Users size={20} /></button>
        </header>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar overscroll-contain px-4 py-3 sm:px-8" style={{ justifyContent: "safe center" }}>
          <div className="mb-5 shrink-0 text-center"><h2 id={headingId} className="truncate text-[23px] font-semibold leading-8 tracking-tight">{props.title}</h2><p className="mt-1 flex items-center justify-center gap-2 text-[13px] leading-5 text-zinc-400"><span>{count}</span>{props.startedAt !== null && !finished && <><span aria-hidden>·</span><CallElapsed startedAt={props.startedAt} /></>}</p></div>
          {finished ? <div role="status" className="grid h-full min-h-60 place-items-center text-[17px] font-medium text-zinc-300">{t("Видеочат завершён")}</div> : <>
            {props.status !== "На связи" && <p role="status" className="mb-3 text-center text-[12px] text-zinc-400">{t(props.status)}</p>}
            {stage ? <div data-group-call-stage>
              <div className="relative flex aspect-video min-h-48 items-center justify-center overflow-hidden rounded-[24px] bg-black">
                {stageVideo ?? <div className="relative size-24">
                  {!reduced && !stage.muted && <CallAvatarVoiceHalo maxFps={30} color={GROUP_VOICE_COLORS[groupVoiceChannel(props.callId, stage.id, stage.local)]} readLevels={() => ({ local: 0, remote: readLevel(stage.id) })} />}
                  <MediaAvatar src={stage.avatarUrl ?? undefined} alt={stage.name} fallbackText={stage.name.slice(0, 1)} className="relative size-full rounded-full" />
                </div>}
                <span className="absolute bottom-3 left-4 text-[12px] font-medium text-white">{stage.local ? t("Вы") : stage.name}{!pinned && ` · ${t("Демонстрация экрана")}`}</span>
                {pinned && <button type="button" onClick={() => setPinnedId(null)} aria-label={t("Открепить видео")} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/50 text-white"><X size={18} /></button>}
              </div>
              <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar pb-1">{tiles.map(person => <Tile key={person.id} person={person} compact readLevel={readLevel} onSelect={() => choose(person.id)} />)}</div>
            </div> : <div data-group-call-grid className={`mx-auto grid w-full gap-3 ${people.length === 1 ? "max-w-[240px] grid-cols-1 sm:max-w-[320px]" : people.length === 2 ? "max-w-[860px] grid-cols-1 sm:grid-cols-2" : people.length <= 4 ? "max-w-[860px] grid-cols-2" : "max-w-[860px] grid-cols-2 xl:grid-cols-3"}`}>{tiles.map(person => <Tile key={person.id} person={person} readLevel={readLevel} onSelect={() => choose(person.id)} />)}</div>}
          </>}
        </div>
        {props.audioBlocked && <button type="button" onClick={props.onEnableAudio} className="mx-auto mb-2 flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[12px]"><Volume2 size={16} />{t("Включить звук звонка")}</button>}
        <footer className="relative z-10 shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-3 md:px-8 md:pb-10 md:pt-5">
          <div className="flex items-start justify-center gap-3 md:gap-6">
            <div><button type="button" disabled={props.controlsDisabled} onClick={props.onMicrophone} aria-label={t(props.microphone ? "Выключить микрофон" : "Включить микрофон")} aria-pressed={props.microphone} className={control + " size-12 " + (props.microphone ? "text-zinc-200" : "text-white")}><span className={props.controlsDisabled ? "opacity-35" : ""}>{props.microphone ? <FaMicrophone size={21} /> : <FaMicrophoneSlash size={21} />}</span></button><span className={label}>{t("Микрофон")}</span></div>
            <div><button type="button" disabled={props.controlsDisabled} onClick={props.onCamera} aria-label={t(props.camera ? "Выключить камеру" : "Включить камеру")} aria-pressed={props.camera} className={control + " size-12 " + (props.camera ? "text-white" : "text-zinc-200")}><span className={props.controlsDisabled ? "opacity-35" : ""}>{props.camera ? <BsCameraVideoFill size={21} /> : <BsCameraVideoOffFill size={21} />}</span></button><span className={label}>{t("Камера")}</span></div>
            {props.canShare && <div><button type="button" disabled={props.controlsDisabled} onClick={props.onShare} aria-label={t(props.sharing ? "Остановить показ экрана" : "Показать экран")} aria-pressed={props.sharing} className={control + " size-12 " + (props.sharing ? "text-emerald-400" : "text-zinc-200")}><MonitorUp size={21} className={props.controlsDisabled ? "opacity-35" : ""} /></button><span className={label}>{t("Экран")}</span></div>}
            <div><button type="button" disabled={props.busy} onClick={leave} aria-label={t("Покинуть видеочат")} className={control + " size-12 text-red-400 hover:text-red-300"}><IoIosCall size={23} /></button><span className={label}>{t("Покинуть")}</span></div>
          </div>
        </footer>
        <AnimatePresence>{participantsOpen && <motion.aside id={drawerId} key="participants" aria-label={t("Участники видеочата")} className="absolute top-[76px] bottom-[132px] right-0 z-20 flex w-[min(300px,calc(100%_-_24px))] flex-col rounded-l-[24px] border-l border-white/8 shadow-2xl" initial={{ opacity: 0, x: reduced ? 0 : 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : 24 }} transition={PANEL_TRANSITION} style={callWindowMaterial(props.glass)}>
          <div className="flex h-14 shrink-0 items-center gap-2 px-4"><h3 className="flex-1 text-[15px] font-semibold">{t("Участники")}</h3><button type="button" onClick={() => { setParticipantsOpen(false); drawerButton.current?.focus(); }} aria-label={t("Закрыть список участников")} className="grid size-9 place-items-center rounded-full text-zinc-400 hover:bg-white/5"><X size={19} /></button></div>
          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-2 pb-4">{people.map(person => <button key={person.id} type="button" onClick={() => { choose(person.id); setParticipantsOpen(false); }} className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-white/5"><MediaAvatar src={person.avatarUrl ?? undefined} alt={person.name} fallbackText={person.name.slice(0, 1)} className="size-10 rounded-full" /><span className="min-w-0 flex-1 truncate text-[13px]">{person.local ? t("Вы") : person.name}</span>{person.muted ? <MicOff size={16} className="text-zinc-500" /> : <PiWaveformBold size={17} className={person.speaking ? "text-white" : "text-zinc-500"} />}</button>)}</div>
        </motion.aside>}</AnimatePresence>
      </motion.section>}
    </AnimatePresence>
    <ConfirmationSheet open={endOpen && props.canEnd && !finished} onOpenChange={setEndOpen} mobileSheet hideCancel dialogStyle={windowMaterial}
      title={<span className="block text-center">{t("Покинуть звонок?")}</span>}
      details={<button type="button" disabled={props.busy} onClick={() => { setEndOpen(false); props.onLeave(); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/[0.06] text-[14px] font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-40">{t("Покинуть звонок")}</button>}
      actionLabel={t("Завершить для всех")} actionIcon={PhoneOff} actionDisabled={props.busy} cancelLabel={t("Отмена")} zIndex={500}
      footerClassName="mt-2 mr-0 mb-0 flex-col-reverse items-stretch gap-2" cancelClassName="w-full rounded-full normal-case text-zinc-400 hover:text-white"
      actionClassName="h-11 w-full rounded-full bg-white/[0.06] normal-case hover:bg-white/10"
      onAction={() => { setEndOpen(false); props.onEnd(); }} />
  </>;
}
