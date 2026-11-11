/** Wake once at the next server deadline instead of polling every 500 ms. */
export function watchPresenceExpiry(expiries: Map<string, number>, onExpire: (ids: string[]) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  function schedule() {
    if (disposed || !expiries.size) return;
    let next = Infinity;
    for (const expiry of expiries.values()) next = Math.min(next, expiry);
    timer = setTimeout(() => {
      const now = Date.now(), expired: string[] = [];
      for (const [id, expiry] of expiries) {
        if (expiry <= now) { expired.push(id); expiries.delete(id); }
      }
      if (expired.length) onExpire(expired);
      schedule();
    }, Math.max(0, next - Date.now()));
  }
  schedule();
  return () => { disposed = true; clearTimeout(timer); };
}
