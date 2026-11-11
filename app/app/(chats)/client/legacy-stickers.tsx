"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { useEffect, useRef } from "react";
import { fetchStickerAnimationData } from "@/lib/client/stickers";
import { type LottiePlayerApi } from "../types";

declare global {
  interface Window {
    lottie?: LottiePlayerApi;
  }
}

export async function ensureLottieScript() {
  if (window.lottie) return window.lottie;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(t("Не удалось загрузить Lottie")));
    document.head.appendChild(script);
  });

  if (!window.lottie) {
    throw new Error(t("Lottie не инициализирован"));
  }
  return window.lottie;
}

export function LottieSticker({ src, className }: { src: string; className?: string }) {
  const t = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let animation: { destroy: () => void } | null = null;

    async function mountAnimation() {
      try {
        const [lottie, animationData] = await Promise.all([ensureLottieScript(), fetchStickerAnimationData(src)]);
        if (!mounted || !containerRef.current || !animationData) return;
        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData,
        });
      } catch {
        // no-op
      }
    }

    void mountAnimation();
    return () => {
      mounted = false;
      animation?.destroy();
    };
  }, [src]);

  return <div ref={containerRef} className={className} />;
}
