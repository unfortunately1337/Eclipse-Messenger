import { expect, it, vi } from "vitest";
import { playCallTone } from "./call-sounds";
it("creates short distinct gentle join/leave sounds and reuses their PCM buffers", () => {
  const sources: { buffer: AudioBuffer | null; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended?: () => void }[] = [];
  const createBuffer = vi.fn((_channels: number, count: number, rate: number) => { const samples = new Float32Array(count); return { length: count, duration: count / rate, getChannelData: () => samples }; });
  const audio = { sampleRate: 24000, currentTime: 1, destination: {}, createBuffer,
    createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }),
    createBufferSource: () => { const source = { buffer: null as AudioBuffer | null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; },
  } as unknown as AudioContext;
  playCallTone(audio, "join"); playCallTone(audio, "leave"); playCallTone(audio, "join");
  expect(createBuffer).toHaveBeenCalledTimes(2); expect(sources[0].buffer).toBe(sources[2].buffer);
  for (const source of sources) {
    const buffer = source.buffer!, pcm = buffer.getChannelData(0);
    expect(buffer.duration).toBeLessThan(.5); expect(Math.max(...pcm.map(Math.abs))).toBeLessThan(.13);
    expect(Math.max(...pcm.map(Math.abs))).toBeGreaterThan(.02); expect(pcm[0]).toBe(0); expect(pcm[pcm.length - 1]).toBe(0);
    source.onended?.(); expect(source.disconnect).toHaveBeenCalledOnce();
  }
  expect(sources[0].buffer!.getChannelData(0)[100]).not.toBe(sources[1].buffer!.getChannelData(0)[100]);
});
