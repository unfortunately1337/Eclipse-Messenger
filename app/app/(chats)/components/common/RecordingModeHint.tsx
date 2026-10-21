"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getPanelVisualStyle } from "@/lib/client/panel-visual";

export function RecordingModeHint({ mode, until, transparent }: {
  mode: "voice" | "video";
  until: number;
  transparent: boolean;
}) {
  const t = useTranslation();
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    const remaining = until - Date.now();
    setVisible(remaining > 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [until]);

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={mode}
          role="status"
          aria-live="polite"
          data-recording-mode-hint
          className="app-panel-surface pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-50 whitespace-nowrap rounded-[14px] border px-3 py-2 text-[11.5px] leading-[16px] text-zinc-100"
          style={getPanelVisualStyle(transparent)}
          initial={{ opacity: 0, y: 5, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 3, scale: 0.97 }}
          transition={{ duration: reduced ? 0 : 0.16, ease: "easeOut" }}
        >
          <span className="block font-medium">{mode === "video" ? t("Видео") : t("Звук")} {t(" — удерживайте.")}</span>
          <span className="block text-zinc-400">{mode === "video" ? t("Звук") : t("Видео")} {t(" — нажмите.")}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
