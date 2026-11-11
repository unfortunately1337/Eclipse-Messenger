"use client";

import { useTranslation } from "@/components/LocaleProvider";
import { showAppToast } from "@/lib/client/app-toast";
import { exportProfileQr, PROFILE_QR_BACKGROUNDS, profileQrBackground, profileQrUrl } from "@/lib/client/profile-qr";
import { ProfileQrCanvas } from "./ProfileQrCanvas";
import { PanelNavigation } from "@/app/app/(chats)/components/common/PanelNavigation";
import { PANEL_SUBVIEW_VARIANTS } from "@/lib/client/panel-motion";
import dynamic from "next/dynamic";
import { ArrowLeft, Download, Palette, Share2, ScanLine } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

const ProfileQrScanner = dynamic(() => import("./ProfileQrScanner"), { ssr: false });
export interface ProfileQrPanelProps {
  selfProfile?: { displayName?: string | null; link?: string | null; avatarUrl?: string | null; id?: string } | null;
  displayName?: string | null;
  link?: string | null;
  avatarUrl?: string | null;
  title?: string;
  kind?: "group" | "channel";
  onBack?: () => void;
  onClose?: () => void;
}

export default function ProfileQrPanel({ selfProfile, displayName: name, link, kind, onBack, onClose }: ProfileQrPanelProps) {
  const t = useTranslation();
  const reduced = useReducedMotion();
  const busyRef = useRef(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [code, setCode] = useState<{ canvas: HTMLCanvasElement; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const displayName = name ?? selfProfile?.displayName ?? t("Пользователь");
  const username = String(link ?? selfProfile?.link ?? "").trim().replace(/^@+/u, "");
  const shareUrl = username ? profileQrUrl(username, kind) : "";
  const label = username ? `@${username}` : displayName;
  const background = PROFILE_QR_BACKGROUNDS[backgroundIndex]!;
  const ready = shareUrl !== "" && code?.url === shareUrl && code.canvas.isConnected;
  const duration = reduced ? 0 : .18;

  const onCodeReady = useCallback((canvas: HTMLCanvasElement, url: string) => {
    setCode(previous => previous?.canvas === canvas && previous.url === url ? previous : { canvas, url });
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setPaletteOpen(false); } };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [paletteOpen]);

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${username || "eclipse"}-qr.png`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const exportCard = async (share: boolean) => {
    if (!ready || !code || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const blob = await exportProfileQr(code.canvas, label, background);
      const file = new File([blob], `${username || "eclipse"}-qr.png`, { type: "image/png" });
      if (share && navigator.share) {
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: displayName, files: [file] });
        else await navigator.share({ title: displayName, url: shareUrl });
      } else {
        downloadBlob(blob);
        if (share) {
          let copied = false;
          try { await navigator.clipboard.writeText(shareUrl); copied = true; } catch { /* Download remains available. */ }
          showAppToast({ title: t(copied ? "QR-код сохранён, ссылка скопирована" : "QR-код сохранён"), type: "success" });
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) showAppToast({ title: t("Не удалось сохранить QR-код"), type: "error" });
    } finally { busyRef.current = false; setBusy(false); }
  };
  const button = "grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-white/90 transition-[color,opacity] hover:text-white active:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:opacity-40 disabled:cursor-default";
  return <div data-profile-qr-root className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden bg-[#191b1d]">
    <PanelNavigation direction={scannerOpen ? "forward" : "backward"} className="h-full w-full flex-1">
    {scannerOpen ? <motion.div key="scanner" className="relative flex h-full min-h-0" custom="forward" variants={PANEL_SUBVIEW_VARIANTS} initial="initial" animate="animate" exit="exit">
      <ProfileQrScanner onBack={() => setScannerOpen(false)} />
    </motion.div> : <motion.div key="code" data-profile-qr-panel className="relative flex h-full min-h-0 w-full flex-1 select-none flex-col overflow-hidden text-white" custom="backward" variants={PANEL_SUBVIEW_VARIANTS} initial="initial" animate="animate" exit="exit">
    <AnimatePresence initial={false}><motion.div key={backgroundIndex} data-qr-background className="pointer-events-none absolute inset-0" style={{ background: profileQrBackground(background) }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration }} /></AnimatePresence>
    <header data-qr-header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-2 px-4">
      <button type="button" onClick={onBack || onClose} aria-label={t("Назад")} className={button}><ArrowLeft size={22} /></button>
      <button type="button" onClick={() => setScannerOpen(true)} aria-label={t("Сканировать QR-код")} className={button}><ScanLine size={22} /></button>
    </header>
    <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6 pb-5">
      <motion.div data-qr-card animate={{ y: paletteOpen ? -72 : 0, scale: paletteOpen ? .76 : 1 }} transition={{ duration, ease: [.2, .72, .25, 1] }}
        className="w-full max-w-[280px] rounded-[30px] bg-white px-2 pb-5 pt-2 shadow-[0_18px_45px_rgba(0,0,0,.16)]" style={{ width: "min(86%,280px,calc((100dvh - 210px)*.78))" }}>
        <ProfileQrCanvas url={shareUrl} onReady={onCodeReady} />
        <p className="truncate px-3 text-center text-[23px] font-semibold leading-8 tracking-[-.025em] text-zinc-950" title={label}>{label}</p>
      </motion.div>
    </main>
    <footer className="relative z-20 flex shrink-0 items-center justify-between px-6 pb-[max(22px,env(safe-area-inset-bottom))] pt-2">
      <button type="button" onClick={() => void exportCard(true)} disabled={!ready || busy} aria-label={t("Поделиться")} className={button}><Share2 size={21} /></button>
      <button type="button" onClick={() => setPaletteOpen(true)} aria-label={t("Сменить фон")} aria-expanded={paletteOpen} className={button}><Palette size={22} /></button>
      <button type="button" onClick={() => void exportCard(false)} disabled={!ready || busy} aria-label={t("Скачать")} className={button}><Download size={21} /></button>
    </footer>
    <AnimatePresence>{paletteOpen && <>
      <motion.button type="button" aria-label={t("Закрыть выбор цвета")} className="absolute inset-0 z-30 cursor-default bg-black/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPaletteOpen(false)} transition={{ duration }} />
      <motion.section aria-label={t("Цвета")} data-qr-palette className="absolute inset-x-0 bottom-0 z-40 max-h-[43%] overflow-y-auto rounded-t-[30px] border-t border-white/[0.06] bg-[#191a1e]/95 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 text-white shadow-[0_-10px_36px_rgba(0,0,0,.24)] backdrop-blur-xl"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration, ease: [.2, .72, .25, 1] }}>
        <div className="grid grid-cols-4 gap-3 p-1">{PROFILE_QR_BACKGROUNDS.map((color, index) => <button key={color.name} type="button" aria-label={t(color.name)} aria-pressed={backgroundIndex === index}
          onClick={() => { setBackgroundIndex(index); setPaletteOpen(false); }} className={`mx-auto aspect-square w-full max-w-12 cursor-pointer rounded-full ring-1 ring-inset ring-white/10 ${backgroundIndex === index ? "outline-2 outline-offset-2 outline-white/70" : ""}`} style={{ background: profileQrBackground(color) }} />)}</div>
      </motion.section>
    </>}</AnimatePresence>
  </motion.div>}
  </PanelNavigation></div>;
}
