export function callElapsedSeconds(startedAt: number, now = Date.now()) {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function formatCallElapsed(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Keep the label aligned to the call clock; hidden tabs do not need UI ticks. */
export function observeCallElapsed(startedAt: number, update: (seconds: number) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const tick = () => {
    clearTimeout(timer);
    if (disposed) return;
    update(callElapsedSeconds(startedAt));
    if (!document.hidden) {
      const elapsed = Math.max(0, Date.now() - startedAt);
      timer = setTimeout(tick, 1000 - elapsed % 1000);
    }
  };
  document.addEventListener("visibilitychange", tick);
  tick();
  return () => {
    disposed = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", tick);
  };
}
