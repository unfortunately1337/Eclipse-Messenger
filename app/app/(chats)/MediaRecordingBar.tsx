"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useMemo, type MutableRefObject } from "react";
import { useVoiceWaveformLevels } from "@/lib/client/voice-waveform";

export function RecordingCancelButton({ onCancel }: { onCancel: () => void }) {
  const t = useTranslation();
  return <button type="button" aria-label={t("Отменить запись")}
    onPointerDown={event => { event.stopPropagation(); event.preventDefault(); }}
    onClick={event => { event.stopPropagation(); event.preventDefault(); onCancel(); }}
    className="pointer-events-auto cursor-pointer px-3 py-1 text-[13.5px] font-medium text-red-400 transition-[color,opacity,transform] hover:text-red-300 hover:opacity-90 active:scale-95 focus:outline-none sm:text-[14px]">
    {t("Отмена")}</button>;
}

export function formatRecordingTimer(durationMs: number) {
  const safeDuration = Math.max(0, Math.floor(durationMs));
  const totalSeconds = Math.floor(safeDuration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((safeDuration % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(centiseconds).padStart(2, "0")}`;
}

type MediaRecordingBarProps = {
  stream: MediaStream | null;
  active: boolean;
  durationMs: number;
  captureSamplesRef?: MutableRefObject<number[]>;
  onCancel: () => void;
};

export function MediaRecordingBar({ stream, active, durationMs, captureSamplesRef, onCancel }: MediaRecordingBarProps) {
  const t = useTranslation();
  const levels = useVoiceWaveformLevels(stream, active, { captureSamplesRef });

  // Recent microphone amplitude samples, shared with the saved voice waveform.
  const miniBars = useMemo(() => {
    if (!levels || levels.length === 0) return [0, 0, 0, 0];
    const len = levels.length;
    const s1 = levels[Math.max(0, len - 4)] ?? 0;
    const s2 = levels[Math.max(0, len - 3)] ?? 0;
    const s3 = levels[Math.max(0, len - 2)] ?? 0;
    const s4 = levels[Math.max(0, len - 1)] ?? 0;
    return [s1, s2, s3, s4];
  }, [levels]);

  return (
    <div className="relative flex w-full min-w-0 items-center justify-between select-none">
      {/* Left: Tiny Red Live Waveform Indicator + Monospace Timer */}
      <div className="flex items-center gap-2 shrink-0 z-10">
        {/* Red live mini waveform bars */}
        <div data-recording-live-waveform className="flex items-center gap-[2.5px] h-4 shrink-0 px-0.5" aria-hidden="true">
          {miniBars.map((level, idx) => {
            const h = 2 + Math.round(Math.min(1, Math.max(0, level)) * 14);
            return (
              <span
                key={idx}
                className="w-[2.5px] rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] transition-[height] duration-75 ease-out"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>

        {/* Timer: minutes : seconds , milliseconds */}
        <span className="font-mono tabular-nums text-[13px] sm:text-[13.5px] font-semibold tracking-tight text-white/95">
          {formatRecordingTimer(durationMs)}
        </span>
      </div>

      {/* Center: Cancel text button positioned in the exact middle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden items-center justify-center pointer-events-auto z-10 md:flex">
        <RecordingCancelButton onCancel={onCancel} />
      </div>

      {/* Right spacer */}
      <div className="shrink-0 w-8" />
    </div>
  );
}
