"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";

export const VOICE_WAVEFORM_BAR_COUNT = 16;
export const VOICE_MESSAGE_WAVEFORM_BARS = 48;
export const VOICE_WAVEFORM_BASE_HEIGHTS = [9, 13, 8, 14, 10, 15, 11, 9, 14, 10, 12, 8, 13, 9, 15, 10] as const;

export function createDefaultWaveformLevels(count = VOICE_WAVEFORM_BAR_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const base = VOICE_WAVEFORM_BASE_HEIGHTS[index % VOICE_WAVEFORM_BASE_HEIGHTS.length];
    return Math.min(1, Math.max(0.18, base / 15));
  });
}

export function sampleAnalyserLevels(analyser: AnalyserNode, barCount: number, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteFrequencyData(buffer);
  const step = Math.max(1, Math.floor(buffer.length / barCount));
  const levels: number[] = [];
  for (let index = 0; index < barCount; index += 1) {
    let sum = 0;
    const start = index * step;
    const end = Math.min(buffer.length, start + step);
    for (let offset = start; offset < end; offset += 1) {
      sum += buffer[offset] ?? 0;
    }
    const average = sum / Math.max(1, end - start);
    levels.push(Math.min(1, Math.max(0.12, average / 180)));
  }
  return levels;
}

export function smoothWaveformLevels(previous: number[], next: number[], factor = 0.34) {
  return next.map((value, index) => {
    const prev = previous[index] ?? value;
    return prev + (value - prev) * factor;
  });
}

export function sampleAnalyserAmplitude(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buffer);
  let sumSquares = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const centered = (buffer[index] ?? 128) - 128;
    sumSquares += centered * centered;
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, buffer.length)) / 128;
  if (rms < 0.012) return 0;
  return Math.min(1, Math.pow(Math.min(1, rms * 3.8), 0.85));
}

export function normalizeWaveformLevels(levels: number[]) {
  if (levels.length === 0) return levels;
  const max = Math.max(...levels, 0.15);
  return levels.map((level) => (level < 0.02 ? 0 : Math.min(1, level / max)));
}

export function downsampleWaveform(samples: number[], barCount = VOICE_MESSAGE_WAVEFORM_BARS) {
  if (samples.length === 0) {
    return Array.from({ length: barCount }, () => 0);
  }
  const buckets: number[] = [];
  const bucketSize = samples.length / barCount;
  for (let index = 0; index < barCount; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    let peak = 0;
    for (let offset = start; offset < end; offset += 1) {
      const val = samples[offset] ?? 0;
      if (val > peak) peak = val;
    }
    buckets.push(peak);
  }
  return normalizeWaveformLevels(buckets);
}

export function encodeWaveformForMessage(levels: number[]) {
  return levels.map((level) => Math.min(100, Math.max(0, Math.round(level * 100))));
}

export function decodeWaveformFromMessage(encoded?: number[] | null) {
  if (!encoded?.length) return undefined;
  return encoded.map((value) => Math.min(1, Math.max(0, value / 100)));
}

type AnalyserSession = {
  analyser: AnalyserNode;
  audioContext: AudioContext;
  cleanup: () => void;
};

export function createStreamAnalyser(stream: MediaStream): AnalyserSession {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;
  source.connect(analyser);
  // Keep the graph processing without ever playing the microphone back.
  const silentOutput = audioContext.createGain();
  silentOutput.gain.value = 0;
  analyser.connect(silentOutput);
  silentOutput.connect(audioContext.destination);
  return {
    analyser,
    audioContext,
    cleanup: () => {
      source.disconnect();
      analyser.disconnect();
      silentOutput.disconnect();
      void audioContext.close().catch(() => {});
    },
  };
}

export function createMediaElementAnalyser(audio: HTMLAudioElement): AnalyserSession {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaElementSource(audio);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.72;
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  return {
    analyser,
    audioContext,
    cleanup: () => {
      source.disconnect();
      analyser.disconnect();
      void audioContext.close();
    },
  };
}

type VoiceWaveformCaptureOptions = {
  captureSamplesRef?: MutableRefObject<number[]>;
};

export function useVoiceRecordingAmplitude(
  stream: MediaStream | null,
  active: boolean,
  options?: VoiceWaveformCaptureOptions,
) {
  const amplitude = useRef(0);
  const captureSamplesRef = options?.captureSamplesRef;

  useEffect(() => {
    amplitude.current = 0;
    if (!active || !stream || stream.getAudioTracks().length === 0) return;
    let session: AnalyserSession;
    try { session = createStreamAnalyser(stream); }
    catch { return; } // An unavailable analyser must not interrupt the recording.
    const buffer = new Uint8Array(session.analyser.fftSize);
    void session.audioContext.resume().catch(() => {});

    // Capture the saved waveform independently of animation frames and React renders.
    const timer = setInterval(() => {
      const sample = sampleAnalyserAmplitude(session.analyser, buffer);
      amplitude.current = sample;
      captureSamplesRef?.current.push(sample);
    }, 45);

    return () => {
      clearInterval(timer);
      amplitude.current = 0;
      session.cleanup();
    };
  }, [active, captureSamplesRef, stream]);

  return amplitude;
}
export function usePlaybackWaveformLevels(
  audio: HTMLAudioElement | null,
  playing: boolean,
  enabled: boolean,
) {
  const [levels, setLevels] = useState<number[] | null>(null);
  const sessionRef = useRef<AnalyserSession | null>(null);
  const smoothRef = useRef<number[]>(createDefaultWaveformLevels());
  const frameRef = useRef<number | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!audio) return;

    if (!sessionRef.current) {
      try {
        const session = createMediaElementAnalyser(audio);
        sessionRef.current = session;
        bufferRef.current = new Uint8Array(session.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
        void session.audioContext.resume();
      } catch {
        sessionRef.current = null;
        bufferRef.current = null;
      }
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      sessionRef.current?.cleanup();
      sessionRef.current = null;
      bufferRef.current = null;
    };
  }, [audio]);

  useEffect(() => {
    if (!enabled || !playing || !sessionRef.current) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (!playing) {
        queueMicrotask(() => {
          setLevels(null);
        });
      }
      return;
    }

    const tick = () => {
      const analyser = sessionRef.current?.analyser;
      const buffer = bufferRef.current;
      if (analyser && buffer) {
        const sampled = sampleAnalyserLevels(analyser, VOICE_WAVEFORM_BAR_COUNT, buffer);
        smoothRef.current = smoothWaveformLevels(smoothRef.current, sampled, 0.36);
        setLevels([...smoothRef.current]);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [enabled, playing]);

  return levels;
}
