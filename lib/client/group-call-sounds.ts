import { createGestureAudio } from "./gesture-audio";
import { playCallTone } from "./call-sounds";

/** One local cue per burst, with no queued playback after reconnecting or leaving. */
export function createGroupCallSounds(isReady: () => boolean) {
  let audio: AudioContext | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let pending: "join" | "leave" = "join", lastPlayed = -Infinity, disposed = false;
  let stop: (() => void) | undefined;
  const disposeAudio = createGestureAudio(value => { audio = value; }, { eager: true });
  return {
    play(tone: "join" | "leave") {
      if (disposed || !isReady() || audio?.state !== "running") return;
      pending = tone;
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (disposed || !isReady() || audio?.state !== "running" || performance.now() - lastPlayed < 450) return;
        lastPlayed = performance.now(); stop?.(); stop = playCallTone(audio, pending);
      }, 80);
    },
    dispose() { disposed = true; clearTimeout(timer); stop?.(); disposeAudio(); },
  };
}
