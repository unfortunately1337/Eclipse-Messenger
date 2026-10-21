"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import React, { useState, useRef, useCallback, useEffect, useId, CSSProperties } from "react";
import { Play, Pause, Volume2, VolumeX, Music, Bot } from "lucide-react";
import { IoMdEye } from "react-icons/io";
import { RiMicFill } from "react-icons/ri";
import { cn } from "@/lib/utils";
import { getMessageTailColor } from "@/lib/message-surface";
import { renderEmojiText } from "@/components/EmojiText";
import { MessageMeta } from "./MessageStatus";
import { VoiceWaveformBars } from "../../VoiceWaveformBars";
import { getCachedMediaUrl, invalidateCachedMediaUrl } from "@/lib/client/media-cache";
import { recoverMusicMessageMetadata } from "@/lib/client/music-message-metadata";

export function MessageBubbleTail({
  isMine,
  hasTail,
  mineGradientStyle,
  fillColor,
  gradientColors,
  surfaceHeight,
  className,
  compact = false,
}: {
  isMine: boolean;
  hasTail: boolean;
  mineGradientStyle?: CSSProperties;
  fillColor?: string;
  gradientColors?: readonly [string, string];
  surfaceHeight?: number;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslation();
  const gradientId = `message-tail-${useId().replace(/:/g, "")}`;
  if (!hasTail) return null;

  const tailFill = gradientColors && surfaceHeight
    ? `url(#${gradientId})`
    : fillColor || (isMine
    ? getMessageTailColor(mineGradientStyle)
    : "var(--incoming-message-background, #212121)");

  return (
    <svg
      viewBox="0 0 9 20"
      width={compact ? "6.3" : "9"}
      height={compact ? "14" : "20"}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bottom-0 z-0",
        isMine ? (compact ? "-right-[6px]" : "-right-[8.5px]") : (compact ? "-left-[6px]" : "-left-[8.5px]"),
        isMine
          ? (mineGradientStyle ? "" : "fill-white text-white")
          : "fill-[#212121] text-[#212121]",
        className
      )}
      style={{ fill: tailFill }}
    >
      {gradientColors && surfaceHeight ? (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={20 - surfaceHeight / (compact ? 0.7 : 1)} y2={20}>
            <stop offset="0" stopColor={gradientColors[0]} />
            <stop offset="1" stopColor={gradientColors[1]} />
          </linearGradient>
        </defs>
      ) : null}
      {isMine ? (
        <path d="M0 0 C0 7 3.5 14 9 20 L0 20 Z" />
      ) : (
        <path d="M9 0 C9 7 5.5 14 0 20 L9 20 Z" />
      )}
    </svg>
  );
}

// Reuse the displayed media frame for the tail instead of loading a second image or video.
export function MediaMessageTail({ isMine, hasTail }: { isMine: boolean; hasTail: boolean }) {
  const t = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const bounds = host?.getBoundingClientRect();
    const media = host && bounds ? Array.from(host.querySelectorAll<HTMLImageElement | HTMLVideoElement>(`button[aria-label="${t("Открыть изображение")}"] img, button[aria-label="${t("Открыть видео")}"] video, [data-album-media] img, [data-album-media] video`)).sort((a, b) => {
      const distance = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return Math.abs(bounds.bottom - rect.bottom) + Math.abs(isMine ? bounds.right - rect.right : bounds.left - rect.left);
      };
      return distance(a) - distance(b);
    })[0] : undefined;
    if (!canvas || !media || !hasTail) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const video = media instanceof HTMLVideoElement ? media : null;
    let frame: number | undefined;
    let disposed = false;
    const draw = () => {
      const naturalWidth = video ? video.videoWidth : (media as HTMLImageElement).naturalWidth;
      const naturalHeight = video ? video.videoHeight : (media as HTMLImageElement).naturalHeight;
      const width = media.clientWidth, height = media.clientHeight;
      if (!naturalWidth || !naturalHeight || !width || !height) return;
      const fit = getComputedStyle(media).objectFit === "contain" ? Math.min : Math.max;
      const scale = fit(width / naturalWidth, height / naturalHeight);
      const offsetX = (width - naturalWidth * scale) / 2;
      const offsetY = (height - naturalHeight * scale) / 2;
      context.clearRect(0, 0, 9, 20);
      context.save();
      context.clip(new Path2D(isMine ? "M0 0 C0 7 3.5 14 9 20 L0 20 Z" : "M9 0 C9 7 5.5 14 0 20 L9 20 Z"));
      context.fillStyle = "#000";
      context.fillRect(0, 0, 9, 20);
      try {
        context.drawImage(media, ((isMine ? width - 9 : 0) - offsetX) / scale, (height - 20 - offsetY) / scale, 9 / scale, 20 / scale, 0, 0, 9, 20);
      } catch { /* Wait for the first decoded frame. */ }
      context.restore();
    };
    // Source crop coordinates use the same object-fit scale as the visible thumbnail.
    const resize = new ResizeObserver(draw);
    resize.observe(media);
    media.addEventListener("load", draw);
    media.addEventListener("loadeddata", draw);
    const tick = () => {
      if (disposed || !video) return;
      draw();
      frame = video.requestVideoFrameCallback(tick);
    };
    draw();
    if (video && "requestVideoFrameCallback" in video) frame = video.requestVideoFrameCallback(tick);
    return () => {
      disposed = true;
      resize.disconnect();
      media.removeEventListener("load", draw);
      media.removeEventListener("loadeddata", draw);
      if (video && frame !== undefined) video.cancelVideoFrameCallback(frame);
    };
  }, [isMine, hasTail, t]);
  return hasTail ? <canvas data-media-tail ref={canvasRef} width={9} height={20} aria-hidden="true" className={cn("pointer-events-none absolute bottom-0 h-5 w-[9px]", isMine ? "-right-[8.5px]" : "-left-[8.5px]")} /> : null;
}

export function VoiceMessageBubble({
  src,
  durationMs,
  waveform,
  timeText,
  showDeliveryStatus,
  isRead,
  showChannelViews,
  channelViewsText,
  isMine,
  mineGradientStyle,
  bubbleClassName,
  reactionsSlot,
  headerSlot,
  hasTail,
}: {
  src: string;
  authorName?: string;
  durationMs: number;
  waveform?: number[];
  timeText: string;
  showDeliveryStatus: boolean;
  isRead: boolean;
  showChannelViews: boolean;
  channelViewsText: string;
  isMine: boolean;
  mineGradientStyle?: CSSProperties;
  bubbleClassName?: string;
  reactionsSlot?: React.ReactNode;
  headerSlot?: React.ReactNode;
  hasTail?: boolean;
}) {
  const t = useTranslation();
  const resolvedSrc = getCachedMediaUrl(src) || src;
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const next = getCachedMediaUrl(src) || src;
    setCurrentSrc(next);
  }, [src]);

  const handleAudioError = () => {
    if (currentSrc !== src && src) {
      invalidateCachedMediaUrl(src);
      setCurrentSrc(src);
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.load();
        } catch {}
      }
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const effectiveDurMs = (Number.isFinite(audioRef.current?.duration) && (audioRef.current?.duration ?? 0) > 0)
    ? Math.round((audioRef.current?.duration ?? 0) * 1000)
    : (durationMs || 0);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    const dur = (Number.isFinite(audio?.duration) && (audio?.duration ?? 0) > 0)
      ? (audio?.duration ?? 0) * 1000
      : durationMs;
    if (!audio || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTimeSec = (ratio * dur) / 1000;
    audio.currentTime = newTimeSec;
    setCurrentTime(newTimeSec * 1000);
    if (!playing) {
      audio.play().catch(() => {});
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => {
      const curMs = audio.currentTime * 1000;
      setCurrentTime(curMs);
      const durSec = (Number.isFinite(audio.duration) && audio.duration > 0)
        ? audio.duration
        : (durationMs > 0 ? durationMs / 1000 : 0);
      if (durSec > 0.5 && audio.currentTime >= durSec - 0.06) {
        onEnded();
        audio.pause();
        audio.currentTime = 0;
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [durationMs]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = effectiveDurMs > 0 ? Math.min(1, currentTime / effectiveDurMs) : 0;
  const isLightBubble = Boolean(isMine && !mineGradientStyle);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[16px] px-3.5 py-2.5 max-w-[270px] sm:max-w-[310px] w-full select-none transition-all duration-200 ease-out border-0",
        isLightBubble
          ? "bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
          : isMine
            ? "bg-[var(--ui-accent-solid,#2b5278)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
            : "bg-[#212121] text-white shadow-[0_1px_2px_rgba(0,0,0,0.22)]",
        bubbleClassName,
      )}
      style={isMine ? mineGradientStyle : undefined}
    >
      {headerSlot ? <div className="relative z-[2]">{headerSlot}</div> : null}
      <MessageBubbleTail isMine={isMine} hasTail={Boolean(hasTail)} mineGradientStyle={mineGradientStyle} />
      <audio ref={audioRef} src={currentSrc} preload="metadata" onError={handleAudioError} />

      {/* Top: Play button + Waveform & Duration */}
      <div className="relative z-[2] flex items-center gap-3 w-full">
        {/* Circular Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "relative z-[2] flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer shadow-md",
            isLightBubble
              ? "bg-zinc-950 text-white hover:bg-zinc-800"
              : isMine
                ? "bg-white text-[var(--voice-control-accent,var(--ui-accent-solid,#2b5278))] hover:bg-white/95"
                : "bg-[var(--voice-control-accent,var(--ui-accent-solid,#38bdf8))] text-[color:var(--voice-control-contrast,var(--ui-accent-contrast,#ffffff))] hover:opacity-90",
          )}
          aria-label={playing ? t("Пауза") : t("Воспроизвести")}
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="translate-x-[1px]" />
          )}
        </button>

        {/* Waveform and metadata container */}
        <div className="relative z-[2] flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* Waveform Bars */}
          <div
            onClick={handleSeek}
            className="cursor-pointer py-1 w-full flex items-center"
            title={t("Перемотать")}
          >
            <VoiceWaveformBars
              progress={progress * 100}
              playing={playing}
              recordedLevels={waveform}
              activeBarClass={
                isLightBubble
                  ? "bg-zinc-950"
                  : isMine
                    ? "bg-white opacity-95"
                    : "bg-[var(--ui-accent-solid,#38bdf8)]"
              }
              inactiveBarClass={
                isLightBubble
                  ? "bg-zinc-300 dark:bg-zinc-300/80"
                  : isMine
                    ? "bg-white/30"
                    : "bg-white/20"
              }
              displayBarCount={30}
              barWidthClass="w-[2.5px]"
              gapClass="gap-[2px]"
              maxBarHeight={20}
            />
          </div>

          {/* Duration on left; time and delivery status on right only when NO reactions */}
          <div className={cn(
            "flex items-center justify-between gap-2 text-[11px] font-medium leading-4 select-none",
            isLightBubble ? "text-zinc-500" : "text-white/80"
          )}>
            <span className={cn("tabular-nums leading-4", isLightBubble ? "text-zinc-600" : "text-white/90")}>
              {formatTime(playing ? currentTime : (effectiveDurMs || durationMs))}
            </span>
            {!reactionsSlot ? (
              <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className="inline-flex items-center gap-1 shrink-0 leading-none" />
            ) : null}
          </div>
        </div>
      </div>

      {/* When reactions exist: reactions on left, time indicator on right opposite to reaction */}
      {reactionsSlot ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-[2] flex items-center justify-between gap-2 mt-2 w-full"
        >
          <div className="min-w-0 flex-1">
            {reactionsSlot}
          </div>
          <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className={cn(
            "shrink-0 inline-flex items-center gap-1 text-[11px] font-medium leading-4 select-none",
            isLightBubble ? "text-zinc-500" : "text-white/80"
          )} />
        </div>
      ) : null}
    </div>
  );
}

export function VideoCircleBubble({
  src,
  durationMs,
  timeText,
  showDeliveryStatus,
  isRead,
  showChannelViews,
  channelViewsText,
  reactionsSlot,
  isMine,
}: {
  src: string;
  durationMs: number;
  timeText?: string;
  showDeliveryStatus?: boolean;
  isRead?: boolean;
  showChannelViews?: boolean;
  channelViewsText?: string;
  reactionsSlot?: React.ReactNode;
  isMine?: boolean;
}) {
  const t = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [currentSrc, setCurrentSrc] = useState(() => getCachedMediaUrl(src) || src);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Sync currentSrc when src prop changes
  useEffect(() => {
    const next = getCachedMediaUrl(src) || src;
    setCurrentSrc(next);
    setHasError(false);
  }, [src]);

  // Lazy loading: only render video when visible in chat viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // When currentSrc updates or enters view, ensure it loads and starts silent preview loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSrc) return;
    try {
      video.load();
    } catch {}
    if (isVisible && !expanded) {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.play().catch(() => {});
    }
  }, [currentSrc, isVisible, expanded]);

  // When visible but not expanded: play silent preview loop (never autoplay sound!)
  // When scrolled away: pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isVisible) {
      video.pause();
      return;
    }

    if (!expanded) {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.play().catch(() => {});
    } else if (isPlaying) {
      video.muted = false;
      video.play().catch(() => {});
    }
  }, [isVisible, expanded, isPlaying]);

  const handleVideoError = () => {
    if (currentSrc !== src && src) {
      invalidateCachedMediaUrl(src);
      setCurrentSrc(src);
      const video = videoRef.current;
      if (video) {
        try {
          video.load();
          if (!expanded) {
            video.muted = true;
            video.defaultMuted = true;
            video.loop = true;
            video.play().catch(() => {});
          }
        } catch {}
      }
      return;
    }
    setHasError(true);
  };

  const handleCanPlay = () => {
    setHasError(false);
    const video = videoRef.current;
    if (!video) return;
    if (isVisible && !expanded && video.paused) {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.play().catch(() => {});
    }
  };

  // Video playback events & circular progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const dur = (Number.isFinite(video.duration) && video.duration > 0)
        ? video.duration
        : (durationMs > 0 ? durationMs / 1000 : 0);
      if (dur > 0) {
        setProgress(Math.min(1, Math.max(0, video.currentTime / dur)));
        // Only trigger fallback if the video is genuinely at or past its full duration
        if (expanded && video.currentTime >= dur && video.currentTime > 0) {
          onEnded();
        }
      }
    };
    const onEnded = () => {
      if (expanded) {
        // Finished playback: show complete circle, then return to compact silent preview
        setProgress(1);
        setExpanded(false);
        setIsPlaying(false);
        setProgress(0);
        video.muted = true;
        video.defaultMuted = true;
        video.currentTime = 0;
        video.loop = true;
        video.play().catch(() => {});
      }
    };

    const onPlay = () => {
      if (expanded) setIsPlaying(true);
    };
    const onPause = () => {
      if (expanded) setIsPlaying(false);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [durationMs, expanded]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (hasError) {
      setHasError(false);
      video.load();
      if (!expanded) {
        setExpanded(true);
        setIsPlaying(true);
        video.muted = false;
        video.loop = false;
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    if (!expanded) {
      // User tapped unexpanded preview: expand smoothly, unmute, restart from beginning with sound
      setExpanded(true);
      setIsPlaying(true);
      video.muted = false;
      video.loop = false;
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      // User tapped while active: toggle pause / resume (progress ring stays, no pause icon)
      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      } else {
        video.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  // Circular progress ring metrics
  const circleRadius = 48;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div ref={containerRef} className="relative inline-block max-w-full select-none my-1 p-0.5 overflow-visible">
      <div
        onClick={handleToggle}
        style={{ maxWidth: "100%", height: "auto", aspectRatio: "1 / 1" }}
        className={cn(
          "relative rounded-full overflow-hidden cursor-pointer bg-zinc-950",
          "transition-all duration-350 ease-[cubic-bezier(0.34,1.3,0.64,1)] transform-gpu",
          expanded
            ? "w-[210px] h-[210px] sm:w-[230px] sm:h-[230px] md:w-[245px] md:h-[245px] border-0 border-transparent ring-0 shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
            : "w-[160px] h-[160px] sm:w-[175px] sm:h-[175px] border-[1.5px] border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        )}
      >
        {isVisible ? (
          <video
            ref={videoRef}
            src={currentSrc}
            playsInline
            muted={!expanded}
            loop={!expanded}
            preload="auto"
            onError={handleVideoError}
            onCanPlay={handleCanPlay}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-zinc-900/80 animate-pulse" />
        )}

        {hasError && (
          <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center bg-black/60 rounded-full text-white/90">
            <Play size={28} className="translate-x-0.5 opacity-80" />
          </div>
        )}

        {/* Telegram-style circular progress indicator running along the outer rim */}
        {expanded && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 100 100"
          >
            {/* Background track ring */}
            <circle
              cx="50"
              cy="50"
              r={circleRadius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1.6"
            />
            {/* Active progress ring */}
            <circle
              cx="50"
              cy="50"
              r={circleRadius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.95)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-100 ease-linear"
            />
          </svg>
        )}
      </div>

      {/* Timestamp badge floating on circle */}
      <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className={cn(
        "absolute px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white flex items-center gap-1 shadow-sm pointer-events-none transition-all duration-300",
        isMine
          ? (expanded ? "bottom-2 right-3" : "bottom-1.5 right-2.5")
          : (expanded ? "bottom-2 left-3" : "bottom-1.5 left-2.5")
      )} />

      {reactionsSlot ? (
        <div
          className={cn(
            "absolute z-20 pointer-events-auto transition-all duration-300 flex",
            expanded ? "-bottom-7.5" : "-bottom-7",
            isMine ? "right-2 justify-end" : "left-2 justify-start"
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {reactionsSlot}
        </div>
      ) : null}
    </div>
  );
}

export function MusicMessageBubble({
  url,
  title,
  author,
  coverUrl,
  caption,
  durationMs,
  timeText,
  showDeliveryStatus,
  isRead,
  showChannelViews,
  channelViewsText,
  isMine,
  mineGradientStyle,
  bubbleClassName,
  reactionsSlot,
  headerSlot,
  hasTail,
}: {
  url: string;
  title: string;
  author?: string;
  coverUrl?: string;
  caption?: string;
  durationMs?: number;
  timeText: string;
  showDeliveryStatus: boolean;
  isRead: boolean;
  showChannelViews: boolean;
  channelViewsText: string;
  isMine: boolean;
  mineGradientStyle?: CSSProperties;
  bubbleClassName?: string;
  reactionsSlot?: React.ReactNode;
  headerSlot?: React.ReactNode;
  hasTail?: boolean;
}) {
  const t = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackPosition, setTrackPosition] = useState(0);
  const [trackDuration, setTrackDuration] = useState(durationMs ?? 0);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<{ url: string; author?: string; coverUrl?: string } | null>(null);
  const originalTagsMissing = !author?.trim() && !coverUrl && durationMs === undefined;
  useEffect(() => {
    if (!originalTagsMissing || !url) return;
    let active = true;
    void recoverMusicMessageMetadata(url).then(metadata => {
      if (active) setRecovered({ url, ...metadata });
    }).catch(() => {});
    return () => { active = false; };
  }, [url, originalTagsMissing]);
  const originalTags = recovered?.url === url ? recovered : null;
  const trackCover = coverUrl || originalTags?.coverUrl;
  const showCover = Boolean(trackCover && failedCover !== trackCover);
  const artist = author?.trim() || originalTags?.author || "";

  useEffect(() => {
    const handleMusicState = (e: CustomEvent) => {
      const detail = e.detail;
      if (detail && detail.url === url) {
        setIsPlaying(Boolean(detail.playing));
        if (detail.durationMs) setTrackDuration(detail.durationMs);
        if (typeof detail.positionMs === "number" && Number.isFinite(detail.positionMs)) setTrackPosition(Math.max(0, detail.positionMs));
      } else {
        setIsPlaying(false);
      }
    };

    window.addEventListener("eclipse:music-state", handleMusicState as EventListener);
    return () => {
      window.removeEventListener("eclipse:music-state", handleMusicState as EventListener);
    };
  }, [url]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      window.dispatchEvent(new CustomEvent("eclipse:music-pause"));
    } else {
      window.dispatchEvent(
        new CustomEvent("eclipse:music-play", {
          detail: {
            url,
            label: title,
            title,
            author: artist,
            coverUrl: trackCover,
            userInitiated: true,
          },
        }),
      );
    }
  };

  const formatTime = (ms: number) => {
    if (!ms || ms <= 0) return "0:00";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const displaySubtitle = isPlaying
    ? formatTime(trackPosition)
    : trackDuration > 0
      ? (artist ? `${formatTime(trackDuration)} • ${artist}` : formatTime(trackDuration))
      : (artist || "0:00");

  const isLightBubble = Boolean(isMine && !mineGradientStyle);

  return (
    <div
      data-music-bubble
      onClick={togglePlay}
      className={cn(
        "relative flex flex-col rounded-[16px] px-3.5 py-2.5 max-w-[280px] sm:max-w-[320px] w-full select-none transition-all duration-200 ease-out border-0 cursor-pointer group",
        isLightBubble
          ? "bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
          : isMine
            ? "bg-[var(--ui-accent-solid,#2b5278)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
            : "bg-[#212121] text-white shadow-[0_1px_2px_rgba(0,0,0,0.22)]",
        bubbleClassName,
      )}
      style={isMine ? mineGradientStyle : undefined}
    >
      {headerSlot ? <div className="relative z-[2]">{headerSlot}</div> : null}
      <MessageBubbleTail isMine={isMine} hasTail={Boolean(hasTail)} mineGradientStyle={mineGradientStyle} />
      <audio
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          if (e.currentTarget.duration && Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setTrackDuration(Math.round(e.currentTarget.duration * 1000));
          }
        }}
        className="hidden"
      />

      {/* Top: Play button + Title / Subtitle */}
      <div className="relative z-[2] flex items-center gap-3 w-full">
        {/* Circular Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "relative z-[2] flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer shadow-md",
            isLightBubble
              ? "bg-zinc-950 text-white hover:bg-zinc-800"
              : isMine
                ? "bg-white text-[var(--voice-control-accent,var(--ui-accent-solid,#2b5278))] hover:bg-white/95"
                : "bg-[var(--voice-control-accent,var(--ui-accent-solid,#38bdf8))] text-[color:var(--voice-control-contrast,var(--ui-accent-contrast,#ffffff))] hover:opacity-90",
          )}
          aria-label={isPlaying ? t("Пауза") : t("Воспроизвести")}
          style={showCover ? { color: "#ffffff" } : undefined}
        >
          {showCover ? (
            <span className="absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
              <img data-music-cover src={trackCover} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={() => setFailedCover(trackCover ?? null)} />
              <span className="absolute inset-0 bg-black/35" />
            </span>
          ) : null}
          {isPlaying ? (
            <Pause size={18} fill="currentColor" className="relative" />
          ) : (
            <Play size={18} fill="currentColor" className="relative translate-x-[1px]" />
          )}
        </button>

        {/* Metadata container */}
        <div className="relative z-[2] flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <p data-music-title className={cn(
            "truncate text-[14px] font-semibold leading-tight",
            isLightBubble ? "text-zinc-950" : "text-white"
          )}>
            {title}
          </p>

          {/* Subtitle & timestamp (only when NO reactions) */}
          <div className={cn(
            "flex items-center justify-between text-[11.5px] font-medium leading-none select-none mt-0.5",
            isLightBubble ? "text-zinc-500" : "text-white/80"
          )}>
            <span data-music-subtitle className={cn(
              "truncate max-w-[140px]",
              isLightBubble ? "text-zinc-500" : "text-zinc-300"
            )}>
              {displaySubtitle}
            </span>
            {!reactionsSlot && !caption?.trim() ? (
              <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className="inline-flex items-center gap-1 shrink-0 leading-none ml-2" />
            ) : null}
          </div>
        </div>
      </div>

      {caption?.trim() ? (
        <p data-music-caption className="relative z-[2] mt-2 whitespace-pre-wrap break-words text-[13px] leading-5">{renderEmojiText(caption.trim())}</p>
      ) : null}
      {/* When reactions exist: reactions on left, time indicator on right opposite to reaction */}
      {reactionsSlot || caption?.trim() ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-[2] flex items-center justify-between gap-2 mt-2 w-full"
        >
          <div className="min-w-0 flex-1">
            {reactionsSlot}
          </div>
          <MessageMeta timeText={timeText} showChannelViews={showChannelViews} channelViewsText={channelViewsText} showDeliveryStatus={showDeliveryStatus} isRead={isRead} className={cn(
            "shrink-0 inline-flex items-center gap-1 text-[11.5px] font-medium leading-4 select-none",
            isLightBubble ? "text-zinc-500" : "text-white/80"
          )} />
        </div>
      ) : null}
    </div>
  );
}
