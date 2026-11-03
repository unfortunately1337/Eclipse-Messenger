"use client";

import { translate as t } from "@/lib/i18n/translate";
import React, { memo, useEffect, useRef } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";
import { fetchStickerAnimationData } from "@/lib/client/stickers";
import { useAnimationVisibility } from "@/lib/client/use-animation-visibility";
import { scheduleAnimationMount } from "@/lib/client/animation-mount-queue";

let pendingPlayer: Promise<LottiePlayer> | null = null;
function ensureLottieScript(): Promise<LottiePlayer> {
  const host = window as unknown as { lottie?: LottiePlayer };
  if (host.lottie) return Promise.resolve(host.lottie);
  if (pendingPlayer) return pendingPlayer;
  pendingPlayer = (async () => {
    const playerModule = await import("lottie-web");
    host.lottie = playerModule.default;
    if (!host.lottie) throw new Error(t("Lottie не инициализирован"));
    return host.lottie;
  })().finally(() => { pendingPlayer = null; });
  return pendingPlayer;
}

export async function preloadLottieSticker(src: string): Promise<void> {
  await Promise.all([ensureLottieScript(), fetchStickerAnimationData(src)]);
}

export const LottieSticker = memo(function LottieSticker({ src, className, renderer = "svg", playing = true, deferUntilPlaying = false, style }: { src: string; className?: string; renderer?: "svg" | "canvas"; playing?: boolean; deferUntilPlaying?: boolean; style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const visible = useAnimationVisibility(containerRef);

  useEffect(() => () => {
    animationRef.current?.destroy();
    animationRef.current = null;
  }, [src, renderer]);

  useEffect(() => {
    if (animationRef.current) {
      if (visible && playing) animationRef.current.play();
      else animationRef.current.pause();
      return;
    }
    // Keep an initialized renderer paused instead of rebuilding it after every
    // scroll. Picker previews can defer the first load until they actually play.
    if (!visible || (deferUntilPlaying && !playing)) return;
    let cancelled = false;
    let cancelMount: (() => void) | undefined;
    void Promise.all([ensureLottieScript(), fetchStickerAnimationData(src)]).then(([lottie, animationData]) => {
      if (cancelled || !containerRef.current) return;
      cancelMount = scheduleAnimationMount(() => {
      if (cancelled || !containerRef.current) return;
      try { animationRef.current = lottie.loadAnimation({
        container: containerRef.current, renderer, loop: true, autoplay: playing, animationData,
        ...(renderer === "canvas" ? { rendererSettings: { dpr: Math.min(window.devicePixelRatio || 1, 2) } } : {}),
      }); } catch { /* Keep the thumbnail if a pack contains unsupported vector data. */ }
      });
    }).catch(() => { /* An unavailable sticker must not interrupt the chat. */ });
    return () => { cancelled = true; cancelMount?.(); };
  }, [src, visible, renderer, playing, deferUntilPlaying]);

  return <div ref={containerRef} className={className} style={style} />;
});
