"use client";
import { useCallback, useEffect, useRef } from "react";

type Meter = { read: () => number | null; dispose: () => void };
function attachMeter(context: AudioContext, track: MediaStreamTrack | undefined): Meter | null {
  if (!track || track.readyState === "ended") return null;
  try {
    const source = context.createMediaStreamSource(new MediaStream([track])), analyser = context.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    const samples = new Float32Array(256);
    return {
      read: () => {
        if (!track.enabled || track.readyState === "ended") return 0;
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        return Math.sqrt(energy / samples.length);
      },
      dispose: () => { source.disconnect(); analyser.disconnect(); },
    };
  } catch { return null; }
}

// Keep one analysis context throughout the call, even as peer tracks arrive/reconnect.
export function useCallAudioLevels(localTrack: MediaStreamTrack | undefined, remoteTrack: MediaStreamTrack | undefined, enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  const local = useRef<Meter | null>(null), remote = useRef<Meter | null>(null);
  const hasTracks = Boolean(localTrack || remoteTrack);
  useEffect(() => {
    if (!enabled || !hasTracks || typeof AudioContext === "undefined") return;
    let audio: AudioContext;
    try { audio = new AudioContext(); } catch { return; }
    context.current = audio;
    const resume = () => { if (audio.state === "suspended") void audio.resume().catch(() => {}); };
    resume(); window.addEventListener("pointerdown", resume); window.addEventListener("keydown", resume);
    return () => {
      context.current = null;
      window.removeEventListener("pointerdown", resume); window.removeEventListener("keydown", resume);
      void audio.close().catch(() => {});
    };
  }, [enabled, hasTracks]);
  useEffect(() => {
    if (!enabled || !context.current) return;
    const meter = attachMeter(context.current, localTrack);
    local.current = meter;
    return () => { if (local.current === meter) local.current = null; meter?.dispose(); };
  }, [localTrack, enabled, hasTracks]);
  useEffect(() => {
    if (!enabled || !context.current) return;
    const meter = attachMeter(context.current, remoteTrack);
    remote.current = meter;
    return () => { if (remote.current === meter) remote.current = null; meter?.dispose(); };
  }, [remoteTrack, enabled, hasTracks]);
  return useCallback(() => context.current?.state === "running" ? {
    local: local.current?.read() ?? null, remote: remote.current?.read() ?? null,
  } : null, []);
}
