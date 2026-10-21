import { isChunkLoadError } from "./chunk-load-error";

const KEY = "eclipse:chunk-recovery:v1";
const COOLDOWN_MS = 60_000;

/** Refresh stale build assets once, without trapping a broken/offline client in a loop. */
export function recoverStaleChunk(error: Error): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error) || !navigator.onLine) return false;
  try {
    const now = Date.now();
    const previous = Number(window.sessionStorage.getItem(KEY));
    if (previous > 0 && now - previous < COOLDOWN_MS) return false;
    window.sessionStorage.setItem(KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    // Browsers that deny session storage must use the manual reload button.
    return false;
  }
}
