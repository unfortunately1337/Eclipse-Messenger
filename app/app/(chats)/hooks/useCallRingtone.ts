"use client";
import { useEffect, useRef } from "react";
import { playCallTone } from "@/lib/client/call-sounds";
import { createGestureAudio } from "@/lib/client/gesture-audio";

// A gesture unlocks browser audio once; tones are local and never enter the call.
export function useCallRingtone(mode: "incoming" | "outgoing" | null) {
  const context = useRef<AudioContext | null>(null);
  const ringNow = useRef<(() => void) | null>(null);
  useEffect(() => {
    const dispose = createGestureAudio(audio => { context.current = audio; ringNow.current?.(); });
    return () => {
      dispose(); context.current = null;
    };
  }, []);
  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    const ring = () => {
      const audio = context.current;
      if (cancelled || !audio || audio.state !== "running") return;
      stop?.(); stop = playCallTone(audio, mode);
    };
    ringNow.current = ring;
    ring();
    const timer = window.setInterval(ring, mode === "incoming" ? 3200 : 4000);
    const silence = () => { cancelled = true; clearInterval(timer); ringNow.current = null; stop?.(); };
    window.addEventListener("eclipse:call-silence", silence);
    return () => { silence(); window.removeEventListener("eclipse:call-silence", silence); };
  }, [mode]);
}
