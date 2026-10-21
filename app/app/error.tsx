"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import { loadLottiePlayer } from "@/lib/client/lottie-player";
import { Button } from "@/components/ui/button";
import animationData from "@/app/app/assets/puga_crying.json";
import { isChunkLoadError } from "@/lib/client/chunk-load-error";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslation();
  const animationRef = useRef<HTMLDivElement | null>(null);
  const staleChunk = isChunkLoadError(error);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("App error boundary:", error);
  }, [error]);

  useEffect(() => {
    if (!animationRef.current) return;
    let cancelled = false;
    let instance: AnimationItem | undefined;
    void loadLottiePlayer().then(lottie => {
      if (cancelled || !lottie || !animationRef.current) return;
      instance = lottie.loadAnimation({
        container: animationRef.current, animationData, renderer: "svg", loop: true, autoplay: true,
      });
    }).catch(() => { /* The error screen must work without its animation. */ });
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 text-center">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center">
          <div ref={animationRef} className="h-44 w-44" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{staleChunk ? t("Приложение обновилось") : t("Не удалось загрузить мессенджер")}</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {staleChunk ? t("Обновите страницу, чтобы загрузить текущую версию приложения.") : t("Попробуйте ещё раз или обновите страницу.")}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" onClick={staleChunk ? () => window.location.reload() : reset} className="h-9 px-4">
            {staleChunk ? t("Обновить страницу") : t("Повторить")}
          </Button>
          {!staleChunk && <Button
            type="button"
            variant="outline"
            className="h-9 px-4"
            onClick={() => window.location.reload()}
          >
            {t("Обновить страницу")}</Button>}
        </div>
        {error?.message ? (
          <p className="mt-3 text-xs text-zinc-400 break-words">{error.message}</p>
        ) : null}
      </div>
    </div>
  );
}
