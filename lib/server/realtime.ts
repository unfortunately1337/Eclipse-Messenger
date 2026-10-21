import { createHash, createHmac } from "crypto";

type PusherConfig = {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
};

type ChannelData = {
  user_id: string;
  user_info?: Record<string, unknown>;
};

function getConfig(): PusherConfig {
  const appId = process.env.PUSHER_APP_ID?.trim();
  const key = process.env.PUSHER_KEY?.trim();
  const secret = process.env.PUSHER_SECRET?.trim();
  const cluster = process.env.PUSHER_CLUSTER?.trim();

  if (!appId || !key || !secret || !cluster) {
    throw new Error("PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET и PUSHER_CLUSTER должны быть заданы");
  }

  return {
    appId,
    key,
    secret,
    cluster,
  };
}

function sortedQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}

function signRequest(method: string, path: string, query: Record<string, string>, secret: string) {
  const canonical = `${method}\n${path}\n${sortedQuery(query)}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function getRealtimeClientConfig() {
  const cfg = getConfig();
  return {
    key: cfg.key,
    cluster: cfg.cluster,
  };
}

export function buildPusherAuth(socketId: string, channelName: string, channelData?: ChannelData) {
  const cfg = getConfig();
  const serializedChannelData = channelData ? JSON.stringify(channelData) : null;
  const stringToSign = serializedChannelData
    ? `${socketId}:${channelName}:${serializedChannelData}`
    : `${socketId}:${channelName}`;
  const signature = createHmac("sha256", cfg.secret).update(stringToSign).digest("hex");

  return {
    auth: `${cfg.key}:${signature}`,
    ...(serializedChannelData ? { channel_data: serializedChannelData } : {}),
  };
}

export async function triggerRealtimeEvent(params: {
  channel: string;
  name: string;
  data: Record<string, unknown>;
}) {
  return sendRealtimeChannels([params.channel], params.name, params.data);
}

// The payload must be identical and authorized for every recipient. Do not
// batch direct-message envelopes or per-recipient contact aliases together.
export async function triggerRealtimeChannels(params: {
  channels: string[];
  name: string;
  data: Record<string, unknown>;
}) {
  const channels = [...new Set(params.channels)];
  if (!channels.length) return;
  const batches: string[][] = [];
  for (let i = 0; i < channels.length; i += 100) batches.push(channels.slice(i, i + 100));
  const failures: unknown[] = [];
  // Bound concurrent HTTP requests even for communities with many members.
  for (let i = 0; i < batches.length; i += 4) {
    const results = await Promise.allSettled(batches.slice(i, i + 4).map(batch => sendRealtimeChannels(batch, params.name, params.data)));
    results.forEach(result => { if (result.status === "rejected") failures.push(result.reason); });
  }
  if (failures.length) throw new AggregateError(failures, "Realtime delivery failed");
}

async function sendRealtimeChannels(channels: string[], name: string, data: Record<string, unknown>) {
  const cfg = getConfig();
  const path = `/apps/${cfg.appId}/events`;
  let serializedData = JSON.stringify(data);
  if (name === "message:new" && Buffer.byteLength(serializedData, "utf8") >= 10_240) {
    // Large messages travel through the authenticated history API. Retain the
    // routing/id fields so clients hydrate them instead of losing the event.
    const invalidation = { ...data };
    for (const field of ["text", "cipherText", "iv", "encryptedKey", "systemPayload"]) delete invalidation[field];
    serializedData = JSON.stringify(invalidation);
  }
  const body = JSON.stringify({
    name,
    channels,
    data: serializedData,
  });
  const bodyMd5 = createHash("md5").update(body).digest("hex");
  const authQueryBase: Record<string, string> = {
    auth_key: cfg.key,
    auth_timestamp: Math.floor(Date.now() / 1000).toString(),
    auth_version: "1.0",
    body_md5: bodyMd5,
  };
  const signature = signRequest("POST", path, authQueryBase, cfg.secret);
  const authQuery = sortedQuery({ ...authQueryBase, auth_signature: signature });
  const url = `https://api-${cfg.cluster}.pusher.com${path}?${authQuery}`;

  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pusher error: ${res.status} ${text.slice(0, 180)}`);
  }
}

export function userPrivateChannel(userId: string) {
  return `private-user-${userId}`;
}
