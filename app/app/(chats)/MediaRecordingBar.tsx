"use client";
import { useTranslation } from "@/components/LocaleProvider";
import { useCallback, type MutableRefObject } from "react";
import { useVoiceRecordingAmplitude } from "@/lib/client/voice-waveform";
import { CallVoiceWaves } from "./components/common/CallVoiceWaves";

export function RecordingCancelButton({ onCancel }: { onCancel: () => void }) {
  const t = useTranslation();
  return <button type="button" aria-label={t("Отменить запись")}
    onPointerDown={event => { event.stopPropagation(); event.preventDefault(); }}
    onClick={event => { event.stopPropagation(); event.preventDefault(); onCancel(); }}
    className="pointer-events-auto cursor-pointer px-3 py-1 text-[13.5px] font-medium text-[color:var(--ui-accent-solid,#fff)] transition-[color,opacity,transform] hover:opacity-80 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:text-[14px]">
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
  const amplitudeRef = useVoiceRecordingAmplitude(stream, active, { captureSamplesRef });
  const readLevels = useCallback(() => ({ local: amplitudeRef.current * 0.3, remote: 0 }), [amplitudeRef]);

  return (
    <div data-media-recording-bar className="relative isolate flex h-full w-full min-w-0 items-center justify-between overflow-hidden rounded-full px-3 select-none md:px-3.5">
      <CallVoiceWaves readLevels={readLevels} />
      <div className="relative z-10 flex shrink-0 items-center">
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
