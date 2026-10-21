"use client";
import { translate as t } from "@/lib/i18n/translate";
import { useTranslation } from "@/components/LocaleProvider";


import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, SwitchCamera, Check, RefreshCw } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { useIsPresent } from "framer-motion";
import { apiRequest } from "@/lib/client/http";
import { extractLoginQrToken, extractLoginQrSecret } from "@/lib/client/login-qr-token";
import { encryptQrKeyTransfer } from "@/lib/client/e2e-qr-transfer";
import { Spinner } from "@/components/ui/spinner";

type ScannerState = "starting" | "scanning" | "reading" | "approving" | "success" | "error";
export default function SessionQrScanner({ onSuccess }: { onSuccess: () => void; onCancel?: () => void }) {
  const t = useTranslation();
  const id = `session-qr-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const present = useIsPresent();
  const [state, setState] = useState<ScannerState>("starting");
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const scanner = useRef<Html5Qrcode | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const approving = useRef(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);

  // Camera start, stop and file decoding cannot run on the same decoder at once.
  const enqueue = useCallback((work: () => Promise<void>) => {
    queue.current = queue.current.catch(() => {}).then(work);
    return queue.current;
  }, []);
  const stop = useCallback(async () => {
    const current = scanner.current;
    scanner.current = null;
    if (!current) return;
    try { if (current.isScanning) await current.stop(); } catch { /* track may already be closed */ }
    try { current.clear(); } catch { /* container may have unmounted */ }
  }, []);

  const decoded = useCallback((raw: string) => {
    if (!mounted.current || approving.current) return;
    const token = extractLoginQrToken(raw, window.location.origin);
    if (!token) { setError(t("Это не код входа. Отсканируйте QR-код на экране входа Eclipse.")); return; }
    approving.current = true;
    setState("approving"); setError("");
    void enqueue(async () => {
      await stop();
      if (!mounted.current) return;
      try {
        const secret = extractLoginQrSecret(raw, window.location.origin);
        const keyTransfer = secret ? await encryptQrKeyTransfer(token, secret) : undefined;
        const result = await apiRequest<{ success: boolean }>("/api/auth/qr/approve", { method: "POST", body: JSON.stringify({ qrToken: token, keyTransfer }) });
        if (!mounted.current) return;
        if (!result.success) throw new Error(t("Не удалось подключить устройство"));
        setState("success");
        successTimer.current = setTimeout(() => { if (mounted.current) onSuccessRef.current(); }, 650);
      } catch (reason) {
        if (mounted.current) { setState("error"); setError(reason instanceof Error ? reason.message : t("Не удалось подключить устройство")); }
        approving.current = false;
      }
    });
  }, [enqueue, stop, t]);

  const start = useCallback((camera?: string) => {
    const sequence = ++generation.current;
    setState("starting"); setError(""); approving.current = false;
    void enqueue(async () => {
      await stop();
      if (!mounted.current || sequence !== generation.current) return;
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted.current || sequence !== generation.current) return;
        const current = new Html5Qrcode(id, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
        scanner.current = current;
        await current.start(camera || { facingMode: "environment" }, { fps: 10, aspectRatio: 1 }, raw => { if (sequence === generation.current) decoded(raw); }, () => {});
        if (!mounted.current || sequence !== generation.current) { await stop(); return; }
        if (approving.current) return;
        setState("scanning");
        const deviceId = current.getRunningTrackSettings().deviceId;
        const available = await Html5Qrcode.getCameras().catch(() => []);
        if (mounted.current && sequence === generation.current) {
          setCameras(available);
          const index = available.findIndex(device => device.id === deviceId);
          if (index >= 0) setCameraIndex(index);
        }
      } catch (reason) {
        await stop();
        if (!mounted.current || sequence !== generation.current) return;
        const message = String(reason);
        setState("error");
        setError(/NotAllowed|Permission|denied/i.test(message) ? t("Разрешите доступ к камере в настройках браузера или выберите фото QR-кода.")
          : /NotFound|NotReadable|Overconstrained/i.test(message) ? t("Камера недоступна. Выберите фото QR-кода или попробуйте снова.")
          : t("Не удалось запустить камеру. Выберите фото QR-кода или попробуйте снова."));
      }
    });
  }, [decoded, enqueue, id, stop, t]);

  useEffect(() => {
    if (!present) return;
    mounted.current = true; start();
    return () => {
      mounted.current = false; generation.current++;
      if (successTimer.current) clearTimeout(successTimer.current);
      void enqueue(stop);
    };
  }, [present, start, enqueue, stop]);

  const readImage = (file?: File) => {
    if (!file || approving.current) return;
    const sequence = ++generation.current;
    setError(""); setState("reading");
    void enqueue(async () => {
      await stop();
      if (!mounted.current || sequence !== generation.current) return;
      try {
        if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error(t("Выберите изображение QR-кода до 20 МБ."));
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted.current || sequence !== generation.current) return;
        const current = new Html5Qrcode(id, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
        scanner.current = current;
        const raw = await current.scanFile(file, false);
        if (!mounted.current || sequence !== generation.current) return;
        const token = extractLoginQrToken(raw, window.location.origin);
        if (!token) throw new Error(t("На изображении нет QR-кода входа Eclipse."));
        decoded(raw);
      } catch (reason) {
        if (!mounted.current || sequence !== generation.current) return;
        setState("error"); setError(reason instanceof Error ? reason.message : t("QR-код не найден. Выберите более чёткое изображение."));
      }
    });
  };
  const busy = state === "starting" || state === "reading" || state === "approving" || state === "success";
  return <div data-session-qr-scanner className="flex min-h-0 flex-col items-center gap-5 px-5 py-6 text-center">
    <div className="max-w-[280px]">
      <h3 className="text-[17px] font-semibold text-white">{t("Подключить устройство")}</h3>
      <p className="mt-2 text-[13px] leading-5 text-zinc-400">{t("Откройте Eclipse на другом устройстве и наведите камеру на QR-код на экране входа.")}</p>
    </div>
    <div data-session-qr-camera className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-[26px] bg-black/35">
      <div id={id} data-session-qr-mount className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-4 rounded-[20px] border-2 border-white/65" />
      {state !== "scanning" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#18181c]/95 px-5">
        {state === "success" ? <Check size={36} className="text-white" /> : busy ? <Spinner className="h-7 w-7 text-zinc-200" /> : <Camera size={34} className="text-zinc-400" />}
        <p className="text-[13px] leading-5 text-zinc-300" role="status">{state === "success" ? t("Устройство подключено") : state === "approving" ? t("Подключаем устройство…") : state === "reading" ? t("Считываем QR-код…") : state === "starting" ? t("Включаем камеру…") : t("Можно сканировать камерой или выбрать фото")}</p>
      </div>}
    </div>
    {error && <p role="alert" className="max-w-[300px] text-[13px] leading-5 text-zinc-400">{t(error ?? "")}</p>}
    <div className="flex w-full max-w-[300px] flex-col gap-2">
      <input ref={fileInput} type="file" accept="image/*" className="hidden" aria-label={t("Фото QR-кода")} onChange={event => { readImage(event.target.files?.[0]); event.target.value = ""; }} />
      <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-full bg-white/[0.08] text-[14px] font-medium text-zinc-100 transition-colors hover:bg-white/[0.12] disabled:opacity-40 cursor-pointer"><ImagePlus size={18} />{t("Выбрать фото QR-кода")}</button>
      {state === "error" && <button type="button" onClick={() => start(cameras[cameraIndex]?.id)} className="flex h-10 items-center justify-center gap-2 rounded-full text-[13px] text-zinc-300 hover:bg-white/[0.05] cursor-pointer"><RefreshCw size={16} />{t("Запустить камеру снова")}</button>}
      {cameras.length > 1 && <button type="button" disabled={busy} onClick={() => { const next = (cameraIndex + 1) % cameras.length; setCameraIndex(next); start(cameras[next].id); }} className="flex h-10 items-center justify-center gap-2 rounded-full text-[13px] text-zinc-300 hover:bg-white/[0.05] disabled:opacity-40 cursor-pointer"><SwitchCamera size={17} />{t("Сменить камеру")}</button>}
    </div>
  </div>;
}
