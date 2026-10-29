import { redis } from "./redis";
import { SESSION_TTL_SECONDS } from "./constants";

export type ParticipantAudio = { volume: number; muted: boolean };
const key = (sessionId: string, peerId: string) => `calls:audio:${sessionId}:${peerId}`;

export async function readParticipantAudio(sessionId: string, peerIds: string[]) {
  const entries = await Promise.all(peerIds.map(async peerId => {
    const raw = await redis.get(key(sessionId, peerId));
    let value: ParticipantAudio = { volume: 1, muted: false };
    try {
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1 && typeof saved.muted === "boolean") value = saved;
    } catch { /* A malformed preference must not prevent a call. */ }
    return [peerId, value] as const;
  }));
  return Object.fromEntries(entries);
}

export async function writeParticipantAudio(sessionId: string, peerId: string, value: ParticipantAudio) {
  await redis.set(key(sessionId, peerId), JSON.stringify(value), "EX", SESSION_TTL_SECONDS);
}
