"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Music2, Pause, Play, SkipBack, SkipForward, X, Shuffle, Repeat, Share, ArrowLeftRight } from "lucide-react";
import { isSameProfileMusic, prepareProfileMusicMedia } from "@/lib/client/music-profile";
import { requestMusicShare } from "@/lib/client/music-share";
import { apiRequest } from "@/lib/client/http";
import { useMediaPortalTarget } from "@/lib/client/media-portal-targets";
import { showAppToast } from "@/lib/client/app-toast";
import { CALL_PLAYBACK_CHANGED, isCallPlaybackActive } from "@/lib/client/call-playback";
import { getChatHeaderVisualStyle } from "@/lib/client/panel-visual";
import { LIVE_BACKGROUND_STORAGE_KEY, LIVE_BACKGROUND_UPDATED_EVENT, loadLiveBackgroundSettings } from "@/lib/client/live-background";

function deriveLabelFromUrl(url: string) {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    const path = parsed.pathname.split("/").filter(Boolean);
    const last = path.at(-1) ?? "";
    const file = decodeURIComponent(last).replace(/\.[^.]+$/u, "").replace(/[_]+/g, " ").trim();
    if (!file) return t("Музыка");
    return file;
  } catch {
    return url.split("/").pop() ?? t("Музыка");
  }
}

export default function GlobalMusicPlayer() {
  const t = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackUrlRef = useRef("");
  const playingRef = useRef(false);
  const playRequestSeqRef = useRef(0);
  const historyRef = useRef<Array<{ url: string; label: string; title: string; author: string; coverUrl: string }>>([]);
  const HISTORY_KEY = "eclipse_music_history";

  const [trackUrl, setTrackUrl] = useState("");
  const [trackLabel, setTrackLabel] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [trackAuthor, setTrackAuthor] = useState("");
  const [trackCoverUrl, setTrackCoverUrl] = useState("");
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [trackSaved, setTrackSaved] = useState(false);
  const [checkingProfileMusic, setCheckingProfileMusic] = useState(false);
  const [profileMusicRevision, setProfileMusicRevision] = useState(0);
  const [savingToProfile, setSavingToProfile] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [transparentVisual, setTransparentVisual] = useState(true);
  const [inCall, setInCall] = useState(isCallPlaybackActive);
  const isAppRoute = pathname?.startsWith("/app") ?? false;
  const listTarget = useMediaPortalTarget("global-music-list-slot", isAppRoute);
  const chatTarget = useMediaPortalTarget("global-music-chat-slot", isAppRoute);
  const miniPlayerStyle = useMemo(() => ({ ...getChatHeaderVisualStyle(transparentVisual), border: 0, borderRadius: 999 }), [transparentVisual]);

  useEffect(() => {
    const sync = () => {
      const active = isCallPlaybackActive();
      setInCall(active);
      if (active) {
        audioRef.current?.pause();
        playingRef.current = false;
        setPlaying(false);
        setExpanded(false);
        window.dispatchEvent(new CustomEvent("eclipse:voice-hide"));
      }
    };
    sync();
    window.addEventListener(CALL_PLAYBACK_CHANGED, sync);
    return () => window.removeEventListener(CALL_PLAYBACK_CHANGED, sync);
  }, []);

  useEffect(() => {
    const sync = () => setTransparentVisual(loadLiveBackgroundSettings().transparentVisual ?? true);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === LIVE_BACKGROUND_STORAGE_KEY) sync();
    };
    sync();
    window.addEventListener(LIVE_BACKGROUND_UPDATED_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LIVE_BACKGROUND_UPDATED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const [volume] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("eclipse_music_volume");
        if (saved !== null) {
          const val = Number.parseFloat(saved);
          if (Number.isFinite(val) && val > 0 && val <= 1) return val;
        }
      } catch {}
    }
    return 1;
  });
  const progressPercent = useMemo(() => {
    if (!durationMs) return 0;
    return Math.min(100, Math.max(0, (positionMs / durationMs) * 100));
  }, [durationMs, positionMs]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__eclipseMusicActive = Boolean(visible && trackUrl);
    }
    window.dispatchEvent(
      new CustomEvent("eclipse:music-state", {
        detail: {
          url: trackUrl,
          label: trackLabel,
          title: trackTitle,
          author: trackAuthor,
          coverUrl: trackCoverUrl,
          playing,
          visible,
          durationMs,
          positionMs,
        },
      }),
    );
  }, [durationMs, playing, positionMs, trackAuthor, trackCoverUrl, trackLabel, trackTitle, trackUrl, visible]);

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
    return () =>
      window.removeEventListener("eclipse:mobile-chat-visibility", onMobileChatVisibility as EventListener);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{ url: string; label?: string; title?: string; author?: string; coverUrl?: string }>;
      if (Array.isArray(parsed)) {
        historyRef.current = parsed
          .filter((item) => typeof item.url === "string" && item.url.trim())
          .map((item) => ({
            url: item.url.trim(),
            label: (item.label ?? "").trim(),
            title: (item.title ?? "").trim(),
            author: (item.author ?? "").trim(),
            coverUrl: (item.coverUrl ?? "").trim(),
          }));
      }
    } catch {
      historyRef.current = [];
    }
  }, []);

  const saveHistory = useCallback(() => {
    try {
      const serialized = JSON.stringify(historyRef.current.slice(0, 50));
      window.localStorage.setItem(HISTORY_KEY, serialized);
    } catch {
      // ignore
    }
  }, []);

  const handlePlayRequest = useCallback(
    (payload: { url?: string; label?: string; title?: string; author?: string; coverUrl?: string; userInitiated?: boolean }) => {
      if (isCallPlaybackActive()) {
        showAppToast({ type: "error", title: t("Вы сейчас в звонке.") });
        return;
      }
      const playSeq = ++playRequestSeqRef.current;
      const url = (payload.url ?? "").trim();
      if (!url) return;
      const title = (payload.title ?? "").trim() || deriveLabelFromUrl(url);
      const author = (payload.author ?? "").trim();
      const coverUrl = (payload.coverUrl ?? "").trim();
      const labelBase = (payload.label ?? "").trim() || title;
      const label = author ? `${labelBase} — ${author}` : labelBase;
      window.dispatchEvent(new CustomEvent("eclipse:voice-hide"));

      if (url === trackUrlRef.current) {
        // A caption edit or recovered embedded tags can update the same track.
        // Keep explicit metadata fresh without restarting its playback position.
        if (payload.title !== undefined) setTrackTitle(title);
        if (payload.author !== undefined) setTrackAuthor(author);
        if (payload.coverUrl !== undefined) setTrackCoverUrl(coverUrl);
        setTrackLabel(label);
        historyRef.current = historyRef.current.map(track => track.url === url ? {
          ...track, label,
          ...(payload.title !== undefined ? { title } : {}),
          ...(payload.author !== undefined ? { author } : {}),
          ...(payload.coverUrl !== undefined ? { coverUrl } : {}),
        } : track);
        saveHistory();
        const audio = audioRef.current;
        if (!audio) return;
        if (playingRef.current) {
          audio.pause();
          setPlaying(false);
        } else {
          const playPromise = audio.play();
          if (playPromise?.catch) {
            playPromise.catch(() => {});
          }
          setPlaying(true);
        }
        setVisible(true);
        setExpanded(false);
        return;
      }

      setTrackUrl(url);
      setTrackLabel(label);
      setTrackTitle(title);
      setTrackAuthor(author);
      setTrackCoverUrl(coverUrl);
      setVisible(true);
      setExpanded(false);
      setPositionMs(0);
      setDurationMs(0);
      setTrackSaved(false);

      trackUrlRef.current = url;
      historyRef.current = [
        { url, label, title, author, coverUrl },
        ...historyRef.current.filter((item) => item.url !== url),
      ].slice(0, 50);
      saveHistory();

      const audio = audioRef.current;
      if (!audio) return;
      audio.src = url;
      audio.load();
      if (payload.userInitiated) {
        const playPromise = audio.play();
        if (playPromise?.catch) {
          playPromise.catch(() => {});
        }
        setPlaying(true);
      } else {
        setPlaying(false);
      }

      if (playSeq !== playRequestSeqRef.current) return;
    },
    [],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoaded = () => {
      setDurationMs(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
    };
    const handleTimeUpdate = () => {
      setPositionMs(Math.max(0, Math.round(audio.currentTime * 1000)));
    };
    const handleEnded = () => {
      setPlaying(false);
      if (isCallPlaybackActive()) return;
      const history = historyRef.current;
      if (history.length > 1) {
        const next = history[1];
        handlePlayRequest({ ...next, userInitiated: true });
      }
    };

    const handleError = () => {
      console.warn("[GlobalMusicPlayer] Audio error:", audio?.error);
      setPlaying(false);
      showAppToast({
        title: t("Не удалось воспроизвести аудио"),
        description: t("Аудиофайл поврежден или недоступен"),
        type: "error",
      });
    };

    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [handlePlayRequest, t]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = false;
    }
  }, [trackUrl, volume]);

  useEffect(() => {
    const onPlay = (event: Event) => {
      const custom = event as CustomEvent<{ url?: string; label?: string; userInitiated?: boolean }>;
      handlePlayRequest(custom.detail ?? {});
    };
    const onPause = () => {
      const audio = audioRef.current;
      if (audio) audio.pause();
      setPlaying(false);
    };
    const onHide = () => {
      const audio = audioRef.current;
      if (audio) audio.pause();
      setPlaying(false);
      setVisible(false);
      setExpanded(false);
    };

    window.addEventListener("eclipse:music-play", onPlay as EventListener);
    window.addEventListener("eclipse:music-pause", onPause);
    window.addEventListener("eclipse:music-hide", onHide);
    return () => {
      window.removeEventListener("eclipse:music-play", onPlay as EventListener);
      window.removeEventListener("eclipse:music-pause", onPause);
      window.removeEventListener("eclipse:music-hide", onHide);
    };
  }, [handlePlayRequest]);

  useEffect(() => {
    (window as any).eclipseGlobalMusicPlay = handlePlayRequest;
    return () => {
      if ((window as any).eclipseGlobalMusicPlay === handlePlayRequest) {
        delete (window as any).eclipseGlobalMusicPlay;
      }
    };
  }, [handlePlayRequest]);

  useEffect(() => {
    trackUrlRef.current = trackUrl;
  }, [trackUrl]);

  useEffect(() => {
    if (!expanded || !trackUrl) return;
    let active = true;
    setCheckingProfileMusic(true);
    // Always refresh: the local profile snapshot may predate Add/Remove.
    apiRequest<{ musicUrl?: string | null }>("/api/settings/profile", { method: "GET" })
      .then(async data => {
        const saved = await isSameProfileMusic(data.musicUrl, trackUrl);
        if (active) setTrackSaved(saved);
      })
      .catch(() => { if (active) setTrackSaved(false); })
      .finally(() => { if (active) setCheckingProfileMusic(false); });
    return () => { active = false; };
  }, [expanded, trackUrl, profileMusicRevision]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    window.dispatchEvent(new CustomEvent("eclipse:voice-hide"));
    if (isCallPlaybackActive()) {
      showAppToast({ type: "error", title: t("Вы сейчас в звонке.") });
      return;
    }
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
    setPlaying(true);
  };

  const seekBy = (deltaMs: number) => {
    const audio = audioRef.current;
    if (!audio || !durationMs) return;
    const next = Math.max(0, Math.min(durationMs, Math.round(audio.currentTime * 1000 + deltaMs)));
    audio.currentTime = next / 1000;
    setPositionMs(next);
  };

  const seekToMs = (valueMs: number) => {
    if (!durationMs) return;
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.max(0, Math.min(durationMs, Math.round(valueMs)));
    audio.currentTime = next / 1000;
    setPositionMs(next);
  };

  const close = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setPlaying(false);
    setVisible(false);
    setExpanded(false);
  };

  const closeExpanded = () => {
    setExpanded(false);
  };

  const saveCurrentTrackToProfile = async () => {
    const url = trackUrl.trim();
    if (!url || savingToProfile || checkingProfileMusic) return;
    setSavingToProfile(true);
    try {
      const upload = async (blob: Blob, kind: "audio" | "image") => {
        const form = new FormData();
        form.append("file", blob, kind === "audio" ? "profile-audio" : "profile-cover");
        form.append("kind", kind);
        form.append("scopeType", "public");
        const data = await apiRequest<{ url: string }>("/api/media", { method: "POST", body: form });
        return data.url;
      };
      const [musicUrl, musicCoverUrl] = await Promise.all([
        prepareProfileMusicMedia(url, "audio", upload),
        trackCoverUrl ? prepareProfileMusicMedia(trackCoverUrl, "image", upload) : Promise.resolve(null),
      ]);
      await apiRequest("/api/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({
          musicUrl,
          musicTitle: trackTitle || deriveLabelFromUrl(url),
          musicAuthor: trackAuthor || null,
          musicCoverUrl,
        }),
      });

      showAppToast({
        type: "success",
        title: t("Музыка добавлена"),
        description: t("Текущий трек сохранен в профиле."),
      });
      if (trackUrlRef.current === url) setTrackSaved(true);
      setProfileMusicRevision(value => value + 1);
    } catch (error) {
      showAppToast({
        type: "error",
        title: t("Не удалось сохранить музыку"),
        description: error instanceof Error ? error.message : t("Попробуйте еще раз чуть позже."),
      });
    } finally {
      setSavingToProfile(false);
    }
  };

  const removeCurrentTrackFromProfile = async () => {
    const url = trackUrl.trim();
    if (!url || savingToProfile || checkingProfileMusic) return;
    setSavingToProfile(true);
    try {
      await apiRequest("/api/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({
          musicUrl: null,
          musicTitle: null,
          musicAuthor: null,
          musicCoverUrl: null,
        }),
      });

      showAppToast({
        type: "success",
        title: t("Музыка убрана"),
        description: t("Трек больше не отображается в профиле."),
      });
      setTrackSaved(false);
      setProfileMusicRevision(value => value + 1);
    } catch (error) {
      showAppToast({
        type: "error",
        title: t("Не удалось убрать музыку"),
        description: error instanceof Error ? error.message : t("Попробуйте еще раз чуть позже."),
      });
    } finally {
      setSavingToProfile(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const shouldShowListPlayer = !inCall && isAppRoute && visible && !!trackUrl && (!isMobile || !mobileChatOpen);
  const shouldShowChatPlayer = !inCall && isAppRoute && visible && !!trackUrl && isMobile && mobileChatOpen;
  const shouldMarquee = trackLabel.trim().length > 24;

  const renderMiniPlayer = (variant: "list" | "chat") => (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "none" }}
      exit={{ opacity: 0, y: -7, scale: 0.985, filter: "blur(3px)" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div
        onClick={() => setExpanded(true)}
        data-music-mini-player={variant}
        style={miniPlayerStyle}
        className="relative isolate cursor-pointer overflow-hidden rounded-full h-9 px-3 transition-colors flex items-center border-0 outline-none ring-0"
      >
        <div className="relative flex w-full min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className="grid h-6 w-6 shrink-0 place-items-center text-zinc-300 transition-colors hover:text-white"
            aria-label={playing ? t("Пауза") : t("Воспроизвести")}
          >
            {playing ? <Pause size={13} fill="currentColor" strokeWidth={0} /> : <Play size={13} fill="currentColor" strokeWidth={0} className="translate-x-[1px]" />}
          </button>

          <div className="flex h-6 min-w-0 flex-1 items-center overflow-hidden">
            <div
              className={`flex h-6 shrink-0 items-center whitespace-nowrap ${
                shouldMarquee ? "animate-track-marquee gap-10 pr-10" : ""
              }`}
            >
              <span className="truncate text-[12px] font-medium leading-none text-zinc-200">
                {trackAuthor ? `${trackAuthor} — ${trackTitle || trackLabel}` : trackTitle || trackLabel}
              </span>
              {shouldMarquee ? (
                <span className="text-[12px] font-medium leading-none text-zinc-200">
                  {trackAuthor ? `${trackAuthor} — ${trackTitle || trackLabel}` : trackTitle || trackLabel}
                </span>
              ) : null}
            </div>
          </div>

          <span className="flex h-6 shrink-0 items-center text-[10px] font-medium leading-none tabular-nums text-zinc-400">
            {formatTime(positionMs)}
          </span>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t("Закрыть плеер")}
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
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => seekToMs(Number(event.target.value))}
          aria-label={t("Прогресс музыки")}
          className="music-mini-progress absolute bottom-0 left-0 right-0 block h-[1.5px] w-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, #ffffff ${progressPercent}%, rgba(255,255,255,0.08) ${progressPercent}%)`,
          }}
        />

        <style jsx>{`
          .music-mini-progress {
            appearance: none;
            border-radius: 999px;
          }
          .music-mini-progress::-webkit-slider-thumb {
            appearance: none;
            width: 0;
            height: 0;
            border: 0;
          }
          .music-mini-progress::-moz-range-thumb {
            width: 0;
            height: 0;
            border: 0;
          }
          @keyframes track-marquee {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </div>
    </motion.div>
  );

  return (
    <>
      <AnimatePresence>
        {expanded ? (
          <motion.div
            className="fixed inset-0 z-[250]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              aria-label={t("Закрыть плеер")}
              className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
              onClick={closeExpanded}
            />
            <motion.div
              initial={isMobile ? { y: "100%" } : { scale: 0.94, opacity: 0, y: "-46%" }}
              animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: "-50%" }}
              exit={isMobile ? { y: "100%" } : { scale: 0.94, opacity: 0, y: "-46%" }}
              transition={
                isMobile
                  ? { type: "spring", damping: 30, stiffness: 350 }
                  : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
              }
              className={
                isMobile
                  ? "absolute bottom-0 left-0 right-0 rounded-t-[32px] bg-[#161618] px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-6 shadow-[0_-20px_60px_rgba(0,0,0,0.7)] border-t border-white/[0.08] backdrop-blur-2xl"
                  : "absolute left-1/2 top-1/2 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 rounded-[28px] bg-[#161618] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.7)] border border-white/[0.08] backdrop-blur-2xl"
              }
            >
              {/* Track Row */}
              <div className="flex items-center gap-3.5">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-white/10 shadow-md flex items-center justify-center">
                  {trackCoverUrl ? (
                    <img src={trackCoverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Music2 size={22} className="text-zinc-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-white leading-tight">
                    {trackTitle || trackLabel || t("Музыка")}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-normal text-zinc-400 leading-tight">
                    {trackAuthor || t("Неизвестный исполнитель")}
                  </p>
                </div>
                <button type="button" aria-label={t("Поделиться аудиофайлом")} disabled={!trackUrl}
                  onClick={() => {
                    requestMusicShare({ url: trackUrl, title: trackTitle || trackLabel, author: trackAuthor, coverUrl: trackCoverUrl, durationMs });
                    setExpanded(false);
                    if (pathname !== "/app") router.push("/app");
                  }}
                  className="ml-auto grid h-9 w-9 shrink-0 place-items-center text-zinc-300 hover:text-white active:scale-95 transition disabled:opacity-40"><Share size={20} /></button>
              </div>

              {/* Progress Slider */}
              <div className="mt-5 space-y-1.5">
                <div className="relative flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, durationMs)}
                    step={100}
                    value={Math.min(positionMs, durationMs)}
                    onChange={(event) => seekToMs(Number(event.target.value))}
                    aria-label={t("Прогресс")}
                    className="music-expanded-progress w-full cursor-pointer pointer-events-auto"
                    style={{
                      background: `linear-gradient(to right, #ffffff ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%)`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-medium tabular-nums text-zinc-500 px-0.5">
                  <span>{formatTime(positionMs)}</span>
                  <span>{formatTime(durationMs)}</span>
                </div>
              </div>

              {/* Playback Controls (Prev, Play/Pause, Next) */}
              <div className="relative mt-5 flex items-center justify-center gap-7 px-7">
                <button
                  type="button"
                  onClick={() => seekBy(-10000)}
                  className="grid h-12 w-12 place-items-center text-white transition-transform active:scale-90 hover:opacity-80"
                  aria-label={t("Назад")}
                >
                  <SkipBack size={28} fill="currentColor" />
                </button>

                <button
                  type="button"
                  onClick={toggle}
                  className="grid h-14 w-14 place-items-center text-white transition-transform active:scale-95 hover:opacity-80"
                  aria-label={playing ? t("Пауза") : t("Воспроизвести")}
                >
                  {playing ? (
                    <Pause size={36} fill="currentColor" />
                  ) : (
                    <Play size={36} fill="currentColor" className="translate-x-[2px]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(10000)}
                  className="grid h-12 w-12 place-items-center text-white transition-transform active:scale-90 hover:opacity-80"
                  aria-label={t("Вперед")}
                >
                  <SkipForward size={28} fill="currentColor" />
                </button>
                <button type="button" aria-label={t("Повторять трек")} aria-pressed={isLoop} onClick={() => setIsLoop(value => !value)}
                  className={`absolute right-0 grid h-9 w-9 place-items-center transition-colors active:scale-95 ${isLoop ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}><ArrowLeftRight size={20} /></button>
              </div>

              {/* Profile Sync Button */}
              <button
                type="button"
                disabled={savingToProfile || checkingProfileMusic || !trackUrl.trim()}
                onClick={() => void (trackSaved ? removeCurrentTrackFromProfile() : saveCurrentTrackToProfile())}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.12] active:scale-[0.99] px-4 text-[14px] font-semibold text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {trackSaved ? t("Удалить из профиля") : t("Добавить в профиль")}
              </button>
              <style jsx>{`
                .music-expanded-progress {
                  -webkit-appearance: none;
                  appearance: none;
                  border-radius: 999px;
                  background-color: rgba(255, 255, 255, 0.08);
                  height: 4px;
                  transition: height 0.15s ease;
                }
                .music-expanded-progress:hover {
                  height: 6px;
                }
                .music-expanded-progress::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 12px;
                  height: 12px;
                  border-radius: 999px;
                  background: #ffffff;
                  border: none;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                  cursor: pointer;
                }
                .music-expanded-progress::-moz-range-thumb {
                  width: 12px;
                  height: 12px;
                  border-radius: 999px;
                  background: #ffffff;
                  border: none;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                  cursor: pointer;
                }
                .music-expanded-progress::-moz-range-track {
                  height: 4px;
                  border-radius: 999px;
                  background: transparent;
                }
              `}</style>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <audio ref={audioRef} preload="metadata" loop={isLoop} />

      {listTarget
        ? createPortal(
            <AnimatePresence>{shouldShowListPlayer ? renderMiniPlayer("list") : null}</AnimatePresence>,
            listTarget,
          )
        : null}
      {chatTarget
        ? createPortal(
            <AnimatePresence>{shouldShowChatPlayer ? renderMiniPlayer("chat") : null}</AnimatePresence>,
            chatTarget,
          )
        : null}
    </>
  );
}
