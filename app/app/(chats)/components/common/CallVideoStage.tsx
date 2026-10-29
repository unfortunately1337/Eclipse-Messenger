"use client";

import type { ReactNode } from "react";
import { MonitorUp } from "lucide-react";
import { useTranslation } from "@/components/LocaleProvider";

export default function CallVideoStage({ children, screen, label, localScreen = false }: { children: ReactNode; screen?: boolean; label?: string; localScreen?: boolean }) {
  const t = useTranslation();
  return <div data-call-video-stage data-local-screen={localScreen || undefined} className="call-video-stage relative h-full w-full bg-black/40" style={screen ? { backgroundColor: "#000" } : undefined}>
    {children}
    {screen && <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center gap-2">
      <span className="flex min-w-0 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur-md"><MonitorUp size={14} className="shrink-0" /><span className="truncate">{localScreen ? t("Вы демонстрируете свой экран") : label}</span></span>
    </div>}
  </div>;
}
