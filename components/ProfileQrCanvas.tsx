"use client";

import { useCallback } from "react";
import { StyledQrCode } from "./StyledQrCode";
import { showAppToast } from "@/lib/client/app-toast";
import { useTranslation } from "./LocaleProvider";

/** Own the drawing lifecycle, including screens restored during a reverse transition. */
export function ProfileQrCanvas({ url, onReady }: { url: string; onReady: (canvas: HTMLCanvasElement, url: string) => void }) {
  const t = useTranslation();
  const onError = useCallback(() => showAppToast({ title: t("Не удалось создать QR-код"), type: "error" }), [t]);
  return <StyledQrCode value={url} label={t("QR-код профиля")} onReady={onReady} onError={onError} />;
}
