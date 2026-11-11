"use client";

import { useEffect, useRef, useState } from "react";
import { useIsPresent } from "framer-motion";
import { drawQrCode } from "@/lib/client/qr-code";

/** The same readable, connected QR geometry for profiles, login and authenticator setup. */
export function StyledQrCode({ value, fallbackUrl, label, size, className = "", onReady, onError }: {
  value: string;
  fallbackUrl?: string | null;
  label: string;
  size?: number;
  className?: string;
  onReady?: (canvas: HTMLCanvasElement, value: string) => void;
  onError?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const present = useIsPresent();
  const [failedValue, setFailedValue] = useState<string | null>(null);
  const sourceIsImage = value.startsWith("data:image/");
  const fallback = sourceIsImage ? value : fallbackUrl;
  const useFallback = Boolean(fallback && (sourceIsImage || failedValue === value));

  useEffect(() => {
    const canvas = ref.current;
    if (!present || !canvas || !value || useFallback) return;
    let alive = true;
    void drawQrCode(canvas, value).then(() => {
      if (alive) onReady?.(canvas, value);
    }).catch(() => {
      if (!alive) return;
      setFailedValue(value);
      onError?.();
    });
    return () => { alive = false; };
  }, [value, present, useFallback, onReady, onError]);

  const style = size ? { width: size, height: size, maxWidth: "100%" } : undefined;
  const classes = `block aspect-square rounded-[24px] bg-white ${size ? "" : "w-full"} ${className}`;
  return useFallback ? <img src={fallback!} alt={label} style={style} className={classes} />
    : <canvas ref={ref} data-qr-code role="img" aria-label={label} style={style} className={classes} />;
}
