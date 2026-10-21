"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  FastForward,
  Maximize,
  Minimize,
  Pause,
  Play,
  Rewind,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Standard Liquid Glass styling matching the message composer input field
 */
export const LIQUID_GLASS_STYLE: React.CSSProperties = {
  backgroundColor: "var(--app-panel-background, rgba(24, 24, 28, 0.92))",
  borderColor: "var(--app-panel-border, rgba(255, 255, 255, 0.08))",
  boxShadow:
    "var(--app-panel-highlight, inset 0 1px 0 rgba(255, 255, 255, 0.08))",
  backdropFilter: "var(--app-panel-filter, blur(8px) saturate(1.05))",
  WebkitBackdropFilter: "var(--app-panel-filter, blur(8px) saturate(1.05))",
};

/**
 * Format seconds into mm:ss or hh:mm:ss
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Telegram iOS style 15-second Rewind Circular Icon
 */
export function Rewind15Icon({ className }: { className?: string }) {
  const t = useTranslation();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <text
        x="12.2"
        y="13.2"
        textAnchor="middle"
        dominantBaseline="central"
        stroke="none"
        fill="currentColor"
        fontSize="7.2"
        fontWeight="700"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        15
      </text>
    </svg>
  );
}

/**
 * Telegram iOS style 15-second Forward Circular Icon
 */
export function Forward15Icon({ className }: { className?: string }) {
  const t = useTranslation();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.99 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <text
        x="11.8"
        y="13.2"
        textAnchor="middle"
        dominantBaseline="central"
        stroke="none"
        fill="currentColor"
        fontSize="7.2"
        fontWeight="700"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        15
      </text>
    </svg>
  );
}

/**
 * High-performance direct-DOM text component for single time readout (e.g. 0:20 or 0:31).
 * Updates DOM directly on integer-second changes with zero React re-renders.
 */
export const SingleTimeDisplay = memo(function SingleTimeDisplay({
  time,
  className,
  style,
}: {
  time: MotionValue<number>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslation();
  const spanRef = useRef<HTMLSpanElement>(null);
  const lastSecRef = useRef<number>(-1);

  const update = useCallback(() => {
    if (!spanRef.current) return;
    const val = time.get() || 0;
    const sec = Math.floor(val);
    if (sec !== lastSecRef.current) {
      lastSecRef.current = sec;
      spanRef.current.textContent = formatTime(val);
    }
  }, [time]);

  useMotionValueEvent(time, "change", update);

  useEffect(() => {
    update();
  }, [update]);

  return (
    <span
      ref={spanRef}
      style={style}
      className={cn(
        "text-xs sm:text-[13px] font-mono tabular-nums text-white/90 select-none shrink-0 tracking-tight",
        className
      )}
    >
      00:00
    </span>
  );
});

/**
 * Ultra-performant direct-DOM text component for time readout.
 * Updates DOM directly on integer-second changes with 0 React re-renders.
 */
export const VideoTimeDisplay = memo(function VideoTimeDisplay({
  currentTime,
  duration,
  className,
  style,
}: {
  currentTime: MotionValue<number>;
  duration: MotionValue<number>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslation();
  const spanRef = useRef<HTMLSpanElement>(null);
  const lastTextRef = useRef<string>("");

  const updateText = useCallback(() => {
    if (!spanRef.current) return;
    const curr = currentTime.get();
    const dur = duration.get();
    const text = `${formatTime(curr)} / ${formatTime(dur)}`;
    if (text !== lastTextRef.current) {
      lastTextRef.current = text;
      spanRef.current.textContent = text;
    }
  }, [currentTime, duration]);

  useMotionValueEvent(currentTime, "change", updateText);
  useMotionValueEvent(duration, "change", () => {
    lastTextRef.current = "";
    updateText();
  });

  useEffect(() => {
    updateText();
  }, [updateText]);

  return (
    <span
      ref={spanRef}
      style={style}
      className={cn(
        "h-10 md:h-11 flex items-center text-xs sm:text-[13px] font-mono tabular-nums text-white/80 select-none shrink-0 tracking-tight",
        className
      )}
    >
      00:00 / 00:00
    </span>
  );
});


/**
 * Hover timestamp tooltip attached to the scrubber needle
 */
const HoverTimeBadge = memo(function HoverTimeBadge({
  hoverTime,
  accentColor,
}: {
  hoverTime: MotionValue<number>;
  accentColor: string;
}) {
  const t = useTranslation();
  const spanRef = useRef<HTMLSpanElement>(null);
  const lastSecRef = useRef<number>(-1);

  useMotionValueEvent(hoverTime, "change", (latest) => {
    const sec = Math.floor(latest);
    if (sec !== lastSecRef.current && spanRef.current) {
      lastSecRef.current = sec;
      spanRef.current.textContent = formatTime(latest);
    }
  });

  return (
    <span
      ref={spanRef}
      style={{ ...LIQUID_GLASS_STYLE, color: accentColor }}
      className="text-[11px] font-mono leading-none border rounded-md px-2 py-1 select-none pointer-events-none whitespace-nowrap"
    >
      00:00
    </span>
  );
});

export interface SkiperScrubberProps {
  currentTime: MotionValue<number>;
  duration: MotionValue<number>;
  onChange: (time: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  accentColor?: string;
  className?: string;
  showTimeLabels?: boolean;
}

/**
 * Skiper91 Elastic Rubber-Band Scrubber.
 * Butter-smooth 60/120fps GPU performance without layout thrashing or clipPath repaints.
 */
export const SkiperScrubber = memo(function SkiperScrubber({
  currentTime,
  duration,
  onChange,
  onScrubStart,
  onScrubEnd,
  accentColor = "var(--ui-accent-solid, #71717a)",
  className,
  showTimeLabels = true,
}: SkiperScrubberProps) {
  const t = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const trackRectRef = useRef<{ left: number; right: number; width: number }>({
    left: 0,
    right: 0,
    width: 0,
  });

  const hoverTime = useMotionValue(0);
  const overscrollDirection = useMotionValue(0); // -1: left, 0: center, 1: right
  const pointerX = useMotionValue(0);
  const hoverX = useMotionValue(0);
  const overscrollAmount = useMotionValue(0);
  const scrubberScale = useMotionValue(0.85);
  const hoverOpacity = useMotionValue(0);
  const progressPercent = useMotionValue(0);

  // Safely cache track dimensions with ResizeObserver so getBoundingClientRect() is NEVER called in animation loops
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const updateRect = () => {
      const rect = track.getBoundingClientRect();
      trackRectRef.current = {
        left: rect.left,
        right: rect.right,
        width: rect.width || 1,
      };
    };
    updateRect();
    const ro = new ResizeObserver(updateRect);
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  // Update progress percentage (0..100) reactively on motion value change
  const updateProgress = useCallback(() => {
    const dur = duration.get();
    const curr = currentTime.get();
    if (!dur || dur <= 0) {
      progressPercent.set(0);
      return;
    }
    const pct = Math.min(Math.max((curr / dur) * 100, 0), 100);
    progressPercent.set(pct);
  }, [currentTime, duration, progressPercent]);

  useMotionValueEvent(currentTime, "change", updateProgress);
  useMotionValueEvent(duration, "change", updateProgress);

  // Elastic rubber-banding formula on overscroll without forced synchronous layout
  useMotionValueEvent(pointerX, "change", (clientX) => {
    const { left, right } = trackRectRef.current;
    if (left === 0 && right === 0) return;
    let dist = 0;
    if (clientX < left) {
      overscrollDirection.set(-1);
      dist = left - clientX;
    } else if (clientX > right) {
      overscrollDirection.set(1);
      dist = clientX - right;
    } else {
      overscrollDirection.set(0);
      dist = 0;
    }
    const elastic = 2 * (1 / (1 + Math.exp(-(dist / 50))) - 0.5) * 50;
    overscrollAmount.jump(elastic);
  });

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const { left, width } = trackRectRef.current;
      pointerX.set(e.clientX);
      const dir = overscrollDirection.get();
      const stretch = overscrollAmount.get();
      const x = dir > 0 ? width + stretch : dir < 0 ? 0 - stretch : e.clientX - left;
      hoverX.set(Math.max(0, Math.min(width, e.clientX - left)));

      const dur = duration.get();
      if (dur && width > 0) {
        const pct = Math.min(Math.max((x / width) * 100, 0), 100);
        hoverTime.set((pct / 100) * dur);
      }

      if (e.buttons > 0 && width > 0 && dur) {
        const clampedX = Math.min(Math.max(e.clientX, left), left + width) - left;
        onChange((clampedX / width) * dur);
      }
    },
    [
      duration,
      hoverTime,
      hoverX,
      onChange,
      overscrollAmount,
      overscrollDirection,
      pointerX,
    ]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        trackRectRef.current = {
          left: rect.left,
          right: rect.right,
          width: rect.width || 1,
        };
      }
      onScrubStart();
      handlePointerMove(e);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [handlePointerMove, onScrubStart]
  );

  const handlePointerUp = useCallback(() => {
    animate(overscrollAmount, 0, { type: "spring", bounce: 0.5 });
    onScrubEnd();
    overscrollDirection.set(0);
  }, [onScrubEnd, overscrollAmount, overscrollDirection]);

  const handlePointerLeave = useCallback(() => {
    animate(overscrollAmount, 0, { type: "spring", bounce: 0.5 });
    overscrollDirection.set(0);
  }, [overscrollAmount, overscrollDirection]);

  // GPU transforms for 100% hardware-accelerated animations
  const progressScaleX = useTransform(progressPercent, (pct) => pct / 100);
  const overscrollScaleX = useTransform(
    overscrollAmount,
    (val) => 1 + val / (trackRectRef.current.width || 300)
  );
  const overscrollOrigin = useTransform(overscrollDirection, (dir) =>
    dir < 0 ? "right center" : dir > 0 ? "left center" : "center"
  );

  return (
    <div className={cn("relative w-full select-none", className)}>
      {/* Interactive Scrubber Track Area */}
      <div className="relative flex h-8 items-center justify-center">
        <motion.div
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onHoverStart={() => {
            animate(scrubberScale, 1, { duration: 0.16 });
            animate(hoverOpacity, 1, { duration: 0.12 });
          }}
          onHoverEnd={() => {
            animate(scrubberScale, 0.85, { duration: 0.16 });
            animate(hoverOpacity, 0, { duration: 0.12 });
          }}
          style={{
            scale: scrubberScale,
            opacity: useTransform(scrubberScale, [0.85, 1], [0.85, 1]),
            transform: "translateZ(0)",
          }}
          className="relative flex h-14 w-full cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing will-change-transform"
        >
          <div
            ref={trackRef}
            className="absolute flex w-full flex-1 select-none items-center py-4"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <motion.div
              style={{
                scaleX: overscrollScaleX,
                scaleY: useTransform(overscrollAmount, [0, 50], [1, 0.82]),
                transformOrigin: overscrollOrigin,
                height: useTransform(scrubberScale, [0.85, 1], [7, 20]),
                transform: "translateZ(0)",
              }}
              className="flex grow will-change-transform"
            >
              {/* Background track */}
              <div className="relative h-full grow overflow-hidden rounded-full bg-white/20 backdrop-blur-sm shadow-inner">
                {/* Active progress fill via scaleX (Zero clip-path GPU churn!) */}
                <motion.div
                  style={{
                    backgroundColor: accentColor,
                    scaleX: progressScaleX,
                    transformOrigin: "left center",
                    transform: "translateZ(0)",
                  }}
                  className="absolute inset-0 h-full w-full rounded-full shadow-[0_0_14px_rgba(0,0,0,0.3)] will-change-transform"
                />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Hover Needle indicator with theme accent color */}
        <motion.div
          style={{
            opacity: hoverOpacity,
            x: hoverX,
            borderRightColor: accentColor,
            transform: "translateZ(0)",
          }}
          className="pointer-events-none absolute left-0 flex h-8 w-px items-center justify-center border-r will-change-transform"
        >
          <div className="absolute top-0 -translate-y-full pb-2">
            <HoverTimeBadge hoverTime={hoverTime} accentColor={accentColor} />
          </div>
        </motion.div>
      </div>
    </div>
  );
});

export interface CenterVideoControlsOverlayProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  accentColor?: string;
  isVisible?: boolean;
}

/**
 * Center On-Screen Video Controls (Telegram iOS style):
 * Circular Rewind 15s, Bouncy Center Play/Pause, and Circular Forward 15s in Liquid Glass style.
 * Clicking anywhere on the empty screen toggles play/pause.
 */
export const CenterVideoControlsOverlay = memo(function CenterVideoControlsOverlay({
  isPlaying,
  onTogglePlay,
  onSeek,
  isVisible = true,
}: CenterVideoControlsOverlayProps) {
  const t = useTranslation();
  return (
    <div
      onClick={(e) => {
        // Clicking on the empty screen pauses/plays the video
        e.stopPropagation();
        onTogglePlay();
      }}
      className={cn(
        "absolute inset-0 flex items-center justify-center transition-opacity duration-300 select-none z-20 cursor-pointer",
        isVisible
          ? "opacity-100 bg-black/20 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      )}
      aria-label={t("Управление видео")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex items-center justify-center gap-6 sm:gap-8 md:gap-9 transition-all duration-300",
          isVisible
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Rewind 15s Button (Telegram iOS style) */}
        <button
          type="button"
          onClick={() => onSeek(-15)}
          style={LIQUID_GLASS_STYLE}
          className="group relative flex size-13 sm:size-14 md:size-15 aspect-square shrink-0 items-center justify-center rounded-full border text-white transition-all duration-200 hover:border-white/20 hover:scale-108 active:scale-90 cursor-pointer shadow-xl select-none"
          title={t("Назад на 15 секунд")}
          aria-label={t("Назад на 15 секунд")}
        >
          <Rewind15Icon className="size-6 sm:size-7 text-white/90 group-hover:text-white transition-colors" />
        </button>

        {/* Center Play / Pause Button in Liquid Glass style */}
        <button
          type="button"
          onClick={onTogglePlay}
          style={LIQUID_GLASS_STYLE}
          className="relative flex size-16 sm:size-18 md:size-20 aspect-square shrink-0 items-center justify-center rounded-full border text-white transition-all duration-200 hover:border-white/25 hover:scale-108 active:scale-92 cursor-pointer shadow-2xl select-none"
          aria-label={isPlaying ? t("Пауза") : t("Воспроизведение")}
        >
          <motion.span
            key="pause"
            animate={{ scale: isPlaying ? 1 : 0, opacity: isPlaying ? 1 : 0 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.3 }}
            style={{ transformOrigin: "center" }}
            className="absolute flex size-8 md:size-9 items-center justify-center"
          >
            <Pause className="size-full fill-white text-white stroke-0 drop-shadow-md" />
          </motion.span>
          <motion.span
            key="play"
            animate={{ scale: isPlaying ? 0 : 1, opacity: isPlaying ? 0 : 1 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.3 }}
            style={{ transformOrigin: "center" }}
            className="absolute flex size-8 md:size-9 items-center justify-center ml-1"
          >
            <Play className="size-full fill-white text-white stroke-0 drop-shadow-md" />
          </motion.span>
        </button>

        {/* Forward 15s Button (Telegram iOS style) */}
        <button
          type="button"
          onClick={() => onSeek(15)}
          style={LIQUID_GLASS_STYLE}
          className="group relative flex size-13 sm:size-14 md:size-15 aspect-square shrink-0 items-center justify-center rounded-full border text-white transition-all duration-200 hover:border-white/20 hover:scale-108 active:scale-90 cursor-pointer shadow-xl select-none"
          title={t("Вперёд на 15 секунд")}
          aria-label={t("Вперёд на 15 секунд")}
        >
          <Forward15Icon className="size-6 sm:size-7 text-white/90 group-hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
});

/**
 * Backwards compatibility alias for CenterPlayPauseOverlay
 */
export const CenterPlayPauseOverlay = memo(function CenterPlayPauseOverlay({
  isPlaying,
  onToggle,
  onSeek,
  accentColor,
  isVisible = true,
}: {
  isPlaying: boolean;
  onToggle: () => void;
  onSeek?: (seconds: number) => void;
  accentColor?: string;
  isVisible?: boolean;
}) {
  const t = useTranslation();
  return (
    <CenterVideoControlsOverlay
      isPlaying={isPlaying}
      onTogglePlay={onToggle}
      onSeek={onSeek || (() => {})}
      accentColor={accentColor}
      isVisible={isVisible}
    />
  );
});

export interface Skiper91Props {
  src?: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  className?: string;
  videoClassName?: string;
  accentColor?: string;
  showControls?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  extraControls?: React.ReactNode;
}

export interface Skiper91Handle {
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (seconds: number) => void;
  toggleMute: () => void;
  requestFullscreen: () => void;
  getVideoElement: () => HTMLVideoElement | null;
}

/**
 * Skiper91 Video Player
 * High-performance, spacious video player with smooth elastic rubber-band scrubbing,
 * liquid glass center overlay controls (Rewind, Play/Pause, Forward),
 * 2-second auto-hide timeout, mouseleave hide, and empty screen click to pause.
 */
export const Skiper91 = forwardRef<HTMLVideoElement, Skiper91Props>(
  (
    {
      src = "/video/random/iphone.mp4",
      poster,
      autoPlay = true,
      muted: defaultMuted = false,
      loop = false,
      playsInline = true,
      className,
      videoClassName,
      accentColor = "var(--ui-accent-solid, #71717a)",
      showControls = true,
      onPlay,
      onPause,
      onEnded,
      onError,
      onTimeUpdate,
      extraControls,
    },
    forwardedRef
  ) => {
  const t = useTranslation();
    const innerVideoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(forwardedRef, () => innerVideoRef.current as HTMLVideoElement);

    const currentTimeMotion = useMotionValue(0);
    const durationMotion = useMotionValue(0);

    const isScrubbingRef = useRef(false);
    const wasPlayingBeforeScrubRef = useRef(false);

    // States that only change on user interaction (not on every frame!)
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(defaultMuted);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasError, setHasError] = useState(false);

    const controlsVisibleRef = useRef(true);
    const [controlsVisible, setControlsVisible] = useState(true);
    const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityTimeRef = useRef<number>(0);

    // Controls visibility handler: 2-second timeout of inactivity
    const showControlsTemporarily = useCallback(() => {
      const now = Date.now();
      if (now - lastActivityTimeRef.current < 150 && controlsVisibleRef.current) {
        if (hideControlsTimerRef.current) {
          clearTimeout(hideControlsTimerRef.current);
        }
        hideControlsTimerRef.current = setTimeout(() => {
          if (!isScrubbingRef.current) {
            controlsVisibleRef.current = false;
            setControlsVisible(false);
          }
        }, 2000);
        return;
      }
      lastActivityTimeRef.current = now;

      if (!controlsVisibleRef.current) {
        controlsVisibleRef.current = true;
        setControlsVisible(true);
      }

      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      hideControlsTimerRef.current = setTimeout(() => {
        if (!isScrubbingRef.current) {
          controlsVisibleRef.current = false;
          setControlsVisible(false);
        }
      }, 2000);
    }, []);

    // Immediately hide center buttons & controls when cursor leaves the player area
    const handleMouseLeave = useCallback(() => {
      if (isScrubbingRef.current) return;
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      controlsVisibleRef.current = false;
      setControlsVisible(false);
    }, []);

    // Frame synchronization purely via MotionValues (Zero React re-renders!)
    useEffect(() => {
      const video = innerVideoRef.current;
      if (!video) return;

      const handleLoadedMetadata = () => {
        const dur = video.duration || 0;
        durationMotion.set(dur);
        currentTimeMotion.set(video.currentTime || 0);
        setHasError(false);
      };

      const handleEnded = () => {
        currentTimeMotion.set(video.duration || 0);
        setIsPlaying(false);
        controlsVisibleRef.current = true;
        setControlsVisible(true);
        onEnded?.();
      };

      let rafId: number | null = null;
      let lastTime = -1;
      const step = () => {
        if (!isScrubbingRef.current && !video.paused) {
          const curr = video.currentTime;
          if (Math.abs(curr - lastTime) > 0.015) {
            lastTime = curr;
            currentTimeMotion.set(curr);
            onTimeUpdate?.(curr, video.duration || 0);
          }
        }
        rafId = requestAnimationFrame(step);
      };

      const handlePlay = () => {
        setIsPlaying(true);
        showControlsTemporarily();
        if (rafId === null) {
          rafId = requestAnimationFrame(step);
        }
        onPlay?.();
      };

      const handlePause = () => {
        setIsPlaying(false);
        showControlsTemporarily();
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (!isScrubbingRef.current) {
          currentTimeMotion.set(video.currentTime);
        }
        onPause?.();
      };

      const handleError = () => {
        setHasError(true);
        setIsPlaying(false);
        controlsVisibleRef.current = true;
        setControlsVisible(true);
        onError?.();
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("error", handleError);

      if (video.readyState >= 1) {
        handleLoadedMetadata();
      }
      if (!video.paused) {
        setIsPlaying(true);
        rafId = requestAnimationFrame(step);
      }

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("error", handleError);
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      };
    }, [
      currentTimeMotion,
      durationMotion,
      onEnded,
      onError,
      onPause,
      onPlay,
      onTimeUpdate,
      showControlsTemporarily,
    ]);

    // Fullscreen listener
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      };
    }, []);

    const playVideo = useCallback(async () => {
      const video = innerVideoRef.current;
      if (!video) return;
      if (video.currentTime >= video.duration) {
        video.currentTime = 0;
      }
      try {
        await video.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("Failed to play video:", err);
      }
    }, []);

    const pauseVideo = useCallback(() => {
      const video = innerVideoRef.current;
      if (!video) return;
      video.pause();
      setIsPlaying(false);
    }, []);

    const togglePlay = useCallback(() => {
      const video = innerVideoRef.current;
      if (!video) return;
      if (video.paused) {
        void playVideo();
      } else {
        pauseVideo();
      }
      showControlsTemporarily();
    }, [pauseVideo, playVideo, showControlsTemporarily]);

    const toggleMute = useCallback(() => {
      const video = innerVideoRef.current;
      if (!video) return;
      const nextMuted = !video.muted;
      video.muted = nextMuted;
      setIsMuted(nextMuted);
      showControlsTemporarily();
    }, [showControlsTemporarily]);

    const handleVolumeChange = useCallback((newVol: number) => {
      const video = innerVideoRef.current;
      if (!video) return;
      video.volume = newVol;
      setVolume(newVol);
      if (newVol > 0 && video.muted) {
        video.muted = false;
        setIsMuted(false);
      }
    }, []);

    const seekSeconds = useCallback(
      (delta: number) => {
        const video = innerVideoRef.current;
        if (!video) return;
        const dur = video.duration || 0;
        const nextTime = Math.max(0, Math.min(dur, video.currentTime + delta));
        video.currentTime = nextTime;
        currentTimeMotion.set(nextTime);
        showControlsTemporarily();
      },
      [currentTimeMotion, showControlsTemporarily]
    );

    const cyclePlaybackRate = useCallback(() => {
      const video = innerVideoRef.current;
      if (!video) return;
      const rates = [1, 1.25, 1.5, 2, 0.5];
      const currentIndex = rates.indexOf(playbackRate);
      const nextRate = rates[(currentIndex + 1) % rates.length];
      video.playbackRate = nextRate;
      setPlaybackRate(nextRate);
      showControlsTemporarily();
    }, [playbackRate, showControlsTemporarily]);

    const toggleFullscreen = useCallback(() => {
      const target = containerRef.current || innerVideoRef.current;
      if (!target) return;
      if (!document.fullscreenElement) {
        void target.requestFullscreen().catch(() => undefined);
      } else {
        void document.exitFullscreen().catch(() => undefined);
      }
    }, []);

    // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        if (e.code === "Space" || e.code === "KeyK") {
          e.preventDefault();
          togglePlay();
        } else if (e.code === "ArrowLeft" || e.code === "KeyJ") {
          e.preventDefault();
          seekSeconds(-15);
        } else if (e.code === "ArrowRight" || e.code === "KeyL") {
          e.preventDefault();
          seekSeconds(15);
        } else if (e.code === "KeyM") {
          e.preventDefault();
          toggleMute();
        } else if (e.code === "KeyF") {
          e.preventDefault();
          toggleFullscreen();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [seekSeconds, toggleFullscreen, toggleMute, togglePlay]);

    return (
      <div
        ref={containerRef}
        onMouseMove={showControlsTemporarily}
        onMouseLeave={handleMouseLeave}
        onTouchStart={showControlsTemporarily}
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden select-none p-0 md:p-6",
          className
        )}
      >
        <div className="relative flex flex-col items-center justify-center w-full h-full md:w-auto md:h-auto max-w-full max-h-full">
          {/* 1. Video Card with Exact Dead-Center Controls */}
          <div
            className="relative flex items-center justify-center w-full h-full md:w-auto md:h-auto max-w-full max-h-full overflow-hidden shadow-2xl group cursor-pointer rounded-2xl md:rounded-3xl"
            onDoubleClick={toggleFullscreen}
          >
            {hasError ? (
              <div className="flex h-[320px] w-full max-w-md flex-col items-center justify-center gap-3 rounded-3xl bg-black/60 backdrop-blur-md text-sm text-zinc-300 p-6 text-center border border-white/10 shadow-2xl">
                <span className="font-medium">
                  {t("Видео недоступно или формат не поддерживается")}</span>
              </div>
            ) : (
              <>
                <video
                  ref={innerVideoRef}
                  src={src}
                  poster={poster}
                  autoPlay={autoPlay}
                  muted={defaultMuted}
                  loop={loop}
                  playsInline={playsInline}
                  preload="metadata"
                  className={cn(
                    "w-full h-full max-h-[calc(100dvh-180px)] max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-32px)] md:max-h-[calc(100dvh-190px)] md:max-w-[min(90vw,1200px)] object-contain transition-all rounded-2xl md:rounded-3xl shadow-2xl",
                    videoClassName
                  )}
                />

                {/* Liquid Glass Center On-Screen Controls: Exact dead center */}
                <CenterVideoControlsOverlay
                  isPlaying={isPlaying}
                  onTogglePlay={togglePlay}
                  onSeek={seekSeconds}
                  accentColor={accentColor}
                  isVisible={controlsVisible}
                />
              </>
            )}
          </div>

          {/* 2. Skiper91 Floating Bottom Dock (Telegram iOS style) */}
          {showControls && !hasError ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "fixed bottom-0 inset-x-0 z-30 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 px-3 sm:px-4 pointer-events-auto",
                "md:fixed md:bottom-6 md:inset-x-0 md:z-30 md:pb-0 md:pt-0 md:px-0 md:w-full md:max-w-[min(100%,680px)] md:mx-auto",
                "flex flex-col items-center gap-2.5 transition-opacity duration-300",
                controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {/* 1. Telegram iOS Scrubber Capsule Pill: [ 0:20 ]  ======o======  [ 0:31 ] */}
              <div
                style={LIQUID_GLASS_STYLE}
                className="w-full max-w-[min(100%,640px)] rounded-full px-4 sm:px-5 py-1.5 sm:py-2 border shadow-xl flex items-center gap-3 select-none"
              >
                <SingleTimeDisplay time={currentTimeMotion} className="text-white/90 font-medium" />
                <SkiperScrubber
                  currentTime={currentTimeMotion}
                  duration={durationMotion}
                  accentColor={accentColor}
                  onScrubStart={() => {
                    const video = innerVideoRef.current;
                    if (!video) return;
                    isScrubbingRef.current = true;
                    wasPlayingBeforeScrubRef.current = !video.paused;
                    video.pause();
                    showControlsTemporarily();
                  }}
                  onChange={(newTime) => {
                    const video = innerVideoRef.current;
                    if (!video) return;
                    const dur = durationMotion.get() || 0;
                    const clamped = Math.min(Math.max(newTime, 0), dur);
                    video.currentTime = clamped;
                    currentTimeMotion.set(clamped);
                    showControlsTemporarily();
                  }}
                  onScrubEnd={() => {
                    isScrubbingRef.current = false;
                    if (wasPlayingBeforeScrubRef.current) {
                      void playVideo();
                    }
                    showControlsTemporarily();
                  }}
                  className="flex-1"
                />
                <SingleTimeDisplay time={durationMotion} className="text-white/60 font-medium" />
              </div>

              {/* 2. Centered Action Buttons Row: [ Volume ]  [ 1X ]  [ Fullscreen ] */}
              <div className="flex items-center justify-center gap-3 sm:gap-4 text-white w-full">
                {/* Volume / Mute Button */}
                <div className="relative flex items-center group/vol shrink-0">
                  <button
                    type="button"
                    onClick={toggleMute}
                    style={LIQUID_GLASS_STYLE}
                    className="flex size-10 md:size-11 items-center justify-center rounded-full border text-white/80 hover:text-white hover:border-white/20 active:scale-95 transition-all cursor-pointer select-none shadow-lg"
                    aria-label={isMuted ? t("Включить звук") : t("Выключить звук")}
                  >
                    {isMuted ? (
                      <VolumeX className="size-5" />
                    ) : (
                      <Volume2 className="size-5" />
                    )}
                  </button>
                  {/* Desktop Hover Volume Slider */}
                  <div className="hidden md:flex w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200 items-center pl-1.5 shrink-0">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="h-1.5 w-18 accent-[var(--ui-accent-solid,#71717a)] cursor-pointer"
                      aria-label={t("Громкость")}
                    />
                  </div>
                </div>

                {/* Speed Selector (0.5x, 1x, 1.25x, 1.5x, 2x) */}
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  style={LIQUID_GLASS_STYLE}
                  className="flex h-10 md:h-11 px-4 items-center justify-center rounded-full border text-xs md:text-sm font-semibold text-white/90 hover:text-white hover:border-white/20 active:scale-95 transition-all cursor-pointer select-none tabular-nums shrink-0 shadow-lg"
                  title={t("Скорость воспроизведения")}
                  aria-label={t("Скорость {0}x", { 0: playbackRate })}
                >
                  {playbackRate}X
                </button>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  style={LIQUID_GLASS_STYLE}
                  className="flex size-10 md:size-11 items-center justify-center rounded-full border text-white/80 hover:text-white hover:border-white/20 active:scale-95 transition-all cursor-pointer select-none shrink-0 shadow-lg"
                  title={isFullscreen ? t("Обычный экран") : t("Во весь экран")}
                  aria-label={isFullscreen ? t("Выйти из полноэкранного режима") : t("Во весь экран")}
                >
                  {isFullscreen ? (
                    <Minimize className="size-5" />
                  ) : (
                    <Maximize className="size-5" />
                  )}
                </button>

                {extraControls}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);

Skiper91.displayName = "Skiper91";

export default Skiper91;
