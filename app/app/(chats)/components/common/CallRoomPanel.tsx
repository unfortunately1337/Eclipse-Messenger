"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CallMediaSession, CallParticipant, CallMediaTrack } from "@/lib/client/call-media-session";
import { MonitorUp } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";
import { apiRequest } from "@/lib/client/http";
import { showAppToast } from "@/lib/client/app-toast";
import type { CallConnection, CallView, CallsSnapshot } from "@/lib/calls";
import PersonalCallWindow from "./PersonalCallWindow";
import GroupCallWindow, { type GroupCallPerson } from "./GroupCallWindow";
import { useCallAudioLevels } from "../../hooks/useCallAudioLevels";
import { useParticipantAudio } from "../../hooks/useParticipantAudio";
import { selectCallVideo, visibleCallTrack, screenShareError } from "@/lib/client/call-screen-share";
import { createCallRenderScheduler } from "@/lib/client/call-render-scheduler";
import { callConnectionSignal } from "@/lib/client/call-connection-quality";
import { switchCallCamera, type CallCameraFacing } from "@/lib/client/call-camera";
import { callClientId } from "@/lib/client/call-p2p-signaling";
import { personalCallStatus } from "@/lib/client/call-status";
import type { GroupVoiceSample } from "@/lib/client/group-call-voice";

const noiseSuppressionPreferenceKey = "eclipse:call:noise-suppression";

function microphoneOptions(kind: CallView["kind"]) {
  if (kind !== "direct") return undefined;
  try { return { noiseSuppression: localStorage.getItem(noiseSuppressionPreferenceKey) !== "off" }; }
  catch { return { noiseSuppression: true }; }
}

const TrackElement = memo(function TrackElement({ track, local, audio, muted = false, volume = 1, mirror = true }: { track: CallMediaTrack; local: boolean; audio: boolean; muted?: boolean; volume?: number; mirror?: boolean }) {
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
  const [room, setRoom] = useState<CallMediaSession | null>(null);
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
  const [pendingNoiseSuppression, setPendingNoiseSuppression] = useState<boolean | null>(null);
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CallCameraFacing>("user");
  const mediaLock = useRef(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioRecoveryVisible, setAudioRecoveryVisible] = useState(false);
  const participantAudio = useParticipantAudio(call);
  const intentionalHangup = useRef(false);
  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);
  const [, redraw] = useState(0);
  const [initialVideo] = useState(call.kind === "direct" && call.mode === "video" && call.callerId === selfId);
  const callEnded = call.status === "ended";

  useEffect(() => {
    if (!call.onThisSession || callEnded || call.requesting) return;
    let cancelled = false;
    let active: CallMediaSession | null = null;
    const rendering = createCallRenderScheduler(() => { if (!cancelled) redraw(value => value + 1); });
    const connect = async () => {
      try {
        const connection = await apiRequest<CallConnection>("/api/calls", { method: "POST", body: JSON.stringify({ action: "token", id: call.id, clientId: callClientId(call.id) }), timeoutMs: 12_000 });
        if (cancelled) return;
        setState("Ожидание…");
        const session: CallMediaSession = connection.transport === "p2p"
          ? new (await import("@/lib/client/call-p2p-session")).P2PCallSession()
          : await (await import("@/lib/client/call-livekit-session")).createLiveKitSession();
        if (cancelled) { await session.disconnect(); return; }
        active = session;
        const update = rendering.update;
        session.on("update", update);
        session.on("reconnecting", () => { if (!cancelled) setState("Восстанавливаем соединение…"); });
        session.on("reconnected", () => { if (!cancelled) setState("На связи"); });
        session.on("audioPlayback", () => { if (!cancelled) setAudioBlocked(!session.canPlaybackAudio); });
        session.on("disconnected", () => {
          window.dispatchEvent(new Event("eclipse:call-silence"));
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
        await session.connect(connection);
        if (cancelled) { await session.disconnect(); return; }
        // P2P connect() starts negotiation; only its connection events mean
        // media is connected. Do not treat SDK initialization as an answer.
        setState(session.state === "connected" ? "На связи" : "Соединение…");
        try { await session.localParticipant.setMicrophoneEnabled(true, microphoneOptions(call.kind)); }
        catch { if (!cancelled) setError("Не удалось включить микрофон. Проверьте разрешения браузера."); }
        if (!cancelled) void session.startAudio().catch(() => {
          if (!cancelled && connection.transport !== "p2p") setAudioBlocked(true);
        });
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
  }, [call.id, call.kind, call.transport, call.onThisSession, call.requesting, callEnded, initialVideo]);

  useEffect(() => {
    if (call.kind !== "direct" || !audioBlocked || !room?.ready || callEnded) return;
    const timer = window.setTimeout(() => setAudioRecoveryVisible(true), 450);
    const retryAudio = (event: MouseEvent) => {
      if (!event.isTrusted) return;
      void room.startAudio().catch(() => {});
    };
    window.addEventListener("click", retryAudio);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", retryAudio);
      setAudioRecoveryVisible(false);
    };
  }, [audioBlocked, room, call.kind, callEnded]);

  const enableAudio = () => {
    void room?.startAudio().then(() => setAudioBlocked(false)).catch(() => setError("Разрешите воспроизведение звука в браузере"));
  };

  const toggle = useCallback(async (kind: "mic" | "camera" | "screen") => {
    if (!room?.ready || mediaLock.current || callEnded || intentionalHangup.current) return;
    if (kind === "screen" && !room.localParticipant.isScreenShareEnabled && !navigator.mediaDevices?.getDisplayMedia) {
      setError(null);
      showAppToast({ type: "error", title: t("Этот браузер не поддерживает показ вашего экрана. Демонстрацию собеседника смотреть можно."), durationMs: 5000 });
      return;
    }
    mediaLock.current = true;
    setMediaBusy(true);
    setError(null);
    try {
      if (kind === "mic") await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled, microphoneOptions(call.kind));
      if (kind === "camera") {
        await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled, { facingMode: cameraFacing });
        if (intentionalHangup.current || !room.ready) await room.localParticipant.setCameraEnabled(false);
      }
      if (kind === "screen") {
        const enabling = !room.localParticipant.isScreenShareEnabled;
        await room.localParticipant.setScreenShareEnabled(enabling, {
          audio: true, contentHint: "detail", selfBrowserSurface: "exclude", surfaceSwitching: "include",
        }, { screenShareEncoding: { maxBitrate: 6_000_000, maxFramerate: 45 } });
        // A picker can remain open while the other participant hangs up.
        if (intentionalHangup.current || !room.ready) {
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
  }, [room, call.kind, callEnded, cameraFacing, t]);

  const flipCamera = useCallback(async () => {
    if (!room?.ready || mediaLock.current || callEnded || intentionalHangup.current || !room.localParticipant.isCameraEnabled) return;
    const track = room.localParticipant.getTrackPublication("camera")?.videoTrack;
    if (!track) return;
    mediaLock.current = true;
    setMediaBusy(true);
    setCameraSwitching(true);
    setError(null);
    const isCurrent = () => room.ready && !intentionalHangup.current && room.localParticipant.isCameraEnabled;
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
  const participants: CallParticipant[] = room ? [room.localParticipant, ...room.remoteParticipants.values()] : [];
  const microphone = room?.localParticipant.isMicrophoneEnabled ?? false;
  const camera = room?.localParticipant.isCameraEnabled ?? false;
  const screen = room?.localParticipant.isScreenShareEnabled ?? false;
  const finished = call.status === "ended" || Boolean(localEndOutcome) || state === "Звонок завершён";
  const endOutcome = call.endOutcome ?? localEndOutcome;
  const controlsDisabled = !room?.ready || mediaBusy || busy || finished;
  const microphoneTrack = room?.localParticipant.getTrackPublication("microphone")?.track?.mediaStreamTrack;
  const noiseSuppression = microphoneTrack?.getSettings().noiseSuppression;
  const noiseSuppressionModes = microphoneTrack?.getCapabilities?.().noiseSuppression;
  const canToggleNoiseSuppression = room?.localParticipant.setNoiseSuppression && microphoneTrack?.readyState === "live" && typeof noiseSuppression === "boolean" &&
    (!noiseSuppressionModes || (noiseSuppressionModes.includes(true) && noiseSuppressionModes.includes(false)));

  const toggleNoiseSuppression = async () => {
    if (!room?.localParticipant.setNoiseSuppression || !canToggleNoiseSuppression || controlsDisabled || mediaLock.current || intentionalHangup.current) return;
    const enabled = !noiseSuppression;
    mediaLock.current = true;
    setPendingNoiseSuppression(enabled);
    setError(null);
    try {
      await room.localParticipant.setNoiseSuppression(enabled);
      if (!room.ready) return;
      try { localStorage.setItem(noiseSuppressionPreferenceKey, enabled ? "on" : "off"); } catch { /* Storage may be disabled. */ }
    } catch {
      if (!intentionalHangup.current && room.ready) setError("Не удалось переключить шумоподавление");
    } finally {
      mediaLock.current = false;
      setPendingNoiseSuppression(null);
    }
  };

  const remote = participants.find(person => person !== room?.localParticipant);
  const remoteScreen = visibleCallTrack(remote, "screen_share");
  const sharedVideo = screen ? visibleCallTrack(room?.localParticipant, "screen_share") : undefined;
  const remoteCamera = remote?.isCameraEnabled ? visibleCallTrack(remote, "camera") : undefined;
  const presentation = selectCallVideo(remoteScreen, sharedVideo, remoteCamera);
  const mainVideo = presentation.main;
  const localVideo = camera ? visibleCallTrack(room?.localParticipant, "camera") : undefined;
  const peer = call.peer ?? call.participants.find(person => person.id !== selfId);
  const peerAudio = participantAudio.get(peer?.id ?? "");
  const readImmediateLevels = useCallAudioLevels(microphoneTrack, remote?.getTrackPublication("microphone")?.track?.mediaStreamTrack, connected && !finished);
  const readVoiceLevels = useCallback(() => {
    if (!room || room.state !== "connected" || finished) return { local: 0, remote: 0 };
    const immediate = readImmediateLevels();
    return {
      local: room.localParticipant.isMicrophoneEnabled ? immediate?.local ?? room.localParticipant.audioLevel : 0,
      remote: remote?.isMicrophoneEnabled && !peerAudio.muted && peerAudio.volume > 0 ? immediate?.remote ?? remote.audioLevel : 0,
    };
  }, [room, remote, finished, peerAudio.muted, peerAudio.volume, readImmediateLevels]);
  const personalStatus = personalCallStatus(call, state, finished, endOutcome);
  const readGroupVoiceLevels = (): GroupVoiceSample[] => {
    if (!room || room.state !== "connected" || finished) return [];
    return [{ id: selfId, local: true, level: room.localParticipant.isMicrophoneEnabled ? readImmediateLevels()?.local ?? room.localParticipant.audioLevel : 0 },
      ...[...room.remoteParticipants.values()].map(person => {
        const id = call.participants.find(profile => profile.identity === person.identity)?.id ?? person.identity;
        const audio = participantAudio.get(id);
        return { id, local: false, level: person.isMicrophoneEnabled && !audio.muted && audio.volume > 0 ? person.audioLevel : 0 };
      })];
  };
  const groupPeople: GroupCallPerson[] = [];
  if (call.kind === "group") {
    const profiles = new Map(call.participants.map(person => [person.identity, person]));
    const mediaPeople = new Map(participants.map(person => [person.identity, person]));
    const identities = new Set([...profiles.keys(), ...mediaPeople.keys()]);
    for (const identity of identities) {
      const profile = profiles.get(identity), person = mediaPeople.get(identity);
      const local = Boolean(person && person === room?.localParticipant) || profile?.id === selfId;
      const video = !finished && person?.isCameraEnabled ? visibleCallTrack(person, "camera") : undefined;
      const shared = !finished && person?.isScreenShareEnabled ? visibleCallTrack(person, "screen_share") : undefined;
      groupPeople.push({
        id: profile?.id ?? identity, name: profile?.name ?? t(local ? "Вы" : "Участник"), avatarUrl: profile?.avatarUrl,
        local, muted: !person?.isMicrophoneEnabled, speaking: person?.isSpeaking ?? false,
        video: video ? <TrackElement track={video} local={local} audio={false} mirror={cameraFacing !== "environment"} /> : undefined,
        screen: shared ? <TrackElement track={shared} local={local} audio={false} /> : undefined,
      });
    }
  }

  return (
    <>
    {participants.filter(person => person !== room?.localParticipant).flatMap(person => [...person.audioTrackPublications.values()].map(publication => publication.track && <TrackElement key={`${person.identity}:${publication.trackSid}`} track={publication.track} local={false} audio muted={participantAudio.get(call.participants.find(p => p.identity === person.identity)?.id ?? "").muted} volume={participantAudio.get(call.participants.find(p => p.identity === person.identity)?.id ?? "").volume}/>))}
    {call.kind === "direct" ? <PersonalCallWindow
      callId={call.id}
      active={!finished && call.status === "active" && call.onThisSession && connected && Boolean(remote)} endOutcome={finished ? endOutcome ?? "completed" : undefined}
      signal={callConnectionSignal(room?.state, [room?.localParticipant.connectionQuality ?? "unknown", remote?.connectionQuality ?? "unknown"], finished)}
      name={call.title} avatarUrl={peer?.avatarUrl ?? null} backgroundUrl={call.peer?.backgroundUrl ?? null}
      status={personalStatus} startedAt={!finished && call.status === "active" && call.startedAt && call.onThisSession && connected && remote ? call.startedAt : null}
      incoming={call.incoming && !finished} owned={call.onThisSession && !finished} minimized={minimized} glass={glass} busy={busy} controlsDisabled={controlsDisabled}
      microphone={microphone} camera={camera} sound={!peerAudio.muted} volume={peerAudio.volume} onVolume={value => { if (peer) participantAudio.update(peer.id, { volume: value, muted: value === 0 }); }} sharing={screen} speaking={remote?.isSpeaking ?? false} readVoiceLevels={readVoiceLevels}
      noiseSuppression={pendingNoiseSuppression ?? (canToggleNoiseSuppression ? noiseSuppression : undefined)} noiseSuppressionPending={pendingNoiseSuppression !== null} onToggleNoiseSuppression={() => void toggleNoiseSuppression()}
      video={!finished && mainVideo ? <TrackElement track={mainVideo} local={presentation.local} audio={false} /> : undefined}
      localScreen={presentation.local} screenVideo={presentation.screen} screenOwner={presentation.local ? t("Вы демонстрируете свой экран") : t("Демонстрация экрана")}
      secondaryVideo={!finished && presentation.secondary ? <TrackElement track={presentation.secondary} local={false} audio={false} /> : undefined}
      sharedPreview={!finished && presentation.localPreview ? <div className="grid h-full place-items-center bg-[#202326] text-zinc-300"><MonitorUp size={24} aria-label={t("Вы демонстрируете экран")} /></div> : undefined}
      localVideo={!finished && localVideo ? <TrackElement track={localVideo} local audio={false} mirror={cameraFacing !== "environment"} /> : undefined}
      audioBlocked={audioBlocked && audioRecoveryVisible} canShare={typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)}
      onMinimize={minimize} onExpand={expand} onAccept={() => onJoin(call.id)} onHangup={() => hangup()}
      onMicrophone={() => void toggle("mic")} onCamera={() => void toggle("camera")} onSound={() => { if (peer) participantAudio.update(peer.id, { ...peerAudio, muted: !peerAudio.muted }); }} onShare={() => void toggle("screen")}
      onEnableAudio={enableAudio}
      onFlipCamera={() => void flipCamera()} cameraSwitching={cameraSwitching}
    /> : <GroupCallWindow
      callId={call.id} readVoiceLevels={readGroupVoiceLevels}
      title={call.title} status={!call.onThisSession ? "Звонок открыт на другом устройстве" : state}
      startedAt={connected && !finished ? call.startedAt : null} people={groupPeople}
      minimized={minimized} glass={glass} busy={busy} controlsDisabled={controlsDisabled} finished={finished}
      microphone={microphone} camera={camera} sharing={screen}
      canShare={typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)}
      canEnd={call.canEnd && call.onThisSession} audioBlocked={audioBlocked} onEnableAudio={enableAudio}
      onMinimize={minimize} onExpand={expand} onLeave={() => hangup()} onEnd={() => hangup(true)}
      onMicrophone={() => void toggle("mic")} onCamera={() => void toggle("camera")} onShare={() => void toggle("screen")}
    />}
    </>
  );
});
