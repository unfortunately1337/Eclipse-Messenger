import React, { useEffect, useState, useRef, CSSProperties } from "react";

interface CountdownTimerProps {
  chatId: string;
  initialExpiresAt?: string | null;
  onExpired?: () => void;
  style?: CSSProperties;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  chatId,
  initialExpiresAt,
  onExpired,
  style,
  className,
}) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    if (!initialExpiresAt) {
      setTimeLeftMs(null);
      return;
    }

    const expiresAtMs = new Date(initialExpiresAt).getTime();
    if (isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
      setTimeLeftMs(0);
      onExpiredRef.current?.();
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    const tick = () => {
      const remaining = expiresAtMs - Date.now();
      if (remaining <= 0) {
        setTimeLeftMs(0);
        clearInterval(intervalId);
        onExpiredRef.current?.();
      } else {
        setTimeLeftMs(remaining);
      }
    };

    tick();
    intervalId = setInterval(tick, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [initialExpiresAt]);

  const pad = (val: number) => String(val).padStart(2, "0");

  let label: string;
  if (timeLeftMs === null) {
    label = "00:00:00";
  } else if (timeLeftMs <= 0) {
    label = "00:00:00";
  } else {
    const totalSeconds = Math.floor(timeLeftMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    label = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  const isCritical = timeLeftMs !== null && timeLeftMs > 0 && timeLeftMs <= 10000;

  return (
    <div
      className={`flex h-7 items-center justify-center rounded-full px-3.5 font-mono text-[11px] font-semibold tracking-widest select-none tabular-nums ${
        isCritical
          ? "text-red-400 bg-red-950/60 border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse"
          : "text-white/90"
      } ${timeLeftMs === null ? "opacity-60 animate-pulse" : ""} ${className ?? ""}`}
      style={style}
    >
      {label}
    </div>
  );
};
