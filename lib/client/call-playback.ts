// Shared by calls, media playback and message recording in this browser tab.
let active = false;
export const CALL_PLAYBACK_CHANGED = "eclipse:call-playback-changed";

export function isCallPlaybackActive() { return active; }
export function inactiveCallPlaybackSnapshot() { return false; }
export function subscribeCallPlayback(notify: () => void) {
  window.addEventListener(CALL_PLAYBACK_CHANGED, notify);
  return () => window.removeEventListener(CALL_PLAYBACK_CHANGED, notify);
}

export function setCallPlaybackActive(value: boolean) {
  if (active === value) return;
  active = value;
  window.dispatchEvent(new Event(CALL_PLAYBACK_CHANGED));
}
