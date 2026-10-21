"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { PANEL_EASE } from "@/lib/client/panel-motion";
import { secretSafetyCode } from "@/lib/client/secret-device-keys";
import { getPanelVisualStyle } from "@/lib/client/panel-visual";

export function SecretKeyVerification({ chatId, ownKey, peerKey, transparentVisual = true }: { chatId: string; ownKey: string; peerKey: string; transparentVisual?: boolean }) {
  const t = useTranslation();
  const [code, setCode] = useState("");
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    let cancelled = false;
    setCode("");
    setExpanded(false);
    void secretSafetyCode(chatId, [ownKey, peerKey]).then(value => { if (!cancelled) setCode(value); });
    return () => { cancelled = true; };
  }, [chatId, ownKey, peerKey]);
  return (
    <div style={getPanelVisualStyle(transparentVisual)} className="max-w-[320px] rounded-2xl border px-3 py-1.5 text-center text-xs text-white">
      <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}
        className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60">
        <ChevronRight size={13} aria-hidden className="shrink-0 transition-transform duration-200 motion-reduce:transition-none" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} />
        {t("Сравнить код защиты")}</button>
      <motion.div id={contentId} initial={false} animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, ease: PANEL_EASE }}
        aria-hidden={!expanded} inert={!expanded} className="overflow-hidden">
        <p className="pt-2 select-text break-words font-mono leading-5">{code || t("Вычисляем код…")}</p>
        <p className="pt-2 text-white/70">{t("Сравните код с собеседником лично или по другому доверенному каналу. Он должен совпадать целиком. При несовпадении создайте новый чат.")}</p>
      </motion.div>
    </div>
  );
}
