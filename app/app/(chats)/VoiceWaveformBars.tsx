"use client";

import { useEffect, useMemo, useState } from "react";
import { VOICE_WAVEFORM_BASE_HEIGHTS } from "@/lib/client/voice-waveform";
import { cn } from "@/lib/utils";

type VoiceWaveformBarsProps = {
  progress?: number;
  playing?: boolean;
  live?: boolean;
  levels?: number[] | null;
  recordedLevels?: number[] | null;
  activeBarClass: string;
  inactiveBarClass: string;
  className?: string;
  displayBarCount?: number;
  barWidthClass?: string;
  gapClass?: string;
  maxBarHeight?: number;
};

function barHeightFromLevel(level: number, maxHeight = 18) {
  if (level <= 0.03) {
    return 2.5; // Tiny dot when quiet/silent like in Telegram
  }
  return Math.max(2.5, Math.min(maxHeight, Math.round(2.5 + level * (maxHeight - 2.5))));
}

function resolveLevel(levels: number[] | null | undefined, index: number, displayCount: number) {
  if (!levels?.length) return null;
  const sourceIndex = Math.floor((index / Math.max(1, displayCount - 1)) * (levels.length - 1));
  return levels[sourceIndex] ?? levels[levels.length - 1] ?? null;
}

function resolveBaseLevel(index: number, displayCount: number) {
  const sourceIndex = Math.floor((index / Math.max(1, displayCount - 1)) * (VOICE_WAVEFORM_BASE_HEIGHTS.length - 1));
  const base = VOICE_WAVEFORM_BASE_HEIGHTS[sourceIndex % VOICE_WAVEFORM_BASE_HEIGHTS.length];
  return Math.min(1, Math.max(0.04, base / 15));
}

export function VoiceWaveformBars({
  progress = 0,
  playing = false,
  live = false,
  levels = null,
  recordedLevels = null,
  activeBarClass,
  inactiveBarClass,
  className,
  displayBarCount = 40,
  barWidthClass = "w-[2px]",
  gapClass = "gap-[2px]",
  maxBarHeight = 20,
}: VoiceWaveformBarsProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (levels || live || recordedLevels || !playing) return;
    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 70);
    return () => window.clearInterval(interval);
  }, [levels, live, playing, recordedLevels]);

  const bars = useMemo(() => {
    const activeBars = Math.max(
      0,
      Math.min(displayBarCount, Math.round((progress / 100) * displayBarCount)),
    );

    return Array.from({ length: displayBarCount }, (_, index) => {
      const recordedLevel = resolveLevel(recordedLevels, index, displayBarCount);
      const liveLevel = resolveLevel(levels, index, displayBarCount);

      let level: number;
      if (live) {
        level = liveLevel ?? 0;
      } else if (recordedLevels && recordedLevels.length > 0) {
        level = recordedLevel ?? 0;
      } else if (playing) {
        level = 0.2 + 0.8 * Math.abs(Math.sin(tick * 0.42 + index * 0.68));
      } else {
        level = resolveBaseLevel(index, displayBarCount);
      }

      const height = barHeightFromLevel(level, live ? Math.min(18, maxBarHeight) : maxBarHeight);
      const isActive = live ? true : index < activeBars;

      return { height, isActive };
    });
  }, [displayBarCount, levels, live, maxBarHeight, playing, progress, recordedLevels, tick]);

  return (
    <div className={cn("flex w-full items-center", gapClass, className)}>
      {bars.map((bar, index) => (
        <span
          key={index}
          className={cn(
            barWidthClass,
            "rounded-full transition-[height,background-color] duration-75 ease-out",
            bar.isActive ? activeBarClass : inactiveBarClass,
          )}
          style={{ height: `${bar.height}px`, minHeight: "2.5px" }}
        />
      ))}
    </div>
  );
}
