"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlaybackWaveformLevels } from "@/lib/client/voice-waveform";
import { useMediaPortalTarget } from "@/lib/client/media-portal-targets";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, X } from "lucide-react";

type VoicePlayPayload = {
  src?: string;
  author?: string;
  durationMs?: number;
};

const VOICE_PLAY_EVENT = "eclipse:voice-play";
const VOICE_STATE_EVENT = "eclipse:voice-state";

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function GlobalVoicePlayer() {
  const t = useTranslation();
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioNode, setAudioNode] = useState<HTMLAudioElement | null>(null);
  const srcRef = useRef("");
  const playingRef = useRef(false);
  const [src, setSrc] = useState("");
  const [author, setAuthor] = useState("");
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const isAppRoute = pathname?.startsWith("/app") ?? false;
  const listTarget = useMediaPortalTarget("global-voice-list-slot", isAppRoute);
  const chatTarget = useMediaPortalTarget("global-voice-chat-slot", isAppRoute);
  const playbackLevels = usePlaybackWaveformLevels(audioNode, playing, visible && Boolean(src));

  const progressPercent = useMemo(() => {
    if (!durationMs) return 0;
    return Math.min(100, Math.max(0, (positionMs / durationMs) * 100));
  }, [durationMs, positionMs]);

  const broadcastState = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(VOICE_STATE_EVENT, {
        detail: {
          src: srcRef.current,
          author,
          playing: playingRef.current,
          visible,
          durationMs,
          positionMs,
          levels: playbackLevels,
        },
      }),
    );
  }, [author, durationMs, playbackLevels, positionMs, visible]);

  useEffect(() => {
    srcRef.current = src;
  }, [src]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    broadcastState();
  }, [broadcastState, playing, src]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onMobileChatVisibility = (event: Event) => {
      const custom = event as CustomEvent<{ mobileChatOpen?: boolean }>;
      setMobileChatOpen(Boolean(custom.detail?.mobileChatOpen));
    };
    window.addEventListener("eclipse:mobile-chat-visibility", onMobileChatVisibility as EventListener);
    return () => window.removeEventListener("eclipse:mobile-chat-visibility", onMobileChatVisibility as EventListener);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const browserDuration = Math.round(audio.duration * 1000);
        setDurationMs((prev) => Math.max(prev, browserDuration));
      }
    };
    const onTimeUpdate = () => setPositionMs(Math.max(0, Math.round(audio.currentTime * 1000)));
    const onEnded = () => {
      setPlaying(false);
      setPositionMs(0);
      audio.currentTime = 0;
    };
    const onError = () => {
      setPlaying(false);
      setVisible(false);
    };

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDurationMs(Math.round(audio.duration * 1000));
    }

    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !srcRef.current) return;
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
      return;
    }
    window.dispatchEvent(new CustomEvent("eclipse:music-hide"));
    const request = audio.play();
    if (request?.catch) request.catch(() => setPlaying(false));
    setPlaying(true);
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setPositionMs(0);
    setVisible(false);
  }, []);

  useEffect(() => {
    const onPlay = (event: Event) => {
      const custom = event as CustomEvent<VoicePlayPayload>;
      const nextSrc = (custom.detail?.src ?? "").trim();
      if (!nextSrc) return;
      const audio = audioRef.current;
      if (!audio) return;

      window.dispatchEvent(new CustomEvent("eclipse:music-hide"));
      setAuthor((custom.detail?.author ?? "").trim() || t("Голосовое сообщение"));
      setVisible(true);

      if (nextSrc === srcRef.current) {
        toggle();
        return;
      }

      const fallbackDuration = Math.max(0, Math.round(custom.detail?.durationMs ?? 0));
      srcRef.current = nextSrc;
      setSrc(nextSrc);
      setDurationMs(fallbackDuration);
      setPositionMs(0);
      audio.src = nextSrc;
      audio.load();
      audio.playbackRate = playbackRate;
      const request = audio.play();
      if (request?.catch) request.catch(() => setPlaying(false));
      setPlaying(true);
    };
    const onMusicPlay = () => {
      pause();
      setVisible(false);
    };
    const onVoicePause = () => pause();
    const onVoiceHide = () => {
      pause();
      setVisible(false);
    };

    window.addEventListener(VOICE_PLAY_EVENT, onPlay as EventListener);
    window.addEventListener("eclipse:music-play", onMusicPlay);
    window.addEventListener("eclipse:voice-pause", onVoicePause);
    window.addEventListener("eclipse:voice-hide", onVoiceHide);
    return () => {
      window.removeEventListener(VOICE_PLAY_EVENT, onPlay as EventListener);
      window.removeEventListener("eclipse:music-play", onMusicPlay);
      window.removeEventListener("eclipse:voice-pause", onVoicePause);
      window.removeEventListener("eclipse:voice-hide", onVoiceHide);
    };
  }, [pause, playbackRate, toggle, t]);

  const seekToMs = (nextValue: number) => {
    const audio = audioRef.current;
    if (!audio || !durationMs) return;
    const next = Math.max(0, Math.min(durationMs, Math.round(nextValue)));
    audio.currentTime = next / 1000;
    setPositionMs(next);
  };

  const cyclePlaybackRate = () => {
    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const renderPlayer = (variant: "list" | "chat") => (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -7, scale: 0.985, filter: "blur(3px)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={`relative isolate w-full overflow-hidden rounded-full px-2 py-0.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.04] backdrop-blur-[18px] ${
        variant === "chat" ? "bg-[#202020]/58" : "bg-[#141414]/46"
      }`}
    >
      <div className="flex h-8 min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          className="grid h-6 w-6 shrink-0 place-items-center text-zinc-300 transition-colors hover:text-white"
          aria-label={playing ? t("Пауза голосового сообщения") : t("Продолжить голосовое сообщение")}
        >
          {playing ? <Pause size={13} /> : <Play size={13} className="translate-x-[1px]" />}
        </button>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-[12px] font-semibold leading-tight text-zinc-100">{author}</p>
        </div>
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-zinc-400">
          {formatTime(positionMs)} / {formatTime(durationMs)}
        </span>
        <button
          type="button"
          onClick={cyclePlaybackRate}
          className="grid h-6 min-w-7 shrink-0 place-items-center rounded-full px-1 text-[10px] font-semibold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
          aria-label={t("Скорость воспроизведения")}
        >
          {playbackRate}x
        </button>
        <button
          type="button"
          onClick={close}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
          aria-label={t("Закрыть голосовое сообщение")}
        >
          <X size={14} />
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(1, durationMs)}
        step={100}
        value={Math.min(positionMs, durationMs)}
        onChange={(event) => seekToMs(Number(event.target.value))}
        aria-label={t("Прогресс голосового сообщения")}
        className="voice-mini-progress absolute bottom-0 left-0 right-0 block h-[1.5px] w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--ui-accent-solid, #d4d6da) ${progressPercent}%, rgba(255,255,255,0.10) ${progressPercent}%)`,
        }}
      />
      <style jsx>{`
        .voice-mini-progress {
          appearance: none;
          border-radius: 999px;
        }
        .voice-mini-progress::-webkit-slider-thumb {
          appearance: none;
          width: 0;
          height: 0;
          border: 0;
        }
        .voice-mini-progress::-moz-range-thumb {
          width: 0;
          height: 0;
          border: 0;
        }
      `}</style>
    </motion.div>
  );

  const showListPlayer = isAppRoute && visible && Boolean(src) && (!isMobile || !mobileChatOpen);
  const showChatPlayer = isAppRoute && visible && Boolean(src) && isMobile && mobileChatOpen;

  return (
    <>
      <audio
        ref={(node) => {
          audioRef.current = node;
          setAudioNode(node);
        }}
        preload="metadata"
      />
      {listTarget
        ? createPortal(<AnimatePresence>{showListPlayer ? renderPlayer("list") : null}</AnimatePresence>, listTarget)
        : null}
      {chatTarget
        ? createPortal(<AnimatePresence>{showChatPlayer ? renderPlayer("chat") : null}</AnimatePresence>, chatTarget)
        : null}
    </>
  );
}
