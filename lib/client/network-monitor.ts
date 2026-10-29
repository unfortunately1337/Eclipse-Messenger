export const NETWORK_CHECK_EVENT = "eclipse:verify-network";
export function requestNetworkCheck() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NETWORK_CHECK_EVENT));
}

/** Browser online/offline events and failed requests are hints, never proof of an outage. */
export function createNetworkMonitor(probe: () => Promise<boolean>, changed: (offline: boolean) => void, visible: () => boolean) {
  let stopped = false, checking = false, pending = false, revision = 0;
  let offline = false, failures = 0, healthy = 0, firstFailure: number | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const schedule = (delay: number) => { clearTimeout(retry); retry = setTimeout(() => { void verify(); }, delay); };
  async function verify() {
    if (stopped) return;
    revision += 1;
    if (checking) { pending = true; return; }
    clearTimeout(retry);
    if (!visible()) { failures = 0; healthy = 0; firstFailure = null; return; }
    checking = true;
    const current = revision;
    try {
      const reachable = await probe().catch(() => false);
      if (stopped || current !== revision || !visible()) return;
      if (reachable) {
        failures = 0; firstFailure = null;
        if (offline) {
          healthy += 1;
          if (healthy >= 2) { offline = false; healthy = 0; changed(false); }
          else schedule(1500);
        }
      } else {
        healthy = 0; failures += 1; firstFailure ??= Date.now();
        if (!offline && failures >= 3 && Date.now() - firstFailure >= 4000) { offline = true; changed(true); }
        schedule(offline ? 5000 : 1500);
      }
    } finally {
      checking = false;
      if (pending && !stopped) { pending = false; schedule(0); }
    }
  }
  return { verify, stop() { stopped = true; revision += 1; clearTimeout(retry); } };
}
