"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MonitorUp, PhoneOff, Volume2, X } from "lucide-react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { BsCameraVideoFill, BsCameraVideoOffFill } from "react-icons/bs";
import { IoIosCall, IoMdEyeOff } from "react-icons/io";
import { IoEye } from "react-icons/io5";
import { PiWaveformBold } from "react-icons/pi";
import { MediaAvatar } from "@/components/ui/media";
import { ConfirmationSheet } from "@/components/ui/confirmation-sheet";
import { useLanguage, useTranslation } from "@/components/LocaleProvider";
import { plural } from "@/lib/i18n/translate";
import { getChatHeaderVisualStyle } from "@/lib/client/panel-visual";
import { PANEL_EASE } from "@/lib/client/panel-motion";
import { CallElapsed } from "./CallElapsed";
import { CallConnectionEmojis } from "./CallConnectionEmojis";
import { CallAmbientGradient } from "./CallAmbientGradient";
import { GroupCallVoiceWaves } from "./GroupCallVoiceWaves";
import { CallAvatarVoiceHalo } from "./CallAvatarVoiceHalo";
import { GroupCallParticipantTile as Tile } from "./GroupCallParticipantTile";
import { GroupCallParticipantStrip } from "./GroupCallParticipantStrip";
import { GroupCallOverflow } from "./GroupCallOverflow";
import { GroupCallParticipantMenu } from "./GroupCallParticipantMenu";
import { CallConnectionIndicator } from "./CallConnectionIndicator";
import type { CallSignal } from "@/lib/client/call-connection-quality";
import { GROUP_CALL_MAIN_LIMIT } from "@/lib/client/group-call-layout";
import { useCallReturnAnimation } from "../../hooks/useCallReturnAnimation";
import { useCallTrayTarget } from "../../hooks/useCallTrayTarget";
import { callControlStyle, callControlSurface, callWindowMaterial } from "@/lib/client/call-window-style";
import { CALL_CONNECT_SECONDS, CALL_RETURN_SECONDS, CALL_EXIT_SECONDS } from "@/lib/client/call-window-motion";
import { type GroupVoiceSample } from "@/lib/client/group-call-voice";

export type GroupCallPerson = {
  id: string; name: string; avatarUrl?: string | null; local: boolean;
  muted: boolean; speaking: boolean; volume?: number; locallyMuted?: boolean; color?: string; video?: ReactNode; screen?: ReactNode;
};
type Props = {
  callId: string; readVoiceLevels?: () => GroupVoiceSample[]; signal?: CallSignal;
  title: string; avatarUrl?: string | null; endReason?: "left" | "ended"; status: string; startedAt: number | null; people: GroupCallPerson[];
  minimized: boolean; glass: boolean; busy: boolean; controlsDisabled: boolean; finished: boolean;
  microphone: boolean; camera: boolean; sharing: boolean; canShare: boolean; canEnd: boolean;
  audioBlocked: boolean; onEnableAudio: () => void;
  onMinimize: () => void; onExpand: () => void; onLeave: () => void; onEnd: () => void;
  onMicrophone: () => void; onCamera: () => void; onShare: () => void;
  onParticipantAudio?: (id: string, audio: { volume: number; muted: boolean }) => void;
};


export default function GroupCallWindow(props: Props) {
  const t = useTranslation(), { locale } = useLanguage(), reduced = useReducedMotion();
  const [endOpen, setEndOpen] = useState(false), [focus, setFocus] = useState<{ id: string; screen: boolean } | null>(null);
  const [showStagePeople, setShowStagePeople] = useState(true);
  const [personMenu, setPersonMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const closePersonMenu = useCallback(() => setPersonMenu(null), []);
  const openPersonMenu = useCallback((id: string, anchor: HTMLElement) => setPersonMenu({ id, anchor }), []);
  const { readVoiceLevels } = props;
  const voiceCache = useRef({ frame: -1, levels: new Map<string, number>() });
  const readLevel = useCallback((id: string) => {
    // Every tile shares one sample of all participants per animation frame.
    const frame = Math.floor(performance.now() / (1000 / 30));
    if (voiceCache.current.frame !== frame) voiceCache.current = { frame, levels: new Map((readVoiceLevels?.() ?? []).map(sample => [sample.id, sample.level])) };
    return voiceCache.current.levels.get(id) ?? 0;
  }, [readVoiceLevels]);
  const overlay = useRef<HTMLElement>(null), headingId = useId();
  const mainScroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let width = window.innerWidth;
    if (mainScroll.current) mainScroll.current.scrollTop = 0;
    const resize = () => { if (window.innerWidth !== width) { width = window.innerWidth; if (mainScroll.current) mainScroll.current.scrollTop = 0; } };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const { minimized, finished, onMinimize } = props;
  const people = useMemo(() => [...props.people].sort((a, b) => Number(b.local) - Number(a.local)), [props.people]);
  const endLabel = t(props.endReason === "left" ? "Вы покинули видеочат" : "Видеочат завершён");
  const material = { ...getChatHeaderVisualStyle(props.glass), border: 0 };
  const windowMaterial = callWindowMaterial(props.glass);
  const miniTarget = useCallTrayTarget();
  const [emojisAt] = useState(() => Date.now());
  const { setAvatarRef, connectionWave, waveComplete, showWave, returning, closingWindow, onWaveComplete } = useCallReturnAnimation({ connected: props.startedAt !== null, terminal: finished, completed: finished, minimized, host: overlay });
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
  const pinned = people.find(person => person.id === focus?.id);
  const menuPerson = people.find(person => person.id === personMenu?.id && !person.local);
  const stage = pinned && (!focus?.screen || pinned.screen) ? pinned : undefined;
  const stageVideo = focus?.screen ? stage?.screen : stage?.video;
  const tiles = people.slice(0, GROUP_CALL_MAIN_LIMIT), overflow = people.slice(GROUP_CALL_MAIN_LIMIT);
  const layoutKey = tiles.map(person => person.id).join(":") + Boolean(overflow.length);
  const count = plural(people.length, ["участник", "участника", "участников"], "participant", locale);
  const control = callControlStyle(props.glass);
  const label = "mt-2 block text-center text-[10px] leading-4 text-zinc-400";
  const leave = () => { if (props.canEnd && !finished) setEndOpen(true); else props.onLeave(); };
  const minimize = () => { closePersonMenu(); onMinimize(); };
  const choose = (id: string) => {
    closePersonMenu();
    setShowStagePeople(true);
    const screen = Boolean(people.find(person => person.id === id)?.screen);
    setFocus(previous => previous?.id === id && previous.screen === screen && stage ? null : { id, screen });
    overlay.current?.focus({ preventScroll: true });
  };
  const closeStage = () => { setFocus(null); overlay.current?.focus({ preventScroll: true }); };
  return <>
    {miniTarget && createPortal(<AnimatePresence propagate>{minimized && !closingWindow && <motion.div key="mini" data-group-call-tray className="w-full overflow-hidden"
      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .24, ease: PANEL_EASE }}>
      <div className={miniTarget.id === "global-music-list-slot" ? "pb-3 pt-0.5" : ""}>
      <motion.aside data-group-call-mini aria-label={t("Видеочат")} className="relative isolate flex h-9 w-full items-center gap-2 overflow-hidden rounded-full px-3 text-white [&>button]:relative [&>button]:z-10" style={material}
      initial={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : -7 }} transition={{ duration: reduced ? .12 : .24, ease: [.22, 1, .36, 1] }}>
      <GroupCallVoiceWaves callId={props.callId} readLevels={props.readVoiceLevels} />
      <button type="button" onClick={props.onExpand} aria-label={t("Открыть видеочат")} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left">{finished ? <MediaAvatar src={props.avatarUrl ?? undefined} alt={props.title} fallbackText={props.title.slice(0, 2)} className="size-6 shrink-0 rounded-full" /> : <PiWaveformBold size={16} className="shrink-0 text-zinc-300" />}<span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{props.title}</span><span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{finished ? endLabel : props.startedAt !== null ? <CallElapsed startedAt={props.startedAt} /> : t(props.status)}</span></button>
      <button type="button" disabled={props.controlsDisabled} onClick={props.onMicrophone} aria-label={t(props.microphone ? "Выключить микрофон" : "Включить микрофон")} aria-pressed={props.microphone} className={control + " size-7 " + (props.microphone ? "text-zinc-300" : "text-red-400")}>{props.microphone ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}</button>
    </motion.aside></div></motion.div>}</AnimatePresence>, miniTarget)}
    <AnimatePresence propagate>{!minimized && !closingWindow && <motion.section key="full" ref={overlay} data-group-call-window role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}
        initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 18, transition: { duration: reduced ? 0 : CALL_EXIT_SECONDS, ease: [.4, 0, 1, 1] } }} transition={{ duration: reduced ? 0 : .28, ease: PANEL_EASE }} style={windowMaterial}
        className="fixed inset-0 z-[450] flex min-h-0 flex-col overflow-hidden bg-[#18181b] text-white outline-none md:inset-y-3 md:right-3 md:left-[var(--call-panel-left,362px)] md:rounded-[28px] lg:left-[var(--call-panel-left,382px)]"
        onKeyDown={event => {
          if (endOpen) return;
          if (event.key === "Escape") { event.stopPropagation(); if (stage) closeStage(); else minimize(); }
          if (event.key === "Tab") { const nodes = overlay.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'); if (nodes?.length) { const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay.current)) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }
        }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {!showWave && !finished && <CallAmbientGradient glass={props.glass} connecting={!props.startedAt} reducedMotion={Boolean(reduced)} />}
          {showWave && <motion.div ref={connectionWave} data-group-call-returning={returning || undefined} className="absolute rounded-full" style={{ willChange: "transform", backfaceVisibility: "hidden", background: "radial-gradient(circle,rgba(72,72,77,.55),rgba(40,40,44,.7) 55%,rgba(28,28,31,.8))" }} initial={waveComplete || reduced ? false : { scale: 0, opacity: 1 }} animate={{ scale: returning ? 0 : 1, opacity: 1 }} transition={{ duration: reduced ? 0 : returning ? CALL_RETURN_SECONDS : CALL_CONNECT_SECONDS, ease: returning ? [.4,0,.6,1] : [.4,0,.2,1] }} onAnimationComplete={onWaveComplete} />}
        </div>
        <header className={`relative z-10 flex shrink-0 items-center justify-center px-4 pt-[env(safe-area-inset-top)] sm:px-5 ${stage ? "h-16" : "h-16 md:h-[76px]"}`}>
          <button type="button" onClick={minimize} aria-label={t("Свернуть видеочат")} className={control + " absolute left-4 size-10 text-zinc-200 md:left-5"}><ChevronDown size={23} /></button>
          {!finished && <CallConnectionEmojis callId={props.callId} startedAt={emojisAt} glass={props.glass} />}
          <div className="absolute right-4 sm:right-5"><CallConnectionIndicator signal={props.signal} glass={props.glass} /></div>
        </header>
        <div className={`relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain px-4 py-2 sm:px-8 md:py-3`} style={{ justifyContent: stage ? undefined : "safe center" }}>
          <div className={stage || finished ? "sr-only" : "mb-3 shrink-0 text-center md:mb-5"}><h2 id={headingId} className="truncate text-[18px] font-semibold leading-6 tracking-tight min-[380px]:text-[20px] md:text-[23px] md:leading-8">{props.title}</h2><p className="mt-1 flex items-center justify-center gap-2 text-[11px] leading-5 md:text-[13px] text-zinc-400"><span>{count}</span>{props.startedAt !== null && !finished && <><span aria-hidden>·</span><CallElapsed startedAt={props.startedAt} /></>}</p></div>
          <AnimatePresence initial={false} mode="wait">{finished ? <motion.div key="result" data-group-call-result role="status" className="flex min-h-60 flex-1 flex-col items-center justify-center gap-5 pb-4 text-center" initial={{ opacity: 0, scale: reduced ? 1 : .95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduced ? 0 : .24, ease: PANEL_EASE }}>
            <div ref={setAvatarRef} data-group-call-result-avatar className="relative size-36 rounded-full md:size-40"><MediaAvatar src={props.avatarUrl ?? undefined} alt={props.title} fallbackText={props.title.slice(0, 2)} className="size-full rounded-full shadow-xl" /></div>
            <div><p className="text-[23px] font-semibold leading-8">{props.title}</p><p className="mt-1 text-[14px] text-zinc-400">{endLabel}</p></div>
          </motion.div> : <motion.div key="conversation" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: reduced ? 1 : .98 }} transition={{ duration: reduced ? 0 : .16, ease: PANEL_EASE }}>
            <div className="flex min-h-0 flex-1 flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-4">
            <div ref={mainScroll} className={`flex min-h-0 min-w-0 flex-1 flex-col no-scrollbar md:h-full ${stage ? "overflow-hidden" : "overflow-y-auto"}`} data-group-call-main-scroll style={{ justifyContent: stage ? undefined : "safe center", overflowAnchor: "none" }}>
            {stage ? <motion.div key="stage" data-group-call-stage className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .18, ease: PANEL_EASE }}>
              <div data-group-call-stage-media className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-black/80 [&>video]:!object-contain">
                {stageVideo ?? <div className="relative size-24">
                  {!reduced && !stage.muted && <CallAvatarVoiceHalo proportional maxFps={30} readLevels={() => ({ local: 0, remote: readLevel(stage.id) })} />}
                  <MediaAvatar src={stage.avatarUrl ?? undefined} alt={stage.name} fallbackText={stage.name.slice(0, 1)} className="relative size-full rounded-full" />
                </div>}
                <span className="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-80px)] items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">{focus?.screen && <MonitorUp size={14} className="shrink-0" />}{focus?.screen && stage.local ? t("Вы демонстрируете экран") : <>{stage.name}{focus?.screen && ` · ${t("Демонстрация экрана")}`}</>}</span>
                <button type="button" onClick={closeStage} aria-label={t("Открепить видео")} className={control + " absolute right-3 top-3 size-9 text-white"}><X size={18} /></button>
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-end gap-2 p-2 sm:p-3">
                  <button type="button" data-group-call-people-toggle onClick={() => setShowStagePeople(value => !value)} aria-label={t(showStagePeople ? "Скрыть участников" : "Показать участников")} aria-expanded={showStagePeople} className={callControlSurface(props.glass) + " size-9 shrink-0 text-white transition-colors hover:bg-white/10"}>{showStagePeople ? <IoMdEyeOff size={19} /> : <IoEye size={19} />}</button>
                  <AnimatePresence initial={false}>{showStagePeople && <GroupCallParticipantStrip key="stage-people" glass={props.glass}>
                    <AnimatePresence initial={false} mode="popLayout">{people.map(person => <motion.div key={person.id} data-group-call-strip-person={person.id} layout="position" className="w-[104px] shrink-0 sm:w-[136px]" initial={{ opacity: 0, scale: reduced ? 1 : .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .22, ease: PANEL_EASE }}>
                      <Tile person={person} compact glass={props.glass} readLevel={readLevel} onMenu={props.onParticipantAudio ? openPersonMenu : undefined} onSelect={() => choose(person.id)} />
                    </motion.div>)}</AnimatePresence>
                  </GroupCallParticipantStrip>}</AnimatePresence>
                </div>
              </div>
            </motion.div> : <motion.div data-group-call-grid initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .18, ease: PANEL_EASE }} className={`mx-auto grid w-full shrink-0 gap-3 ${tiles.length === 1 ? "max-w-[240px] grid-cols-1 sm:max-w-[320px]" : tiles.length === 2 ? "max-w-[860px] grid-cols-1 sm:grid-cols-2" : tiles.length <= 4 ? "max-w-[860px] grid-cols-2" : tiles.length > 6 ? "max-w-[960px] grid-cols-2 xl:grid-cols-4" : "max-w-[860px] grid-cols-2 xl:grid-cols-3"}`}>
              <AnimatePresence initial={false} mode="popLayout">{tiles.map(person => <motion.div key={person.id} data-group-call-tile-layout layout="position" layoutDependency={layoutKey} className="min-w-0" initial={{ opacity: 0, scale: reduced ? 1 : .94, y: reduced ? 0 : 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: reduced ? 1 : .96, transition: { duration: reduced ? 0 : .14 } }} transition={{ duration: reduced ? 0 : .24, ease: PANEL_EASE }}><Tile person={person} glass={props.glass} readLevel={readLevel} onMenu={props.onParticipantAudio ? openPersonMenu : undefined} onSelect={() => choose(person.id)} /></motion.div>)}</AnimatePresence>
            </motion.div>}
            </div>
            <AnimatePresence initial={false}>{!stage && overflow.length > 0 && <motion.div key="overflow" data-group-call-overflow-slot className="flex min-h-0 shrink-0 overflow-hidden md:items-center md:self-stretch" initial={{ opacity: 0, scale: reduced ? 1 : .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduced ? 1 : .98 }} transition={{ duration: reduced ? 0 : .24, ease: PANEL_EASE }}>
              <GroupCallOverflow people={overflow} glass={props.glass} readLevel={readLevel} onSelect={choose} onMenu={props.onParticipantAudio ? openPersonMenu : undefined} />
            </motion.div>}</AnimatePresence>
            </div>
          </motion.div>}</AnimatePresence>
        </div>
        {props.audioBlocked && <button type="button" onClick={props.onEnableAudio} className="mx-auto mb-2 flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[12px]"><Volume2 size={16} />{t("Включить звук звонка")}</button>}
        <footer className="relative z-10 shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 md:px-8 md:pb-10 md:pt-5">
          <AnimatePresence initial={false} mode="wait">{!finished && props.status !== "На связи" && <motion.p key={props.status} data-group-call-connection-status role="status" className="overflow-hidden text-center text-[12px] leading-5 text-zinc-400" initial={{ height: 0, opacity: 0, marginBottom: 0 }} animate={{ height: "auto", opacity: 1, marginBottom: 12 }} exit={{ height: 0, opacity: 0, marginBottom: 0 }} transition={{ duration: reduced ? 0 : .18, ease: PANEL_EASE }}>{t(props.status)}</motion.p>}</AnimatePresence>
          <div className="flex items-start justify-center gap-3 md:gap-6">
            <div><button type="button" disabled={props.controlsDisabled} onClick={props.onMicrophone} aria-label={t(props.microphone ? "Выключить микрофон" : "Включить микрофон")} aria-pressed={props.microphone} className={control + " size-11 md:size-12 " + (props.microphone ? "text-zinc-200" : "text-white")}><span className={props.controlsDisabled ? "opacity-35" : ""}>{props.microphone ? <FaMicrophone size={21} /> : <FaMicrophoneSlash size={21} />}</span></button><span className={label}>{t("Микрофон")}</span></div>
            <div><button type="button" disabled={props.controlsDisabled} onClick={props.onCamera} aria-label={t(props.camera ? "Выключить камеру" : "Включить камеру")} aria-pressed={props.camera} className={control + " size-11 md:size-12 " + (props.camera ? "text-white" : "text-zinc-200")}><span className={props.controlsDisabled ? "opacity-35" : ""}>{props.camera ? <BsCameraVideoFill size={21} /> : <BsCameraVideoOffFill size={21} />}</span></button><span className={label}>{t("Камера")}</span></div>
            {props.canShare && <div><button type="button" disabled={props.controlsDisabled} onClick={props.onShare} aria-label={t(props.sharing ? "Остановить показ экрана" : "Показать экран")} aria-pressed={props.sharing} className={control + " size-11 md:size-12 " + (props.sharing ? "text-emerald-400" : "text-zinc-200")}><MonitorUp size={21} className={props.controlsDisabled ? "opacity-35" : ""} /></button><span className={label}>{t("Экран")}</span></div>}
            <div><button type="button" disabled={props.busy} onClick={leave} aria-label={t("Покинуть видеочат")} className={control + " size-11 md:size-12 text-red-400 hover:text-red-300"}><IoIosCall size={23} /></button><span className={label}>{t("Покинуть")}</span></div>
          </div>
        </footer>
      </motion.section>}
    </AnimatePresence>
    <AnimatePresence>{!minimized && !finished && menuPerson && personMenu && props.onParticipantAudio && <GroupCallParticipantMenu key={menuPerson.id} person={menuPerson} anchor={personMenu.anchor} glass={props.glass} onClose={closePersonMenu} onAudio={audio => props.onParticipantAudio?.(menuPerson.id, audio)} onExpand={() => choose(menuPerson.id)} />}</AnimatePresence>
    <ConfirmationSheet open={endOpen && props.canEnd && !finished} onOpenChange={setEndOpen} mobileSheet hideCancel hideTitle dialogStyle={windowMaterial}
      title={<span className="block text-center">{t("Покинуть звонок?")}</span>}
      details={<button type="button" disabled={props.busy} onClick={() => { setEndOpen(false); props.onLeave(); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/[0.06] text-[14px] font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-40">{t("Покинуть звонок")}</button>}
      actionLabel={t("Завершить для всех")} actionIcon={PhoneOff} actionDisabled={props.busy} cancelLabel={t("Отмена")} zIndex={500}
      footerClassName="mt-2 mr-0 mb-0 flex-col-reverse items-stretch gap-2" cancelClassName="w-full rounded-full normal-case text-zinc-400 hover:text-white"
      actionClassName="h-11 w-full rounded-full bg-white/[0.06] normal-case hover:bg-white/10"
      onAction={() => { setEndOpen(false); props.onEnd(); }} />
  </>;
}
