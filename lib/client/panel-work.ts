/** Defer optional panel work until its entrance has finished and the browser is idle. */
export function schedulePanelIdle(task: () => void, delay = 220) {
  let cancelled = false;
  let idle: number | undefined;
  const timer = window.setTimeout(() => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(() => { if (!cancelled) task(); }, { timeout: 1200 });
    } else if (!cancelled) task();
  }, delay);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback(idle);
  };
}
