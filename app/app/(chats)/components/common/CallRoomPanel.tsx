"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Room, Participant, Track } from "livekit-client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Maximize2, Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff, Volume2, X } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { MediaAvatar } from "@/components/ui/media";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import type { CallConnection, CallView, CallsSnapshot } from "@/lib/calls";
import { getChatHeaderVisualStyle } from "@/lib/client/panel-visual";
import PersonalCallWindow from "./PersonalCallWindow";
import { useCallAudioLevels } from "../../hooks/useCallAudioLevels";
import { useParticipantAudio } from "../../hooks/useParticipantAudio";
import { selectCallVideo, visibleCallTrack, screenShareError } from "@/lib/client/call-screen-share";
import { createCallRenderScheduler } from "@/lib/client/call-render-scheduler";
import { callConnectionSignal } from "@/lib/client/call-connection-quality";
import { switchCallCamera, type CallCameraFacing } from "@/lib/client/call-camera";

const TrackElement = memo(function TrackElement({ track, local, audio, muted = false, volume = 1, mirror = true }: { track: Track; local: boolean; audio: boolean; muted?: boolean; volume?: number; mirror?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = track.attach();
    if (element instanceof HTMLVideoElement) { element.playsInline = true; element.muted = true; element.autoplay = true; }
    element.className = `h-full w-full object-contain${local && track.source === "camera" ? " -scale-x-100" : ""}`;
    container.current?.appendChild(element);
    return () => { track.detach(element); element.remove(); };
  }, [track, local]);
  useEffect(() => {
    container.current?.querySelector("video")?.classList.toggle("-scale-x-100", local && track.source === "camera" && mirror);
  }, [track, local, mirror]);
  useEffect(() => {
    const element = container.current?.querySelector("audio");
    if (element) { element.muted = muted; element.volume = volume; }
    if (audio && "setVolume" in track && typeof track.setVolume === "function") track.setVolume(muted ? 0 : volume);
  }, [muted, volume, audio, track]);
  return <div ref={container} className={audio ? "hidden" : "h-full w-full"} />;
});

type Props = { call: CallView; selfId: string; glass: boolean; busy: boolean; onJoin: (id: string) => void; onLeave: (end?: boolean) => void };

export const CallRoomPanel = memo(function CallRoomPanel({ call, selfId, glass, busy, onJoin, onLeave }: Props) {
  const t = useTranslation();
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState("Запрос…");
  const [localEndOutcome, setLocalEndOutcome] = useState<CallView["endOutcome"]>(undefined);
  const [error, setError] = useState<string | null>(null);
  const reportedError = useRef<string | null>(null);
  useEffect(() => {
    if (error && reportedError.current !== error) {
      showAppToast({ type: "error", title: t(error), durationMs: 5000 });
    }
    reportedError.current = error;
  }, [error, t]);
  const [minimized, setMinimized] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CallCameraFacing>("user");
  const mediaLock = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const participantAudio = useParticipantAudio(call);
  const intentionalHangup = useRef(false);
  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);
  const [, redraw] = useState(0);
  const [initialVideo] = useState(call.mode === "video" && call.callerId === selfId);
  const material = getChatHeaderVisualStyle(glass);
  const callEnded = call.status === "ended";

  useEffect(() => {
    if (!call.onThisSession || callEnded) return;
    let cancelled = false;
    let active: Room | null = null;
    const rendering = createCallRenderScheduler(() => { if (!cancelled) redraw(value => value + 1); });
    const connect = async () => {
      try {
        const [{ Room: LiveRoom, RoomEvent }, connection] = await Promise.all([
          import("livekit-client"),
          apiRequest<CallConnection>("/api/calls", { method: "POST", body: JSON.stringify({ action: "token", id: call.id }), timeoutMs: 12_000 }),
        ]);
        if (cancelled) return;
        setState("Ожидание…");
        const session = new LiveRoom({ adaptiveStream: true, dynacast: true,
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          videoCaptureDefaults: { facingMode: "user", resolution: { width: 1280, height: 720, frameRate: 24 } } });
        active = session;
        const update = rendering.update;
        for (const event of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed,
          RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
          RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ConnectionQualityChanged,
          RoomEvent.ConnectionStateChanged, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished]) session.on(event, update);
        if (call.kind !== "direct") session.on(RoomEvent.ActiveSpeakersChanged, update);
        session.on(RoomEvent.Reconnecting, () => { if (!cancelled) setState("Восстанавливаем соединение…"); });
        session.on(RoomEvent.Reconnected, () => { if (!cancelled) setState("На связи"); });
        session.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!cancelled) setAudioBlocked(!session.canPlaybackAudio); });
        session.on(RoomEvent.Disconnected, () => {
          if (!cancelled && !intentionalHangup.current) {
            setState("Звонок завершён");
            void apiRequest<CallsSnapshot>(`/api/calls?previous=${encodeURIComponent(call.id)}`).then(snapshot => {
              if (cancelled) return;
              if (snapshot.ended?.id === call.id) {
                setLocalEndOutcome(snapshot.ended.outcome);
                window.dispatchEvent(new Event("eclipse:calls-changed"));
              } else { setState("Соединение прервано"); setError("Соединение прервано. Завершите звонок и попробуйте ещё раз."); }
            }).catch(() => { if (!cancelled) { setState("Соединение прервано"); setError("Соединение прервано. Завершите звонок и попробуйте ещё раз."); } });
          }
        });
        setRoom(session);
        await session.connect(connection.url, connection.token);
        if (cancelled) { await session.disconnect(); return; }
        setState("На связи");
        try { await session.startAudio(); } catch { setAudioBlocked(true); }
        try { await session.localParticipant.setMicrophoneEnabled(true); }
        catch { if (!cancelled) setError("Не удалось включить микрофон. Проверьте разрешения браузера."); }
        if (initialVideo && !cancelled) {
          try { await session.localParticipant.setCameraEnabled(true); }
          catch { if (!cancelled) setError("Не удалось включить камеру. Можно продолжить голосом."); }
        }
        if (cancelled) { await session.disconnect(true); return; }
        update();
      } catch {
        if (!cancelled) { setState("Не удалось подключиться"); setError("Проверьте сеть и разрешения браузера. Можно завершить звонок и попробовать ещё раз."); }
      }
    };
    void connect();
    return () => { cancelled = true; rendering.dispose(); if (active) { active.removeAllListeners(); void active.disconnect(true); } };
  }, [call.id, call.kind, call.onThisSession, callEnded, initialVideo]);

  useEffect(() => {
    const update = () => setElapsed(call.startedAt ? Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)) : 0);
    update();
    const timer = window.setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [call.startedAt]);

  const toggle = useCallback(async (kind: "mic" | "camera" | "screen") => {
    if (!room || mediaLock.current || room.state !== "connected" || callEnded || intentionalHangup.current) return;
    if (kind === "screen" && !room.localParticipant.isScreenShareEnabled && !navigator.mediaDevices?.getDisplayMedia) {
      setError(null);
      showAppToast({ type: "error", title: t("Этот браузер не поддерживает показ вашего экрана. Демонстрацию собеседника смотреть можно."), durationMs: 5000 });
      return;
    }
    mediaLock.current = true;
    setMediaBusy(true);
    setError(null);
    try {
      if (kind === "mic") await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
      if (kind === "camera") {
        await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled, { facingMode: cameraFacing });
        if (intentionalHangup.current || room.state !== "connected") await room.localParticipant.setCameraEnabled(false);
      }
      if (kind === "screen") {
        const enabling = !room.localParticipant.isScreenShareEnabled;
        await room.localParticipant.setScreenShareEnabled(enabling, {
          audio: true, contentHint: "detail", selfBrowserSurface: "exclude", surfaceSwitching: "include",
        }, { screenShareEncoding: { maxBitrate: 3_000_000, maxFramerate: 15 } });
        // A picker can remain open while the other participant hangs up.
        if (intentionalHangup.current || room.state !== "connected") {
          await room.localParticipant.setScreenShareEnabled(false);
        }
      }
      redraw(value => value + 1);
    } catch (failure) {
      if (kind === "screen") setError(screenShareError(failure));
      else if (kind === "camera") {
        const name = failure && typeof failure === "object" && "name" in failure ? failure.name : "";
        setError(name === "NotAllowedError" ? "Разрешите доступ к камере в настройках браузера."
          : name === "NotFoundError" ? "Камера не найдена. Подключите камеру и попробуйте ещё раз."
          : name === "NotReadableError" ? "Камера занята другим приложением. Закройте его и попробуйте ещё раз."
          : "Не удалось включить камеру. Проверьте разрешения браузера.");
      } else setError("Не удалось переключить устройство. Проверьте разрешения браузера.");
    } finally { mediaLock.current = false; setMediaBusy(false); }
  }, [room, callEnded, cameraFacing, t]);

  const flipCamera = useCallback(async () => {
    if (!room || room.state !== "connected" || mediaLock.current || callEnded || intentionalHangup.current || !room.localParticipant.isCameraEnabled) return;
    const track = room.localParticipant.getTrackPublication("camera" as Track.Source)?.videoTrack;
    if (!track) return;
    mediaLock.current = true;
    setMediaBusy(true);
    setCameraSwitching(true);
    setError(null);
    const isCurrent = () => room.state === "connected" && !intentionalHangup.current && room.localParticipant.isCameraEnabled;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const result = await switchCallCamera({ track, facing: cameraFacing, deviceIds: devices.filter(device => device.kind === "videoinput").map(device => device.deviceId), isCurrent });
      if (!result || !isCurrent()) return;
      setCameraFacing(result.facing);
      if (!result.switched) setError("Другая камера недоступна на этом устройстве");
      redraw(value => value + 1);
    } catch {
      if (isCurrent()) {
        if (track.mediaStreamTrack.readyState === "ended") await room.localParticipant.setCameraEnabled(false).catch(() => {});
        setError("Не удалось перевернуть камеру. Проверьте доступ к камере.");
      }
    } finally { mediaLock.current = false; setMediaBusy(false); setCameraSwitching(false); }
  }, [room, callEnded, cameraFacing]);

  const hangup = (end = false) => {
    // Stop capture immediately even if the server request needs a retry.
    intentionalHangup.current = true;
    setLocalEndOutcome(call.startedAt ? "completed" : call.incoming ? "declined" : "cancelled");
    if (room) void room.disconnect(true);
    void participantAudio.flush().finally(() => onLeave(end));
  };

  const connected = room?.state === "connected";
  const participants: Participant[] = room ? [room.localParticipant, ...room.remoteParticipants.values()] : [];
  const microphone = room?.localParticipant.isMicrophoneEnabled ?? false;
  const camera = room?.localParticipant.isCameraEnabled ?? false;
  const screen = room?.localParticipant.isScreenShareEnabled ?? false;
  const duration = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const status = call.incoming ? t("Входящий звонок") : call.status === "ringing" ? t("Ожидаем ответа…") : !call.onThisSession ? t("Звонок открыт на другом устройстве") : `${t(state)}${call.startedAt ? ` · ${duration}` : ""}`;
  const finished = call.status === "ended" || Boolean(localEndOutcome) || state === "Звонок завершён";
  const endOutcome = call.endOutcome ?? localEndOutcome;
  const controlsDisabled = !connected || mediaBusy || busy || finished;
  const remote = participants.find(person => person !== room?.localParticipant);
  const remoteScreen = visibleCallTrack(remote, "screen_share" as Track.Source);
  const sharedVideo = screen ? visibleCallTrack(room?.localParticipant, "screen_share" as Track.Source) : undefined;
  const remoteCamera = remote?.isCameraEnabled ? visibleCallTrack(remote, "camera" as Track.Source) : undefined;
  const presentation = selectCallVideo(remoteScreen, sharedVideo, remoteCamera);
  const mainVideo = presentation.main;
  const localVideo = camera ? visibleCallTrack(room?.localParticipant, "camera" as Track.Source) : undefined;
  const peer = call.peer ?? call.participants.find(person => person.id !== selfId);
  const peerAudio = participantAudio.get(peer?.id ?? "");
  const readImmediateLevels = useCallAudioLevels(room?.localParticipant.getTrackPublication("microphone" as Track.Source)?.track?.mediaStreamTrack, remote?.getTrackPublication("microphone" as Track.Source)?.track?.mediaStreamTrack, call.kind === "direct" && connected && !finished);
  const readVoiceLevels = useCallback(() => {
    if (!room || room.state !== "connected" || finished) return { local: 0, remote: 0 };
    const immediate = readImmediateLevels();
    return {
      local: room.localParticipant.isMicrophoneEnabled ? immediate?.local ?? room.localParticipant.audioLevel : 0,
      remote: remote?.isMicrophoneEnabled && !peerAudio.muted && peerAudio.volume > 0 ? immediate?.remote ?? remote.audioLevel : 0,
    };
  }, [room, remote, finished, peerAudio.muted, peerAudio.volume, readImmediateLevels]);
  const personalStatus = finished ? endOutcome === "cancelled" ? "Звонок отменён" : endOutcome === "declined" ? "Звонок отклонён" : endOutcome === "missed" ? "Нет ответа" : "Звонок завершён"
    : call.incoming ? "Входящий звонок" : !call.onThisSession ? "Звонок открыт на другом устройстве"
    : state === "Не удалось подключиться" || state === "Соединение прервано" ? state
    : call.status === "ringing" ? (state === "Запрос…" || state === "Ожидание…" ? state : "Вызов…")
    : state === "Восстанавливаем соединение…" ? state : "Соединение…";

  return (
    <>
    {participants.filter(person => person !== room?.localParticipant).flatMap(person => [...person.audioTrackPublications.values()].map(publication => publication.track && <TrackElement key={`${person.identity}:${publication.trackSid}`} track={publication.track} local={false} audio muted={participantAudio.get(call.participants.find(p => p.identity === person.identity)?.id ?? "").muted} volume={participantAudio.get(call.participants.find(p => p.identity === person.identity)?.id ?? "").volume}/>))}
    {call.kind === "direct" ? <PersonalCallWindow
      active={!finished && call.status === "active" && call.onThisSession} endOutcome={finished ? endOutcome ?? "completed" : undefined}
      signal={callConnectionSignal(room?.state, [room?.localParticipant.connectionQuality ?? "unknown", remote?.connectionQuality ?? "unknown"], finished)}
      name={call.title} avatarUrl={peer?.avatarUrl ?? null} backgroundUrl={call.peer?.backgroundUrl ?? null}
      status={personalStatus} duration={!finished && call.status === "active" && call.startedAt && call.onThisSession && connected && remote ? duration : null}
      incoming={call.incoming && !finished} owned={call.onThisSession && !finished} minimized={minimized} glass={glass} busy={busy} controlsDisabled={controlsDisabled}
      microphone={microphone} camera={camera} sound={!peerAudio.muted} volume={peerAudio.volume} onVolume={value => { if (peer) participantAudio.update(peer.id, { volume: value, muted: value === 0 }); }} sharing={screen} speaking={remote?.isSpeaking ?? false} readVoiceLevels={readVoiceLevels}
      video={!finished && mainVideo ? <TrackElement track={mainVideo} local={presentation.local} audio={false} /> : undefined}
      localScreen={presentation.local} screenVideo={presentation.screen} screenOwner={presentation.local ? t("Вы демонстрируете свой экран") : t("Демонстрация экрана")}
      secondaryVideo={!finished && presentation.secondary ? <TrackElement track={presentation.secondary} local={false} audio={false} /> : undefined}
      sharedPreview={!finished && presentation.localPreview ? <div className="grid h-full place-items-center bg-[#202326] text-zinc-300"><MonitorUp size={24} aria-label={t("Вы демонстрируете экран")} /></div> : undefined}
      localVideo={!finished && localVideo ? <TrackElement track={localVideo} local audio={false} mirror={cameraFacing !== "environment"} /> : undefined}
      audioBlocked={audioBlocked} canShare={typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)}
      onMinimize={minimize} onExpand={expand} onAccept={() => onJoin(call.id)} onHangup={() => hangup()}
      onMicrophone={() => void toggle("mic")} onCamera={() => void toggle("camera")} onSound={() => { if (peer) participantAudio.update(peer.id, { ...peerAudio, muted: !peerAudio.muted }); }} onShare={() => void toggle("screen")}
      onEnableAudio={() => void room?.startAudio().then(() => setAudioBlocked(false)).catch(() => setError("Разрешите воспроизведение звука в браузере"))}
      onFlipCamera={() => void flipCamera()} cameraSwitching={cameraSwitching}
    /> : <AnimatePresence mode="wait">
      {minimized ? (
        <motion.div key="mini" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-24 left-1/2 z-[450] flex w-[min(360px,calc(100vw-24px))] -translate-x-1/2 items-center gap-3 rounded-full p-2 pl-4 text-white shadow-xl" style={material}>
          <button type="button" onClick={() => setMinimized(false)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={t("Развернуть звонок")}><Phone size={18} className="text-emerald-400"/><span className="min-w-0"><span className="block truncate text-sm font-semibold">{call.title}</span><span className="block truncate text-xs text-zinc-300">{status}</span></span><Maximize2 size={16} className="ml-auto shrink-0"/></button>
          <button type="button" disabled={busy} onClick={() => hangup() } aria-label={t("Завершить звонок")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-500"><PhoneOff size={19}/></button>
        </motion.div>
      ) : (
        <motion.section key="full" role="dialog" aria-modal="true" aria-label={t("Звонок")} initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: .22 }} className="fixed inset-x-3 top-1/2 z-[450] mx-auto flex max-h-[calc(100dvh-32px)] w-auto max-w-[760px] -translate-y-1/2 flex-col overflow-hidden rounded-[32px] p-4 text-white shadow-2xl sm:p-6" style={material}>
          <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{call.title}</h2><p role="status" className="mt-1 text-sm text-zinc-300">{status}</p></div><button type="button" onClick={() => setMinimized(true)} aria-label={t("Свернуть звонок")} className="grid h-11 w-11 place-items-center rounded-full bg-white/8"><ChevronDown size={22}/></button></div>
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {participants.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{participants.map(person => {
              const profile = call.participants.find(p => p.identity === person.identity);
              const local = person === room?.localParticipant;
              const videoTrack = person.getTrackPublication((screen && local ? "screen_share" : "camera") as Track.Source)?.track;
              const screenTrack = !local ? person.getTrackPublication("screen_share" as Track.Source)?.track : undefined;
              const visibleTrack = screenTrack ?? (person.isCameraEnabled || (screen && local) ? videoTrack : undefined);
              return <div key={person.identity} className={`relative flex min-h-[160px] items-center justify-center overflow-hidden rounded-3xl bg-black/20 ${person.isSpeaking ? "ring-2 ring-emerald-400/80 ring-inset" : ""}`}>
                {visibleTrack ? <div className="aspect-video w-full"><TrackElement track={visibleTrack} local={local} audio={false}/></div> : <MediaAvatar src={profile?.avatarUrl ?? undefined} alt={profile?.name ?? t("Участник")} className="h-20 w-20 rounded-full" fallbackText={profile?.name?.slice(0, 1) ?? "E"} />}
                <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs"><span className="min-w-0 flex-1 truncate">{local ? t("Вы") : profile?.name ?? t("Участник")}</span>{!person.isMicrophoneEnabled && <MicOff size={13}/>}</div>
              </div>;
            })}</div> : <div className="flex min-h-48 flex-col items-center justify-center gap-4"><div className="grid h-24 w-24 place-items-center rounded-full bg-white/8"><Phone size={34}/></div><p className="text-center text-sm text-zinc-300">{status}</p></div>}
          </div>
          {audioBlocked && <button type="button" className="mt-3 flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm" onClick={() => void room?.startAudio().then(() => setAudioBlocked(false)).catch(() => setError("Разрешите воспроизведение звука в браузере"))}><Volume2 size={18}/>{t("Включить звук звонка")}</button>}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {call.incoming ? <><button type="button" disabled={busy} onClick={() => onJoin(call.id)} className="flex h-12 items-center gap-2 rounded-full bg-emerald-500 px-5 font-medium disabled:opacity-50"><Phone size={20}/>{t("Принять")}</button><button type="button" disabled={busy} onClick={() => hangup() } className="flex h-12 items-center gap-2 rounded-full bg-red-500 px-5 font-medium disabled:opacity-50"><PhoneOff size={20}/>{t("Отклонить")}</button></> : call.onThisSession ? <>
              <button type="button" disabled={controlsDisabled} onClick={() => void toggle("mic")} aria-label={t(microphone ? "Выключить микрофон" : "Включить микрофон")} aria-pressed={microphone} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 disabled:opacity-40">{microphone ? <Mic size={21}/> : <MicOff size={21}/>}</button>
              <button type="button" disabled={controlsDisabled} onClick={() => void toggle("camera")} aria-label={t(camera ? "Выключить камеру" : "Включить камеру")} aria-pressed={camera} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 disabled:opacity-40">{camera ? <Video size={21}/> : <VideoOff size={21}/>}</button>
              {typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia) && <button type="button" disabled={controlsDisabled} onClick={() => void toggle("screen")} aria-label={t(screen ? "Остановить показ экрана" : "Показать экран")} aria-pressed={screen} className={`grid h-12 w-12 place-items-center rounded-full ${screen ? "bg-white/25" : "bg-white/10"} disabled:opacity-40`}><MonitorUp size={21}/></button>}
              <button type="button" disabled={busy} onClick={() => hangup() } aria-label={t("Завершить звонок")} className="grid h-12 w-16 place-items-center rounded-full bg-red-500 disabled:opacity-50"><PhoneOff size={22}/></button>
              {call.kind === "group" && call.canEnd && <button type="button" disabled={busy} onClick={() => hangup(true)} className="rounded-full px-3 py-2 text-xs text-zinc-300">{t("Завершить для всех")}</button>}
            </> : <button type="button" disabled={busy} onClick={() => hangup() } className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-5"><X size={18}/>{t("Отменить звонок")}</button>}
          </div>
        </motion.section>
      )}
    </AnimatePresence>}
    </>
  );
});
