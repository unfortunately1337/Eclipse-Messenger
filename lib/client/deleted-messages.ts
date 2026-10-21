"use client";

// IDs only: survive a reload while an older network/cache snapshot is still in flight.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const key = (userId: string) => `eclipse:cache:deleted-messages:v1:${userId}`;
export function readDeletedMessages(userId: string | null): Map<string, number> {
  if (!userId || typeof window === "undefined") return new Map();
  try {
    const values: unknown = JSON.parse(window.localStorage.getItem(key(userId)) ?? "[]");
    if (!Array.isArray(values)) return new Map();
    return new Map(values.filter((item): item is [string, number] =>
      Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "number" && item[1] > Date.now()));
  } catch { return new Map(); }
}
export function saveDeletedMessages(userId: string | null, values: Map<string, number>) {
  if (!userId || typeof window === "undefined") return;
  try { window.localStorage.setItem(key(userId), JSON.stringify([...values].filter(([, expiry]) => expiry > Date.now()).slice(-5000))); } catch { /* Storage may be full or unavailable. */ }
}
export function deletedMessageExpiry() { return Date.now() + TTL_MS; }
