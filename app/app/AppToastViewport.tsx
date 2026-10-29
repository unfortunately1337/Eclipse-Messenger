"use client";
import { useTranslation } from "@/components/LocaleProvider";


import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, ShieldAlert, ShieldCheck, ShieldX, Globe, GlobeOff, LaptopMinimalCheck, Copy } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { APP_TOAST_EVENT, showAppToast, type AppToastPayload } from "@/lib/client/app-toast";
import { cn } from "@/lib/utils";
import { createNetworkMonitor, NETWORK_CHECK_EVENT } from "@/lib/client/network-monitor";
import { getPanelVisualStyle } from "@/lib/client/panel-visual";
import { LIVE_BACKGROUND_STORAGE_KEY, LIVE_BACKGROUND_UPDATED_EVENT, loadLiveBackgroundSettings } from "@/lib/client/live-background";

type ToastItem = AppToastPayload & { id: string };

export default function AppToastViewport() {
  const t = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [transparentVisual, setTransparentVisual] = useState(false);
  const timersRef = useRef<Record<string, number>>({});
  const recentRef = useRef(new Map<string, number>());

  useEffect(() => {
    const syncMaterial = () => {
      setTransparentVisual(loadLiveBackgroundSettings().transparentVisual ?? true);
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === LIVE_BACKGROUND_STORAGE_KEY) syncMaterial();
    };
    syncMaterial();
    window.addEventListener(LIVE_BACKGROUND_UPDATED_EVENT, syncMaterial);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LIVE_BACKGROUND_UPDATED_EVENT, syncMaterial);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<AppToastPayload>;
      const detail = custom.detail;
      if (!detail?.title) return;
      const signature = JSON.stringify([detail.type ?? "info", detail.title, detail.description]);
      const now = Date.now();
      for (const [key, expiry] of recentRef.current) if (expiry <= now) recentRef.current.delete(key);
      if (recentRef.current.has(signature)) return;
      recentRef.current.set(signature, now + (detail.durationMs ?? 3200));

      const titleLower = detail.title.toLowerCase();
      if (
        (titleLower.includes("http") && titleLower.includes("200")) ||
        (titleLower.includes("200") && titleLower.includes("ошибка"))
      ) {
        return;
      }

      const id = crypto.randomUUID();
      const toast: ToastItem = {
        id,
        type: detail.type ?? "info",
        icon: detail.icon,
        title: detail.title,
        description: detail.description,
        durationMs: detail.durationMs ?? 3200,
        actions: detail.actions,
      };

      setToasts((prev) => [...prev, toast].slice(-4));

      const timer = window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
        if (timersRef.current[id]) {
          window.clearTimeout(timersRef.current[id]);
          delete timersRef.current[id];
        }
      }, toast.durationMs);
      timersRef.current[id] = timer;
    };

    window.addEventListener(APP_TOAST_EVENT, onToast as EventListener);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, onToast as EventListener);
      Object.values(timersRef.current).forEach((timer) => window.clearTimeout(timer));
      timersRef.current = {};
    };
  }, []);

  useEffect(() => {
    let controller: AbortController | null = null;
    const monitor = createNetworkMonitor(async () => {
      controller = new AbortController();
      const timer = window.setTimeout(() => controller?.abort(), 3000);
      try {
        await fetch(`/api/connection-health?t=${Date.now()}`, { cache: "no-store", credentials: "omit", signal: controller.signal });
        return true;
      } finally { clearTimeout(timer); controller = null; }
    }, offline => {
      showAppToast(offline ? {
        type: "error", title: t("Нестабильное соединение с интернетом"),
        description: t("Проверьте подключение к интернету."), icon: "globe-x", durationMs: 4000,
      } : {
        type: "success", title: t("Соединение восстановлено"),
        description: t("Вы снова онлайн."), icon: "globe", durationMs: 3000,
      });
    }, () => !document.hidden);
    const check = () => { void monitor.verify(); };
    window.addEventListener("offline", check);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    window.addEventListener(NETWORK_CHECK_EVENT, check);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      monitor.stop(); controller?.abort();
      window.removeEventListener("offline", check);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      window.removeEventListener(NETWORK_CHECK_EVENT, check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [t]);

  const iconByType = useMemo(
    () => ({
      success: <Check size={15} />,
      info: <Info size={15} />,
      error: <Info size={15} />,
    }),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-[9999] flex flex-col items-center justify-center px-3 md:bottom-20">
      <div className="relative flex w-full max-w-[420px] items-center justify-center min-h-[48px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {toasts.slice(-3).map((toast, index, arr) => {
            const offsetFromFront = arr.length - 1 - index; // 0 = front (newest), 1 = behind, 2 = deepest
            const yOffset = offsetFromFront * -9;
            const scale = 1 - offsetFromFront * 0.055;
            const opacity = offsetFromFront === 0 ? 1 : offsetFromFront === 1 ? 0.72 : 0.44;
            const zIndex = 30 - offsetFromFront * 10;
            const isFront = offsetFromFront === 0;

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.94 }}
                animate={{
                  opacity,
                  y: yOffset,
                  scale,
                  zIndex,
                }}
                exit={{
                  opacity: 0,
                  y: 12,
                  scale: 0.9,
                  transition: { duration: 0.16, ease: "easeOut" },
                }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 28,
                  mass: 0.8,
                }}
                style={{
                  position: isFront ? "relative" : "absolute",
                  zIndex,
                }}
                className={cn(
                  "w-full max-w-[420px] origin-bottom",
                  isFront ? "pointer-events-auto" : "pointer-events-none"
                )}
              >
                <div
                  data-app-toast
                  style={getPanelVisualStyle(transparentVisual)}
                  className="relative mx-auto flex w-full items-center gap-3 rounded-full border border-solid px-4 py-2.5 text-white select-none"
                >
                  {/* Clean Icon (naked, without border/badge) */}
                  <div className="flex shrink-0 items-center justify-center text-zinc-300">
                    {toast.icon === "copy" ? (
                      <Copy size={16} />
                    ) : toast.icon === "shield-check" ? (
                      <ShieldCheck size={16} />
                    ) : toast.icon === "shield-alert" ? (
                      <ShieldAlert size={16} />
                    ) : toast.icon === "shield-x" ? (
                      <ShieldX size={16} />
                    ) : toast.icon === "globe" ? (
                      <Globe size={16} />
                    ) : toast.icon === "globe-x" ? (
                      <GlobeOff size={16} />
                    ) : toast.icon === "laptop-check" ? (
                      <LaptopMinimalCheck size={16} />
                    ) : toast.icon === "info" ? (
                      <Info size={16} />
                    ) : (
                      iconByType[toast.type ?? "info"]
                    )}
                  </div>

                  {/* Message Title & Description */}
                  <div className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-white">
                    {toast.description ? `${t(toast.title)}. ${t(toast.description)}` : t(toast.title)}
                  </div>

                  {/* Actions if any */}
                  {toast.actions && toast.actions.length > 0 ? (
                    <div className="flex shrink-0 items-center gap-2">
                      {toast.actions.map((action, actionIdx) => (
                        <button
                          key={`${toast.id}-action-${actionIdx}`}
                          type="button"
                          className="shrink-0 rounded-full bg-white/12 px-2.5 py-0.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/20 active:scale-95 cursor-pointer"
                          onClick={() => {
                            action.onClick();
                            if (action.closeOnClick ?? true) {
                              setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                              if (timersRef.current[toast.id]) {
                                window.clearTimeout(timersRef.current[toast.id]);
                                delete timersRef.current[toast.id];
                              }
                            }
                          }}
                        >
                          {t(action.label ?? "")}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
