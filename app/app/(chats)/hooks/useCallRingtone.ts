"use client";
import { useEffect, useRef } from "react";
import { playCallTone } from "@/lib/client/call-sounds";

// A gesture unlocks browser audio once; tones are local and never enter the call.
export function useCallRingtone(mode: "incoming" | "outgoing" | null) {
  const context = useRef<AudioContext | null>(null);
  const ringNow = useRef<(() => void) | null>(null);
  useEffect(() => {
    const unlock = () => {
      const firstGesture = !context.current;
      if (!context.current && typeof AudioContext !== "undefined") context.current = new AudioContext();
      if (context.current?.state === "suspended") void context.current.resume().then(() => ringNow.current?.()).catch(() => {});
      else if (firstGesture && context.current?.state === "running") ringNow.current?.();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock);
      void context.current?.close().catch(() => {}); context.current = null;
    };
  }, []);
  useEffect(() => {
    if (!mode) return;
    let stop: (() => void) | undefined;
    const ring = () => {
      const audio = context.current;
      if (!audio || audio.state !== "running") return;
      stop?.(); stop = playCallTone(audio, mode);
    };
    ringNow.current = ring;
    ring();
    const timer = window.setInterval(ring, mode === "incoming" ? 3200 : 4000);
    return () => { clearInterval(timer); ringNow.current = null; stop?.(); };
  }, [mode]);
}
