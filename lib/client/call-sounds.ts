export type CallTone = "incoming" | "outgoing";

const buffers = new WeakMap<BaseAudioContext, Map<CallTone, AudioBuffer>>();

function toneBuffer(audio: BaseAudioContext, tone: CallTone): AudioBuffer {
  let cache = buffers.get(audio);
  if (!cache) { cache = new Map(); buffers.set(audio, cache); }
  const cached = cache.get(tone);
  if (cached) return cached;
  const rate = audio.sampleRate;
  const length = tone === "outgoing" ? 1.1 : 1.25;
  const buffer = audio.createBuffer(1, Math.ceil(rate * length), rate);
  const samples = buffer.getChannelData(0);
  const add = (offset: number, duration: number, from: number, to: number, level: number, bell = false) => {
    const start = Math.round(offset * rate), count = Math.round(duration * rate);
    const attack = bell ? 0.012 : 0.03, release = bell ? 0.1 : 0.045;
    let phase = 0;
    for (let i = 0; i < count && start + i < samples.length; i++) {
      const time = i / rate;
      // Pitch settles gently; the integrated phase remains continuous.
      const frequency = to + (from - to) * Math.exp(-time * 32);
      phase += 2 * Math.PI * frequency / rate;
      const fadeIn = Math.min(1, time / attack), fadeOut = Math.min(1, (duration - time) / release);
      const envelope = Math.sin(fadeIn * Math.PI / 2) ** 2 * Math.sin(fadeOut * Math.PI / 2) ** 2;
      const decay = bell ? Math.exp(-time * 7) : 1;
      const signal = Math.sin(phase) + (bell ? Math.sin(phase * 2) * 0.12 * Math.exp(-time * 15) : 0);
      samples[start + i] += signal * envelope * decay * level;
    }
  };
  if (tone === "outgoing") {
    // One steady telephone ringback: no beating frequencies or overlapping notes.
    add(0, 1, 425, 425, 0.085);
  } else if (tone === "incoming") {
    for (const offset of [0, 0.48]) {
      add(offset, 0.32, 440, 440, 0.06);
      add(offset, 0.32, 660, 660, 0.025);
    }
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak > 0.13) {
    const scale = 0.13 / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  }
  cache.set(tone, buffer);
  return buffer;
}

/** Cached PCM playback keeps timing stable and never enters the published call. */
export function playCallTone(audio: AudioContext, tone: CallTone): () => void {
  const source = audio.createBufferSource(), gain = audio.createGain();
  source.buffer = toneBuffer(audio, tone);
  source.connect(gain); gain.connect(audio.destination);
  let ended = false, stopping = false;
  source.onended = () => { ended = true; source.disconnect(); gain.disconnect(); };
  source.start();
  return () => {
    if (ended || stopping) return;
    stopping = true;
    gain.gain.setValueAtTime(1, audio.currentTime);
    gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.02);
    try { source.stop(audio.currentTime + 0.025); } catch { /* Context already closed. */ }
  };
}
