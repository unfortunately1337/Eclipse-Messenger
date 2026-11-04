import { createHmac, createHash } from "node:crypto";
import { HttpError } from "./http";

function urls(value: string | undefined, protocols: readonly string[]): string[] {
  if (!value?.trim()) return [];
  const entries = value.split(/[\s,]+/).filter(Boolean);
  if (entries.length > 8 || entries.some(value => {
    if (value.length > 512 || !protocols.some(protocol => value.startsWith(protocol))) return true;
    const match = /^(?:stun|stuns|turn|turns):(?:\[[a-f\d:]+\]|[a-z\d](?:[a-z\d.-]*[a-z\d])?)(?::(\d{1,5}))?(?:\?transport=(udp|tcp))?$/i.exec(value);
    return !match || (match[1] && (Number(match[1]) < 1 || Number(match[1]) > 65535)) || (value.startsWith("turns:") && match[2] === "udp");
  })) {
    throw new HttpError(503, "Проверьте настройки сервиса звонков");
  }
  return entries;
}

/** Coturn TURN REST credentials: the shared secret never leaves the backend. */
export function callIceConfiguration(callId: string, userId: string, now = Date.now()) {
  const turnUrls = urls(process.env.WEBRTC_TURN_URLS, ["turn:", "turns:"]);
  const stunUrls = urls(process.env.WEBRTC_STUN_URLS ?? "stun:stun.l.google.com:19302", ["stun:", "stuns:"]);
  const secret = process.env.WEBRTC_TURN_SECRET?.trim() ?? "";
  if ((turnUrls.length > 0 && secret.length < 32) || (secret && !turnUrls.length)) {
    throw new HttpError(503, "Проверьте настройки сервиса звонков");
  }
  const relayConfigured = turnUrls.length > 0 && secret.length >= 32;
  // A production rollout must have a relay, not just a happy-path STUN test.
  if (!relayConfigured && process.env.NODE_ENV === "production") throw new HttpError(503, "Резервный сервер звонков ещё не настроен");
  const configuredTtl = Number(process.env.WEBRTC_TURN_TTL_SECONDS || 1800);
  const ttl = Number.isFinite(configuredTtl) ? Math.max(300, Math.min(3600, Math.floor(configuredTtl))) : 1800;
  const expires = Math.floor(now / 1000) + ttl;
  const identity = createHash("sha256").update(`${callId}:${userId}`).digest("hex").slice(0, 32);
  const username = `${expires}:${identity}`;
  const iceServers: RTCIceServer[] = [];
  if (stunUrls.length) iceServers.push({ urls: stunUrls });
  if (relayConfigured) iceServers.push({ urls: turnUrls, username, credential: createHmac("sha1", secret).update(username).digest("base64") });
  const iceTransportPolicy: RTCIceTransportPolicy = process.env.WEBRTC_ICE_TRANSPORT_POLICY === "relay" ? "relay" : "all";
  if (iceTransportPolicy === "relay" && !relayConfigured) throw new HttpError(503, "Резервный сервер звонков ещё не настроен");
  return { iceServers, iceTransportPolicy, turnExpiresAt: expires * 1000, relayConfigured };
}

export function p2pCallsConfigured() {
  if (process.env.CALLS_DIRECT_TRANSPORT !== "p2p") return false;
  try { callIceConfiguration("configuration-check", "configuration-check"); return true; } catch { return false; }
}
