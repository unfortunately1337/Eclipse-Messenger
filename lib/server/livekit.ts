import { createHash } from "node:crypto";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { HttpError } from "./http";

export function livekitConfigured() {
  return Boolean(process.env.LIVEKIT_URL?.trim() && process.env.LIVEKIT_API_KEY?.trim() && process.env.LIVEKIT_API_SECRET?.trim());
}

function config() {
  if (!livekitConfigured()) throw new HttpError(503, "Звонки пока не настроены");
  const url = new URL(process.env.LIVEKIT_URL!.trim());
  if (url.protocol !== "wss:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new HttpError(503, "Проверьте настройки сервиса звонков");
  }
  return { url: url.origin, key: process.env.LIVEKIT_API_KEY!.trim(), secret: process.env.LIVEKIT_API_SECRET!.trim() };
}

export const callRoomName = (id: string) => `eclipse-${id}`;
export const callIdentity = (id: string, userId: string) => createHash("sha256").update(`${id}:${userId}`).digest("hex");

function service() {
  const cfg = config();
  return new RoomServiceClient(cfg.url.replace("wss:", "https:"), cfg.key, cfg.secret, { requestTimeout: 8 });
}

export async function createCallRoom(id: string, maxParticipants: number) {
  try {
    await service().createRoom({ name: callRoomName(id), maxParticipants, emptyTimeout: 60, departureTimeout: 20 });
  } catch {
    throw new HttpError(503, "Не удалось подключиться к сервису звонков");
  }
}

export async function issueCallConnection(id: string, userId: string) {
  const cfg = config();
  const identity = callIdentity(id, userId);
  const token = new AccessToken(cfg.key, cfg.secret, { identity, ttl: "60s" });
  token.addGrant({ room: callRoomName(id), roomJoin: true, canSubscribe: true, canPublish: true,
    canPublishData: false, canUpdateOwnMetadata: false,
    canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] });
  return { url: cfg.url, token: await token.toJwt(), identity };
}

// A strict cutoff also revokes refreshed Cloud tokens issued during the call.
export async function removeCallParticipant(id: string, userId: string) {
  try { await service().removeParticipant(callRoomName(id), callIdentity(id, userId), { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 2) }); }
  catch { console.warn("Call participant removal failed"); }
}

export async function deleteCallRoom(id: string) {
  try { await service().deleteRoom(callRoomName(id)); }
  catch { console.warn("Call room cleanup failed"); }
}
