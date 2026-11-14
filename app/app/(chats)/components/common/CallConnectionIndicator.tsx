"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "@/components/LocaleProvider";
import { callControlSurface } from "@/lib/client/call-window-style";
import type { CallSignal } from "@/lib/client/call-connection-quality";

export function CallConnectionIndicator({ signal = { bars: 0, state: "unknown" }, glass }: { signal?: CallSignal; glass: boolean }) {
  const t = useTranslation(), reduced = useReducedMotion();
  const label = t(signal.state === "reconnecting" ? "Восстанавливаем соединение…" : signal.state === "lost" ? "Соединение потеряно" : signal.state === "poor" ? "Слабое соединение" : signal.state === "unknown" ? "Оцениваем качество соединения" : signal.bars === 4 ? "Отличное соединение" : "Хорошее соединение");
  return <div role="img" aria-label={label} title={label} data-call-signal={signal.state} className={`${callControlSurface(glass)} size-8 min-[360px]:size-10`}>
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>{[5, 8, 11, 14].map((height, index) => <motion.rect key={height} x={3 + index * 5} y={19 - height} width="3" height={height} rx="1.5" initial={false} animate={{ opacity: index < signal.bars ? 1 : .22, fill: signal.state === "poor" || signal.state === "reconnecting" ? "#fbbf24" : signal.state === "lost" ? "#f87171" : signal.state === "good" ? "#a7f3d0" : "#d4d4d8" }} transition={{ duration: reduced ? 0 : .22 }} />)}</svg>
  </div>;
}
