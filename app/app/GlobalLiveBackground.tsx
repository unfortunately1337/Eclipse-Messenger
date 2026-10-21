'use client'

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LIVE_BACKGROUND_SETTINGS,
  LIVE_BACKGROUND_UPDATED_EVENT,
  LIVE_BACKGROUND_STORAGE_KEY,
  type LiveBackgroundSettings,
  loadLiveBackgroundSettings,
} from "@/lib/client/live-background";

const staticPresetGradients: Record<Exclude<LiveBackgroundSettings["neatPreset"], "none">, string> = {
  neon: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 45%, #22c55e 100%)",
  ocean: "linear-gradient(135deg, #0891b2 0%, #0ea5e9 50%, #1d4ed8 100%)",
  sunset: "linear-gradient(135deg, #f97316 0%, #fb7185 50%, #eab308 100%)",
  aurora: "linear-gradient(135deg, #10b981 0%, #22d3ee 50%, #a855f7 100%)",
  violet: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #c084fc 100%)",
  emerald: "linear-gradient(135deg, #10b981 0%, #22c55e 52%, #84cc16 100%)",
  crimson: "linear-gradient(135deg, #dc2626 0%, #f43f5e 52%, #f97316 100%)",
  mono: "linear-gradient(135deg, #71717a 0%, #52525b 50%, #3f3f46 100%)",
  midnight: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #0ea5e9 100%)",
  frost: "linear-gradient(135deg, #7dd3fc 0%, #93c5fd 52%, #c4b5fd 100%)",
  lava: "linear-gradient(135deg, #f97316 0%, #dc2626 55%, #facc15 100%)",
};

export function LiveBackgroundLayer({
  settings,
  className,
}: {
  settings: LiveBackgroundSettings;
  className?: string;
}) {
  const enabled = settings.neatPreset !== "none";

  const staticGradient = useMemo(() => {
    if (settings.neatPreset === "none") return null;
    return staticPresetGradients[settings.neatPreset];
  }, [settings.neatPreset]);

  if (!enabled) return null;

  return (
    <div
      className={`live-background-hide-neat pointer-events-none overflow-hidden ${className ?? ""}`}
      style={{ opacity: 0.7 }} // Always set to 70% brightness
      aria-hidden
    >
      {staticGradient ? (
        <div className="absolute inset-0" style={{ backgroundImage: staticGradient }} />
      ) : null}
    </div>
  );
}

export default function GlobalLiveBackground() {
  const [settings, setSettings] = useState<LiveBackgroundSettings>(DEFAULT_LIVE_BACKGROUND_SETTINGS);
  const enabled = settings.neatPreset !== "none";

  // Keep the material preference active even when no background preset is selected.
  // Only the persistent layout owns this attribute; individual layers may unmount.
  useEffect(() => {
    document.documentElement.dataset.appTransparentVisual = String(settings.transparentVisual);
    return () => { delete document.documentElement.dataset.appTransparentVisual; };
  }, [settings.transparentVisual]);

  useEffect(() => {
    setSettings(loadLiveBackgroundSettings());

    function onStorage(event: StorageEvent) {
      if (event.key && event.key !== LIVE_BACKGROUND_STORAGE_KEY) return;
      setSettings(loadLiveBackgroundSettings());
    }

    function onCustomUpdate() {
      setSettings(loadLiveBackgroundSettings());
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(LIVE_BACKGROUND_UPDATED_EVENT, onCustomUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LIVE_BACKGROUND_UPDATED_EVENT, onCustomUpdate);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove("live-background-enabled");
      return;
    }
    document.body.classList.add("live-background-enabled");
    return () => {
      document.body.classList.remove("live-background-enabled");
    };
  }, [enabled]);

  if (!enabled) return null;

  return <LiveBackgroundLayer settings={settings} className="fixed inset-0 z-[0]" />;
}
