// Shared between the call UI and the global music player in this browser tab.
let active = false;
export const CALL_PLAYBACK_CHANGED = "eclipse:call-playback-changed";

export function isCallPlaybackActive() { return active; }

export function setCallPlaybackActive(value: boolean) {
  if (active === value) return;
  active = value;
  window.dispatchEvent(new Event(CALL_PLAYBACK_CHANGED));
}
