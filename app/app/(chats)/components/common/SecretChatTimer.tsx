"use client";

import { useState, type CSSProperties } from "react";
import { Dialog } from "radix-ui";
import { useTranslation } from "@/components/LocaleProvider";
import { CountdownTimer } from "@/components/CountdownTimer";
import { SecretKeyVerification } from "./SecretKeyVerification";

export function SecretChatTimer({ chatId, ownKey, peerKey, transparentVisual, initialExpiresAt, onExpired, style }: {
  chatId: string; ownKey?: string; peerKey?: string; transparentVisual?: boolean;
  initialExpiresAt?: string | null; onExpired?: () => void; style?: CSSProperties;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" aria-label={t("Таймер секретного чата: открыть код защиты")} title={t("Сравнить код защиты")}
      className="cursor-pointer rounded-full border-0 bg-transparent p-0 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60">
      <CountdownTimer chatId={chatId} initialExpiresAt={initialExpiresAt} onExpired={onExpired} style={style} />
    </button></Dialog.Trigger>
    <SecretKeyVerification open={open} onClose={() => setOpen(false)} chatId={chatId} ownKey={ownKey} peerKey={peerKey} initialExpiresAt={initialExpiresAt} transparentVisual={transparentVisual} />
  </Dialog.Root>;
}
