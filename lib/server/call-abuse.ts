import { redis } from "./redis";
import { HttpError } from "./http";
import type { CallRecord } from "./calls";

type Guard = { missed: number; blockedUntil: number; peers: Record<string, { declines: number; blockedUntil: number }>; processed: string[] };
const keyFor = (callerId: string) => `calls:guard:v1:${callerId}`;
const empty = (): Guard => ({ missed: 0, blockedUntil: 0, peers: {}, processed: [] });
const parse = (raw: string | null): Guard => raw ? JSON.parse(raw) : empty();

export async function assertCallCooldown(callerId: string, peerId: string) {
  const guard = parse(await redis.get(keyFor(callerId))), now = Date.now();
  if (guard.blockedUntil > now) throw new HttpError(429, "После пяти звонков без ответа новые звонки доступны через 10 минут.");
  if ((guard.peers[peerId]?.blockedUntil ?? 0) > now) throw new HttpError(429, "Собеседник дважды отклонил звонок. Повторите через 60 секунд.");
}

// A single CAS record includes deduplication and counters. Concurrent timeout,
// hangup and worker retries can never count the same call twice.
export async function recordCallOutcome(call: CallRecord) {
  if (call.kind !== "direct" || call.status !== "ended") return;
  const peerId = call.invitedIds.find(id => id !== call.callerId);
  if (!peerId) return;
  const key = keyFor(call.callerId);
  for (let attempt = 0; attempt < 16; attempt++) {
    const raw = await redis.get(key), state = parse(raw);
    if (state.processed.includes(call.id)) return;
    const now = Date.now();
    if (state.blockedUntil && state.blockedUntil <= now) { state.blockedUntil = 0; state.missed = 0; }
    const peer = state.peers[peerId] ?? { declines: 0, blockedUntil: 0 };
    if (peer.blockedUntil && peer.blockedUntil <= now) { peer.blockedUntil = 0; peer.declines = 0; }
    if (call.endReason === "declined") {
      if (++peer.declines >= 2) { peer.blockedUntil = now + 60_000; peer.declines = 0; }
    } else if (call.endReason === "missed") {
      if (++state.missed >= 5) { state.blockedUntil = now + 600_000; state.missed = 0; }
    } else if (call.endReason === "completed") { state.missed = 0; peer.declines = 0; }
    state.peers[peerId] = peer;
    // Bound retained peers, preserving active restrictions.
    const entries = Object.entries(state.peers);
    if (entries.length > 200) for (const [id, value] of entries) {
      if (id !== peerId && value.blockedUntil <= now) { delete state.peers[id]; if (Object.keys(state.peers).length <= 200) break; }
    }
    state.processed = [...state.processed.slice(-999), call.id];
    const value = JSON.stringify(state);
    if (raw === null ? await redis.setIfAbsent(key, value, 86400) : await redis.compareAndSet(key, raw, value, 86400)) return;
  }
  throw new HttpError(503, "Защита звонков временно недоступна. Повторите позже.");
}
