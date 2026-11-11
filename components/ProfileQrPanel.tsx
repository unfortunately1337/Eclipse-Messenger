"use client";

import { lazy, Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/components/LocaleProvider";
import type { ProfileQrPanelProps } from "./ProfileQrPanelContent";

const loadPanel = () => import("./ProfileQrPanelContent");
const Content = lazy(loadPanel);
export function preloadProfileQrPanel() { void loadPanel().catch(() => {}); }

function Loading({ onBack, onClose }: ProfileQrPanelProps) {
  const t = useTranslation();
  return <div className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-[#191b1d] text-white">
    <header className="flex h-16 shrink-0 items-center px-4">
      <button type="button" onClick={onBack || onClose} aria-label={t("Назад")} className="grid size-11 cursor-pointer place-items-center rounded-full bg-transparent text-white/90 focus-visible:outline-2 focus-visible:outline-white/60"><ArrowLeft size={22} /></button>
    </header>
    <div className="grid flex-1 place-items-center" role="status" aria-label={t("Загрузка...")}><Spinner className="size-5 text-white/50" /></div>
  </div>;
}

/** Optional QR drawing/export UI stays out of the initial chat/profile bundle. */
export default function ProfileQrPanel(props: ProfileQrPanelProps) {
  return <Suspense fallback={<Loading {...props} />}><Content {...props} /></Suspense>;
}
