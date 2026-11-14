/** Listen for gestures only while browser audio needs unlocking. Re-arm after
 * interruptions (for example, switching apps on iOS), without handling typing
 * and clicks throughout the rest of the session. */
export function createGestureAudio(onReady: (audio: AudioContext) => void, options?: { eager?: boolean }) {
  let audio: AudioContext | undefined;
  let disposed = false, listening = false, running = false, resuming = false;
  const listen = (enabled: boolean) => {
    if (enabled === listening) return;
    listening = enabled;
    if (enabled) {
      window.addEventListener("pointerdown", unlock, { passive: true });
      window.addEventListener("keydown", unlock);
    } else {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };
  const sync = () => {
    if (disposed) return;
    const ready = audio?.state === "running";
    listen(!ready && audio?.state !== "closed");
    const notify = ready && !running;
    running = ready;
    if (notify) onReady(audio!);
  };
  function unlock() {
    if (disposed || resuming || typeof AudioContext === "undefined") return;
    try {
      if (!audio) {
        audio = new AudioContext();
        audio.addEventListener("statechange", sync);
      }
      if (audio.state === "suspended" || String(audio.state) === "interrupted") {
        resuming = true;
        void audio.resume().catch(() => {}).finally(() => { resuming = false; sync(); });
      }
      sync();
    } catch { resuming = false; /* A later gesture can retry if audio is temporarily unavailable. */ }
  }
  listen(true);
  // An active call can already have browser audio permission. Try immediately,
  // keeping gesture retries available if the browser still requires interaction.
  if (options?.eager && typeof AudioContext !== "undefined") {
    try {
      audio = new AudioContext(); audio.addEventListener("statechange", sync);
      if (audio.state === "suspended") void audio.resume().catch(() => {});
      sync();
    } catch { /* The normal gesture path can retry. */ }
  }
  return () => {
    disposed = true;
    listen(false);
    audio?.removeEventListener("statechange", sync);
    void audio?.close().catch(() => {});
  };
}
