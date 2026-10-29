import { redis } from "./redis";
import { reconcileCall, notifyCall } from "./calls";
export const CALL_JOBS_KEY = "calls:pending:v1";
let cursor = 0;
export async function processCallJobs() {
  const ids = await redis.smembers(CALL_JOBS_KEY);
  if (!ids.length) return;
  const batch = Array.from({ length: Math.min(100, ids.length) }, (_, index) => ids[(cursor + index) % ids.length]);
  cursor = (cursor + batch.length) % ids.length;
  for (let index = 0; index < batch.length; index += 8) await Promise.allSettled(batch.slice(index, index + 8).map(async id => {
    const call = await reconcileCall(id);
    if (!call) { await redis.srem(CALL_JOBS_KEY, id); return; }
    const delivered = await notifyCall(call);
    if (call.status === "ended" && delivered) await redis.srem(CALL_JOBS_KEY, id);
  }));
}
const state = globalThis as typeof globalThis & { eclipseCallWorker?: ReturnType<typeof setInterval> };
export function startCallWorker() {
  if (state.eclipseCallWorker) return;
  let running = false;
  const tick = () => { if (running) return; running = true; void processCallJobs().catch(() => { console.warn("Call recovery deferred"); }).finally(() => { running = false; }); };
  state.eclipseCallWorker = setInterval(tick, 2000);
  state.eclipseCallWorker.unref();
  tick();
}
