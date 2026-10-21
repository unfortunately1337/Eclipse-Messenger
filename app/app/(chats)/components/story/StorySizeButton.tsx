"use client";

import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export function StorySizeButton({ delta, onStep }: { delta: number; onStep: (delta: number) => void }) {
  const t = useTranslation();
  const action = useRef(onStep);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => { action.current = onStep; }, [onStep]);
  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    window.addEventListener("blur", stop);
    return () => { stop(); window.removeEventListener("blur", stop); };
  }, [stop]);
  const label = delta < 0 ? t("Уменьшить текст") : t("Увеличить текст");
  return <button type="button" aria-label={label} title={label}
    className="flex h-10 w-10 touch-none select-none items-center justify-center text-[15px] font-bold text-zinc-200 transition-transform hover:text-white active:scale-95 cursor-pointer"
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); stop();
      event.currentTarget.setPointerCapture(event.pointerId);
      action.current(delta);
      const repeat = () => { action.current(delta); timer.current = setTimeout(repeat, 65); };
      timer.current = setTimeout(repeat, 280);
    }}
    onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
    onClick={event => { if (event.detail === 0) action.current(delta); }}
  >{delta < 0 ? "A−" : "A+"}</button>;
}
