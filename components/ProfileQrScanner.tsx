"use client";

import { useTranslation } from "@/components/LocaleProvider";
import { parseProfileQrUrl } from "@/lib/client/profile-qr";
import { ArrowLeft, Camera, ImagePlus, RefreshCw, ScanLine } from "lucide-react";
import { useIsPresent } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type ScannerState = "starting" | "scanning" | "reading" | "error";
export default function ProfileQrScanner({ onBack }: { onBack: () => void }) {
  const t = useTranslation();
  const present = useIsPresent();
  const id = `profile-qr-${useId().replace(/[^a-z0-9-]/gi, "")}`;
  const scanner = useRef<Html5Qrcode | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const navigating = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = useState<ScannerState>("starting");
  const [error, setError] = useState("");

  const enqueue = useCallback((work: () => Promise<void>) => {
    queue.current = queue.current.catch(() => {}).then(work);
    return queue.current;
  }, []);
  const stop = useCallback(async () => {
    const current = scanner.current;
    scanner.current = null;
    if (!current) return;
    try { if (current.isScanning) await current.stop(); } catch { /* Already stopped. */ }
    try { current.clear(); } catch { /* Container can already be unmounted. */ }
  }, []);
  const openCode = useCallback((raw: string) => {
    if (!mounted.current || navigating.current) return;
    const url = parseProfileQrUrl(raw, window.location.origin);
    if (!url) { setError(t("Поддерживаются только QR-коды Eclipse.")); return; }
    navigating.current = true;
    void enqueue(async () => {
      await stop();
      if (mounted.current) window.location.assign(url);
    });
  }, [enqueue, stop, t]);

  const start = useCallback(() => {
    const request = ++generation.current;
    navigating.current = false;
    setError(""); setState("starting");
    void enqueue(async () => {
      await stop();
      if (!mounted.current || request !== generation.current) return;
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted.current || request !== generation.current) return;
        const current = new Html5Qrcode(id, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
        scanner.current = current;
        await current.start({ facingMode: "environment" }, { fps: 10, aspectRatio: 1 }, openCode, () => {});
        if (!mounted.current || request !== generation.current) { await stop(); return; }
        setState("scanning");
      } catch {
        await stop();
        if (mounted.current && request === generation.current) {
          setState("error"); setError(t("Разрешите доступ к камере или выберите фото QR-кода."));
        }
      }
    });
  }, [enqueue, id, openCode, stop, t]);
  useEffect(() => {
    mounted.current = present;
    if (present) start();
    return () => { mounted.current = false; generation.current++; void enqueue(stop); };
  }, [enqueue, present, start, stop]);

  const readFile = (file?: File) => {
    if (!file) return;
    const request = ++generation.current;
    setState("reading"); setError("");
    void enqueue(async () => {
      await stop();
      if (!mounted.current || request !== generation.current) return;
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted.current || request !== generation.current) return;
        const current = new Html5Qrcode(id, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
        scanner.current = current;
        const raw = await current.scanFile(file, false);
        if (!mounted.current || request !== generation.current) return;
        const url = parseProfileQrUrl(raw, window.location.origin);
        if (url) openCode(raw);
        else { setState("error"); setError(t("Поддерживаются только QR-коды Eclipse.")); }
      } catch {
        if (mounted.current && request === generation.current) {
          setState("error"); setError(t("QR-код не найден. Выберите более чёткое изображение."));
        }
      }
    });
  };
  return <div data-profile-qr-scanner className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#202124] text-white">
    <header className="flex h-16 shrink-0 items-center px-4"><button type="button" onClick={onBack} aria-label={t("Назад")} className="grid size-11 cursor-pointer place-items-center bg-transparent text-white/90 transition-colors hover:text-white"><ArrowLeft size={22} /></button></header>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 pb-8 text-center">
      <p className="mb-5 text-[14px] leading-5 text-white/60">{t("Наведите камеру на QR-код Eclipse или выберите его фото.")}</p>
      <div className="relative aspect-square w-full max-w-[280px] shrink-0 overflow-hidden rounded-[28px] bg-black/40">
        <div id={id} className="absolute inset-0 [&_video]:h-full! [&_video]:w-full! [&_video]:object-cover" />
        <div className="pointer-events-none absolute inset-4 rounded-[22px] border-2 border-white/65" />
        {state !== "scanning" && <div className="absolute inset-0 grid place-items-center bg-[#202124]/90 px-5"><div>
          {state === "error" ? <Camera className="mx-auto mb-3 text-white/50" size={30} /> : <ScanLine className="mx-auto mb-3" size={30} />}
          <p role="status" className="text-[13px] leading-5 text-white/70">{state === "reading" ? t("Считываем QR-код…") : state === "starting" ? t("Включаем камеру…") : error}</p>
        </div></div>}
      </div>
      {state === "scanning" && error && <p role="status" className="mt-3 text-[13px] text-white/70">{error}</p>}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={event => { readFile(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="mt-5 flex w-full max-w-[280px] gap-2">
        <button type="button" disabled={state === "reading"} onClick={() => input.current?.click()} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-transparent text-[14px] font-semibold text-white/90 transition-colors hover:text-white disabled:opacity-50"><ImagePlus size={18} />{t("Выбрать фото")}</button>
        {state === "error" && <button type="button" onClick={start} aria-label={t("Попробовать снова")} className="grid size-11 cursor-pointer place-items-center rounded-full bg-transparent text-white/90 transition-colors hover:text-white"><RefreshCw size={18} /></button>}
      </div>
    </div>
  </div>;
}
