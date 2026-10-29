"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MonitorUp, Phone, Volume2 } from "lucide-react";
import { IoMdMore, IoIosCall } from "react-icons/io";
import { IoCall } from "react-icons/io5";
import { FaMicrophone, FaMicrophoneSlash, FaVolumeMute } from "react-icons/fa";
import { BsCameraVideoFill, BsCameraVideoOffFill } from "react-icons/bs";
import { MediaAvatar, MediaBanner } from "@/components/ui/media";
import { useTranslation } from "@/components/LocaleProvider";
import type { CallSignal } from "@/lib/client/call-connection-quality";
import type { CallView } from "@/lib/calls";
import { CALL_END_FEEDBACK_MS, CALL_END_EFFECT_MS, CALL_RETURN_SECONDS, CALL_EXIT_SECONDS } from "@/lib/client/call-window-motion";
import { menuPopoverMotion } from "@/lib/client/panel-motion";
import { getChatHeaderVisualStyle, getPanelVisualStyle } from "@/lib/client/panel-visual";
import { watchMediaPortalTargets } from "@/lib/client/media-portal-targets";
import { CallVoiceWaves, type CallVoiceLevels } from "./CallVoiceWaves";
import { CallAvatarVoiceHalo } from "./CallAvatarVoiceHalo";
import CallVideoStage from "./CallVideoStage";
import { CallAmbientRibbon } from "./CallAmbientRibbon";
import { getEffectiveProfileGradient, isMediaBackgroundUrl } from "@/lib/profile-gradients";

type Props = {
  name: string; avatarUrl: string | null; backgroundUrl: string | null;
  status: string; duration: string | null; incoming: boolean; owned: boolean;
  minimized: boolean; glass: boolean; busy: boolean; controlsDisabled: boolean;
  microphone: boolean; camera: boolean; sound: boolean; volume: number; onVolume: (value: number) => void; sharing: boolean; speaking: boolean;
  signal?: CallSignal;
  active?: boolean;
  endOutcome?: CallView["endOutcome"];
  readVoiceLevels?: () => CallVoiceLevels;
  video?: ReactNode; localVideo?: ReactNode; secondaryVideo?: ReactNode; sharedPreview?: ReactNode; screenVideo?: boolean; localScreen?: boolean; screenOwner?: string; audioBlocked: boolean; canShare: boolean;
  onMinimize: () => void; onExpand: () => void; onAccept: () => void; onHangup: () => void;
  onMicrophone: () => void; onCamera: () => void; onSound: () => void; onShare: () => void; onEnableAudio: () => void;
};

function AnimatedStatus({ text, timer }: { text: string; timer?: string | null }) {
  return <div role={timer ? "timer" : "status"} aria-live={timer ? "off" : "polite"} className="relative flex h-6 w-full items-center justify-center overflow-hidden text-[14px] leading-5 text-zinc-400">
    <AnimatePresence initial={false} mode="wait"><motion.span key={timer ? "timer" : text} className="max-w-full truncate tabular-nums" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>{timer ?? text}</motion.span></AnimatePresence>
  </div>;
}

export default function PersonalCallWindow(props: Props) {
  const t = useTranslation();
  const reducedMotion = useReducedMotion();
  const [ownCameraFocused, setOwnCameraFocused] = useState<boolean | null>(null);
  const ownVideoExpanded = Boolean(props.localVideo) && (ownCameraFocused === true || (ownCameraFocused === null && !props.video));
  const displayedVideo = ownVideoExpanded ? props.localVideo : props.video;
  const cameraMode = Boolean(displayedVideo) && (ownVideoExpanded || !props.screenVideo) && !props.endOutcome;
  const [cameraLayerVisible, setCameraLayerVisible] = useState(cameraMode);
  if (cameraMode && !cameraLayerVisible) setCameraLayerVisible(true);
  const hideIdentity = cameraMode || cameraLayerVisible;
  const [incomingLayout] = useState(props.incoming);
  const dialog = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (props.minimized) return;
    const sidebar = document.querySelector<HTMLElement>("[data-call-sidebar]");
    if (!sidebar) return;
    const sync = () => overlay.current?.style.setProperty("--call-panel-left", `${Math.round(sidebar.getBoundingClientRect().right + 12)}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(sidebar);
    window.addEventListener("resize", sync);
    return () => { observer.disconnect(); window.removeEventListener("resize", sync); };
  }, [props.minimized]);
  const avatarRef = useRef<HTMLDivElement>(null);
  const [avatarReady, setAvatarReady] = useState(false);
  const updateWaveOrigin = useRef<(() => void) | null>(null);
  const setAvatarRef = useCallback((node: HTMLDivElement | null) => {
    avatarRef.current = node;
    setAvatarReady(Boolean(node));
    if (node) updateWaveOrigin.current?.();
  }, []);
  const connectionWave = useRef<HTMLDivElement>(null);
  const [waveComplete, setWaveComplete] = useState(false);
  const connecting = !props.duration && props.status === "Соединение…";
  const connected = Boolean(props.duration);
  const [wasConnected, setWasConnected] = useState(connected);
  if (connected && !wasConnected) setWasConnected(true);
  const failed = Boolean(props.endOutcome && props.endOutcome !== "completed");
  const completed = props.endOutcome === "completed";
  const terminal = Boolean(props.endOutcome);
  const [terminalSettled, setTerminalSettled] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const closingWindow = closeRequested && (!completed || terminalSettled);
  useEffect(() => {
    if (!terminal) return;
    const close = window.setTimeout(() => setCloseRequested(true), CALL_END_FEEDBACK_MS);
    return () => clearTimeout(close);
  }, [terminal]);
  useEffect(() => {
    if (!terminal || (completed && !avatarReady)) return;
    const settle = window.setTimeout(() => setTerminalSettled(true), completed ? CALL_RETURN_SECONDS * 1000 + 30 : CALL_END_EFFECT_MS);
    return () => clearTimeout(settle);
  }, [terminal, completed, avatarReady]);
  const showWave = failed || ((wasConnected || connected) && !terminalSettled);
  const active = (props.active ?? connected) && !props.endOutcome;
  useLayoutEffect(() => {
    const host = dialog.current, wave = connectionWave.current;
    if (!showWave || props.minimized || !host || !wave) return;
    const sync = () => {
      const bounds = host.getBoundingClientRect(), avatar = avatarRef.current?.getBoundingClientRect();
      const x = avatar ? avatar.left + avatar.width / 2 - bounds.left : bounds.width / 2;
      const y = avatar ? avatar.top + avatar.height / 2 - bounds.top : bounds.height * 0.4;
      const radius = Math.hypot(Math.max(x, bounds.width - x), Math.max(y, bounds.height - y)) + 24;
      wave.style.width = wave.style.height = `${radius * 2}px`;
      wave.style.left = `${x - radius}px`; wave.style.top = `${y - radius}px`;
    };
    updateWaveOrigin.current = sync;
    sync(); const observer = new ResizeObserver(sync); observer.observe(host);
    return () => { observer.disconnect(); updateWaveOrigin.current = null; };
  }, [showWave, props.minimized, props.endOutcome]);
  const toolbar = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [volumeOpen, setVolumeOpen] = useState(false);
  useEffect(() => {
    if (!volumeOpen) return;
    toolbar.current?.querySelector<HTMLElement>("[data-call-volume-menu]")?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!toolbar.current?.contains(event.target as Node)) setVolumeOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); setVolumeOpen(false); menuButton.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [volumeOpen]);
  const { name, avatarUrl, backgroundUrl, minimized, incoming, owned, busy, controlsDisabled, onMinimize } = props;
  const material = { ...getChatHeaderVisualStyle(props.glass), border: 0 };
  const windowMaterial = {
    ...material,
    backgroundColor: props.glass ? "rgba(28, 28, 30, 0.86)" : "#1c1c1e",
    backdropFilter: props.glass ? "blur(24px) saturate(1.1)" : "none",
    WebkitBackdropFilter: props.glass ? "blur(24px) saturate(1.1)" : "none",
  };
  const [miniTarget, setMiniTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    let mobileChatOpen = Boolean(document.getElementById("global-music-chat-slot")?.getClientRects().length);
    const sync = () => {
      const id = mobile.matches && mobileChatOpen ? "global-music-chat-slot" : "global-music-list-slot";
      setMiniTarget(document.getElementById(id));
    };
    const onChatVisibility = (event: Event) => {
      mobileChatOpen = Boolean((event as CustomEvent<{ mobileChatOpen?: boolean }>).detail?.mobileChatOpen);
      sync();
    };
    const stopWatching = watchMediaPortalTargets(["global-music-list-slot", "global-music-chat-slot"], sync);
    mobile.addEventListener("change", sync);
    window.addEventListener("eclipse:mobile-chat-visibility", onChatVisibility);
    return () => {
      stopWatching();
      mobile.removeEventListener("change", sync);
      window.removeEventListener("eclipse:mobile-chat-visibility", onChatVisibility);
    };
  }, []);
  useEffect(() => {
    if (minimized) return;
    const previous = document.activeElement;
    dialog.current?.focus({ preventScroll: true });
    const focusTimer = window.setTimeout(() => {
      if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus({ preventScroll: true });
    }, 250);
    const keydown = (event: KeyboardEvent) => {
      const host = dialog.current;
      if (event.key === "Escape") { event.preventDefault(); onMinimize(); }
      if (event.key !== "Tab" || !host) return;
      const buttons = [...host.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter(button => button.getClientRects().length > 0);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === host)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === host)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { clearTimeout(focusTimer); document.removeEventListener("keydown", keydown); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, [minimized, onMinimize]);

  const control = `grid shrink-0 place-items-center rounded-full border ${props.glass ? "border-white/[0.07] bg-[rgba(40,40,44,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[8px] backdrop-saturate-[1.05]" : "border-transparent bg-[#252527] shadow-none backdrop-blur-none"} transition-[background-color,color,transform] duration-200 hover:bg-white/20 active:scale-95 active:bg-[var(--ui-accent-solid,#d4d6da)] active:text-[color:var(--ui-accent-contrast,#18181b)] aria-pressed:border-transparent aria-pressed:bg-[var(--ui-accent-solid,#d4d6da)] aria-pressed:text-[color:var(--ui-accent-contrast,#18181b)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-accent-solid,#d4d6da)] disabled:opacity-35`;
  const minimizeControl = <div className="flex flex-col items-center gap-2"><button type="button" onClick={props.onMinimize} aria-label={t("Свернуть звонок")} className={`${control} h-12 w-12 text-zinc-300 hover:text-white`}><ChevronDown size={24} /></button><span className="text-[10px] text-zinc-400 md:text-[11px]">{t("Свернуть")}</span></div>;
  const background = getEffectiveProfileGradient(backgroundUrl, name, name) || "linear-gradient(155deg,#24242b 0%,#17171d 65%,#131318 100%)";

  const signal = props.signal ?? { bars: 0, state: "unknown" };
  const signalLabel = t(signal.state === "reconnecting" ? "Восстанавливаем соединение…" : signal.state === "lost" ? "Соединение потеряно" : signal.state === "poor" ? "Слабое соединение" : signal.state === "unknown" ? "Оцениваем качество соединения" : signal.bars === 4 ? "Отличное соединение" : "Хорошее соединение");
  const toolbarStyle = props.glass ? {
    backgroundColor: "rgba(40,44,47,0.38)",
    backdropFilter: "blur(20px) saturate(1.3)", WebkitBackdropFilter: "blur(20px) saturate(1.3)",
    boxShadow: "0 5px 18px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.055)",
  } : getPanelVisualStyle(false);
  const menuStyle = props.glass ? { ...toolbarStyle, backgroundColor: "rgba(38,42,44,0.68)", backdropFilter: "blur(28px) saturate(1.3)", WebkitBackdropFilter: "blur(28px) saturate(1.3)" } : getPanelVisualStyle(false);

  return <>
    {miniTarget ? createPortal(<AnimatePresence>
      {minimized && !closingWindow && (
      <motion.aside key="personal-mini" aria-label={t("Звонок")} initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "none" }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -7, scale: 0.985, filter: "blur(3px)" }} transition={{ duration: reducedMotion ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative isolate flex h-9 w-full items-center gap-2 overflow-hidden rounded-full px-3 text-white [&>button]:relative [&>button]:z-10" style={material}>
        <CallVoiceWaves readLevels={props.readVoiceLevels} />
        <button type="button" onClick={props.onExpand} aria-label={t("Развернуть звонок")} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-white/60">
          <Phone size={16} className="shrink-0 text-zinc-300" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{props.duration ?? t(props.status)}</span>
        </button>
        {incoming ? <button type="button" onClick={props.onAccept} disabled={busy} aria-label={t("Принять")} className={control + " h-7 w-7 text-emerald-400"}><IoCall size={16} /></button>
          : owned && <button type="button" onClick={props.onMicrophone} disabled={controlsDisabled} aria-label={t(props.microphone ? "Выключить микрофон" : "Включить микрофон")} aria-pressed={props.microphone} className={control + " h-7 w-7 " + (props.microphone ? "text-zinc-300" : "text-red-400")}>{props.microphone ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}</button>}
        {incoming && <button type="button" onClick={props.onHangup} disabled={busy} aria-label={t("Отклонить")} className={control + " h-7 w-7 text-red-400"}><IoCall size={16} /></button>}
      </motion.aside>)}
    </AnimatePresence>, miniTarget) : null}
    <AnimatePresence mode="wait">{!minimized && !closingWindow && (
      <motion.div ref={overlay} key="personal-full" data-call-visual={props.glass ? "glass" : "plain"} style={{ backgroundColor: props.glass ? "transparent" : "#18181c" }} className="fixed inset-0 z-[450] flex overflow-hidden bg-[#18181c] md:inset-y-3 md:right-3 md:left-[var(--call-panel-left,362px)] md:rounded-[28px] lg:left-[var(--call-panel-left,382px)]" initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : 18, transition: { duration: reducedMotion ? 0 : CALL_EXIT_SECONDS, ease: [0.4, 0, 1, 1] } }} transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}>
        <motion.section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${t("Звонок")}: ${name}`} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ duration: 0.22 }} className="relative flex h-full w-full flex-col overflow-hidden text-white outline-none" style={windowMaterial}>
          {!showWave && !terminal && <div data-call-ambient aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06]" style={{ background }} />
            <CallAmbientRibbon glass={props.glass} connecting={connecting} reducedMotion={Boolean(reducedMotion)} />
          </div>}
          {showWave && <motion.div ref={connectionWave} data-call-connected-wave={failed ? undefined : true} data-call-outcome-wave={failed ? "failed" : completed ? "completed" : "connected"} aria-hidden className="pointer-events-none absolute rounded-full" style={{ background: failed ? "radial-gradient(circle,rgba(152,48,56,0.68) 0%,rgba(116,34,43,0.76) 45%,rgba(75,23,31,0.86) 75%,rgba(49,19,25,0.92) 100%)" : "radial-gradient(circle,rgba(34,112,78,0.68) 0%,rgba(25,83,61,0.76) 45%,rgba(17,57,43,0.86) 75%,rgba(14,40,33,0.92) 100%)" }} initial={waveComplete || reducedMotion ? false : { scale: 0, opacity: 0 }} animate={{ scale: completed && avatarReady ? 0 : 1, opacity: 1 }} transition={{ duration: reducedMotion ? 0 : completed ? CALL_RETURN_SECONDS : failed ? 0.3 : 0.85, ease: completed ? [0.65, 0, 0.35, 1] : [0.16, 1, 0.3, 1] }} onAnimationComplete={() => { setWaveComplete(true); if (completed && avatarReady) setTerminalSettled(true); }} />}
          {!showWave && !terminal && props.glass && isMediaBackgroundUrl(backgroundUrl) && <div className="pointer-events-none absolute -inset-8 opacity-20 blur-2xl"><MediaBanner src={backgroundUrl} alt="" className="h-full w-full" mediaClassName="object-cover" autoPlay={false} /></div>}
          <AnimatePresence initial={false} onExitComplete={() => { if (!cameraMode) setCameraLayerVisible(false); }}>
            {cameraMode && <motion.div key={ownVideoExpanded ? "camera-local" : "camera-remote"} data-call-camera-layer data-call-main-video={ownVideoExpanded ? "local" : "remote"} className="pointer-events-none absolute inset-0 z-[5] overflow-hidden bg-black [&_video]:object-cover" initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.025 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reducedMotion ? 1 : 1.015 }} transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}>
              {displayedVideo}
              <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.35),transparent 28%,transparent 62%,rgba(0,0,0,.7))" }} />
            </motion.div>}
          </AnimatePresence>
          <header inert={!active} aria-hidden={!active} className="relative z-40 flex min-h-[calc(env(safe-area-inset-top)+52px)] shrink-0 justify-end px-4 pt-[calc(env(safe-area-inset-top)+12px)] md:min-h-[60px] md:px-5 md:pt-5">
            <AnimatePresence initial={false}>{active && <motion.div ref={toolbar} key="connection-toolbar" className="relative" initial={{ opacity: 0, scale: 0.94, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -3 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
              <div data-call-connection-toolbar className="flex h-10 items-center rounded-full p-1" style={toolbarStyle}>
                <div role="img" aria-label={signalLabel} title={signalLabel} data-call-signal={signal.state} className="grid h-8 w-8 place-items-center" aria-live="off">
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                    {[5, 8, 11, 14].map((height, index) => <motion.rect key={height} x={3 + index * 5} y={19 - height} width="3" height={height} rx="1.5" initial={false} animate={{ opacity: index < signal.bars ? 1 : 0.22, fill: signal.state === "poor" || signal.state === "reconnecting" ? "#fbbf24" : signal.state === "lost" ? "#f87171" : signal.state === "good" ? "#a7f3d0" : "#d4d4d8" }} transition={{ duration: reducedMotion ? 0 : 0.22 }} />)}
                  </svg>
                </div>
                <button ref={menuButton} type="button" aria-label={t("Параметры звонка")} aria-haspopup="dialog" aria-controls={menuId} aria-expanded={volumeOpen} onClick={() => setVolumeOpen(value => !value)} className="grid h-8 w-8 place-items-center rounded-[12px] text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/60"><IoMdMore size={22} className="block shrink-0" /></button>
              </div>
              <AnimatePresence>{volumeOpen && <motion.div id={menuId} data-call-volume-menu tabIndex={-1} role="dialog" aria-label={t("Громкость собеседника")} {...menuPopoverMotion(reducedMotion)} className="absolute right-0 top-[calc(100%+8px)] z-50 w-[228px] max-w-[calc(100vw-32px)] origin-top-right rounded-[22px] p-1.5 text-zinc-100 outline-none" style={menuStyle}>
                      <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2.5 text-[12px]"><span className="truncate text-zinc-200">{t("Громкость")}</span><span className="tabular-nums text-zinc-400">{props.sound ? Math.round(props.volume * 100) : 0}%</span></div>
                      <input type="range" min="0" max="100" step="1" aria-label={t("Громкость собеседника")} value={props.sound ? Math.round(props.volume * 100) : 0} onChange={event => props.onVolume(Number(event.target.value) / 100)} className="call-volume-slider mx-3 mb-2 h-9 w-[calc(100%-24px)] cursor-pointer" style={{ "--call-volume": `${props.sound ? Math.round(props.volume * 100) : 0}%` } as import("react").CSSProperties} />
                      <button type="button" onClick={() => { if (props.sound && props.volume > 0) props.onSound(); else props.onVolume(props.volume > 0 ? props.volume : 1); }} className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/5">{props.sound && props.volume > 0 ? <FaVolumeMute size={18} /> : <Volume2 size={18} />}{t(props.sound && props.volume > 0 ? "Выключить звук" : "Включить звук")}</button>

              </motion.div>}</AnimatePresence>
            </motion.div>}</AnimatePresence>
          </header>
          <div className="pointer-events-none relative z-20 flex min-h-0 flex-1 flex-col items-center justify-center px-7 pb-4 md:px-10 md:pb-0">
            <AnimatePresence initial={false} mode="wait">
              {!hideIdentity && (displayedVideo ? <motion.div data-call-main-video={ownVideoExpanded ? "local" : "remote"} key={ownVideoExpanded ? "local-video" : "video"} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-auto relative mb-5 h-full min-h-[120px] w-full md:max-h-[60dvh] md:max-w-[1000px] overflow-hidden rounded-[24px] bg-black/40"><CallVideoStage localScreen={!ownVideoExpanded && props.localScreen} screen={!ownVideoExpanded && props.screenVideo} label={props.screenOwner}>{displayedVideo}</CallVideoStage></motion.div>
                : <motion.div key="avatar" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: reducedMotion ? 0 : 0.24 }} onAnimationComplete={() => { if (avatarRef.current) setAvatarReady(true); }} className={`relative z-30 mb-6 shrink-0 rounded-full md:mb-4 p-1`}>
                  <CallAvatarVoiceHalo readLevels={props.readVoiceLevels} />
                  <div ref={setAvatarRef} data-call-avatar className="relative z-10">
                    <MediaAvatar src={avatarUrl ?? undefined} alt={name} className="h-36 w-36 rounded-full shadow-xl md:h-40 md:w-40" fallbackText={name.slice(0, 1)} />
                  </div>
                </motion.div>)}
            </AnimatePresence>
            {(props.localVideo || props.secondaryVideo || props.sharedPreview) && <div className="pointer-events-auto absolute right-4 top-14 z-10 flex max-h-[65%] flex-col gap-2 overflow-y-auto">
              {props.sharedPreview && <div aria-label={t("Вы демонстрируете свой экран")} className="aspect-video w-28 overflow-hidden rounded-[14px] bg-black/60 shadow-lg md:w-40">{props.sharedPreview}</div>}
              {props.secondaryVideo && <div aria-label={name} className="aspect-video w-28 overflow-hidden rounded-[14px] bg-black/60 shadow-lg md:w-40">{props.secondaryVideo}</div>}
              {props.localVideo && <motion.button type="button" data-call-video-swap aria-label={t(ownVideoExpanded ? "Вернуть видео собеседника" : "Развернуть своё видео")} aria-pressed={ownVideoExpanded} onClick={() => setOwnCameraFocused(!ownVideoExpanded)} whileTap={{ scale: 0.97 }} className="relative aspect-video w-28 overflow-hidden rounded-[14px] bg-black/60 shadow-lg focus-visible:outline-2 focus-visible:outline-white/80 md:w-40">
                {ownVideoExpanded ? props.video ?? <MediaAvatar src={avatarUrl ?? undefined} alt={name} className="h-full w-full" fallbackText={name.slice(0, 1)} /> : props.localVideo}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/40 px-2 py-1 text-left text-[10px] text-white">{ownVideoExpanded ? name : t("Вы")}</span>
              </motion.button>}
            </div>}
            <AnimatePresence initial={false}>{!hideIdentity && <motion.div data-call-identity key="identity" className="w-full shrink-0" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
            <h2 className="w-full shrink-0 truncate text-center text-[23px] font-semibold leading-8 tracking-tight md:text-[24px]">{name}</h2>
            <div className="mt-1 w-full shrink-0"><AnimatedStatus text={t(props.status)} timer={props.duration} /></div>
            </motion.div>}</AnimatePresence>
          </div>
          <footer className={`relative z-30 flex shrink-0 flex-col items-center gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-3 md:gap-2 md:px-8 md:pb-10 md:pt-5 ${incomingLayout ? "min-h-[128px] md:min-h-[148px]" : "min-h-[112px] md:min-h-[132px]"}`}>
            {props.audioBlocked && <button type="button" onClick={props.onEnableAudio} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] text-zinc-200"><Volume2 size={16} />{t("Включить звук звонка")}</button>}
            {incoming ? <div className="flex items-end gap-8 md:gap-14">
              <div className="flex flex-col items-center gap-2"><button type="button" disabled={busy} onClick={props.onHangup} aria-label={t("Отклонить")} className={`${control} h-16 w-16 text-red-400 hover:text-red-300`}><IoCall size={27} /></button><span className="text-[11px] text-zinc-400">{t("Отклонить")}</span></div>
              {minimizeControl}
              <div className="flex flex-col items-center gap-2"><button type="button" disabled={busy} onClick={props.onAccept} aria-label={t("Принять")} className={`${control} h-16 w-16 text-emerald-400 hover:text-emerald-300`}><IoCall size={27} /></button><span className="text-[11px] text-zinc-400">{t("Принять")}</span></div>
            </div> : owned ? <div className="flex w-full items-start justify-center gap-3 sm:gap-4 md:gap-6">
              {minimizeControl}
              <div className="flex flex-col items-center gap-2"><button type="button" disabled={controlsDisabled} onClick={props.onMicrophone} aria-label={t(props.microphone ? "Выключить микрофон" : "Включить микрофон")} aria-pressed={props.microphone} className={`${control} h-12 w-12 ${props.microphone ? "text-zinc-200" : "text-white"}`}>{props.microphone ? <FaMicrophone size={21} /> : <FaMicrophoneSlash size={21} />}</button><span className="text-[10px] text-zinc-400 md:text-[11px]">{t("Микрофон")}</span></div>
              <div className="flex flex-col items-center gap-2"><button type="button" disabled={controlsDisabled} onClick={() => { setOwnCameraFocused(null); props.onCamera(); }} aria-label={t(props.camera ? "Выключить камеру" : "Включить камеру")} aria-pressed={props.camera} className={`${control} h-12 w-12 ${props.camera ? "text-white" : "text-zinc-200"}`}>{props.camera ? <BsCameraVideoFill size={21} /> : <BsCameraVideoOffFill size={21} />}</button><span className="text-[10px] text-zinc-400">{t("Камера")}</span></div>
              <div className="flex flex-col items-center gap-2"><button type="button" disabled={controlsDisabled} onClick={props.onShare} aria-label={t(props.sharing ? "Остановить показ экрана" : "Показать экран")} aria-pressed={props.sharing} className={control + " h-12 w-12 " + (props.sharing ? "text-emerald-400" : "text-zinc-200")}><MonitorUp size={21} /></button><span className="text-[10px] text-zinc-400">{t("Экран")}</span></div>
              <div className="flex flex-col items-center gap-2"><button type="button" disabled={busy} onClick={props.onHangup} aria-label={t("Завершить звонок")} className={`${control} h-12 w-12 text-red-400 hover:text-red-300`}><IoIosCall size={23} /></button><span className="text-[10px] text-zinc-400">{t("Завершить")}</span></div>
            </div> : null}
          </footer>
        </motion.section>
      </motion.div>
    )}</AnimatePresence>
  </>;
}
