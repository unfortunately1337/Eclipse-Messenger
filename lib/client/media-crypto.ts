"use client";

import { cacheMediaBlobUrl, getCachedMediaUrl, hasCachedMediaUrl, invalidateCachedMediaUrl } from "./media-cache";

const PREFIX = "#eclipse-e2e=";
const aad = new TextEncoder().encode("eclipse-media-v1");
const pending = new Map<string, Promise<void>>();
const failures = new Map<string, number>();
const scopedUrls = new Map<string, Set<string>>();
const legacyRestoredUrls = new Map<string, string>();
let generation = 0;

async function fetchAttachment(url: string, requestedGeneration: number) {
  for (let attempt = 0; ; attempt += 1) {
    if (requestedGeneration !== generation) throw new Error("Account changed");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
      if (response.ok) return await response.arrayBuffer();
      if (attempt >= 2 || (response.status < 500 && response.status !== 429)) throw new Error("Attachment unavailable");
    } catch (error) {
      if (attempt >= 2 || (error instanceof Error && error.message === "Attachment unavailable")) throw error;
    } finally { clearTimeout(timer); }
    await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
  }
}

function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function decode(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
type Envelope = { v: 1; k: string; i: string; m: string; s: string; e: number | null };

export async function encryptMediaBlob(blob: Blob) {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, await blob.arrayBuffer());
  return {
    blob: new Blob([ciphertext], { type: "application/octet-stream" }),
    protectUrl(url: string, scope: string, expiresAt?: string | null) {
      const envelope: Envelope = { v: 1, k: encode(rawKey), i: encode(iv), m: blob.type || "application/octet-stream", s: scope, e: expiresAt ? Date.parse(expiresAt) : null };
      return url + PREFIX + encodeURIComponent(JSON.stringify(envelope));
    },
  };
}

function readEnvelope(src: string): Envelope | null {
  const index = src.indexOf(PREFIX);
  if (index < 0) return null;
  const path = src.slice(0, index);
  if (!path.startsWith("/media/") || path.startsWith("//") || src.length > 4000) throw new Error("Invalid encrypted attachment");
  const data = JSON.parse(decodeURIComponent(src.slice(index + PREFIX.length))) as Envelope;
  if (data.v !== 1 || decode(data.k).length !== 32 || decode(data.i).length !== 12 || typeof data.m !== "string" || typeof data.s !== "string" || (data.e !== null && (typeof data.e !== "number" || !Number.isFinite(data.e)))) throw new Error("Invalid encrypted attachment");
  // Never create an executable document from a decrypted attachment.
  if (!/^(image\/(jpeg|png|webp|gif|bmp|avif|heic|heif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)(;.*)?$/i.test(data.m)) data.m = "application/octet-stream";
  return data;
}

export function resolveEncryptedMediaUrl(src: string): string {
  if (!src.includes(PREFIX)) return getCachedMediaUrl(legacyRestoredUrls.get(src) ?? src);
  let envelope: Envelope;
  try { envelope = readEnvelope(src)!; } catch { return ""; }
  if (envelope.e !== null && envelope.e <= Date.now()) { invalidateCachedMediaUrl(src); return ""; }
  const scopeUrls = scopedUrls.get(envelope.s) ?? new Set<string>();
  scopeUrls.add(src); scopedUrls.set(envelope.s, scopeUrls);
  if (hasCachedMediaUrl(src)) return getCachedMediaUrl(src);
  if (!pending.has(src) && Date.now() - (failures.get(src) ?? 0) > 15_000) {
    const currentGeneration = generation;
    const run = (async () => {
      const bytes = await fetchAttachment(src.slice(0, src.indexOf(PREFIX)), currentGeneration);
      const key = await crypto.subtle.importKey("raw", decode(envelope.k), "AES-GCM", false, ["decrypt"]);
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(envelope.i), additionalData: aad }, key, bytes);
      if (currentGeneration !== generation || (envelope.e !== null && envelope.e <= Date.now())) return;
      const url = URL.createObjectURL(new Blob([plaintext], { type: envelope.m }));
      cacheMediaBlobUrl(src, url);
      window.dispatchEvent(new Event("eclipse:media-ready"));
    })().catch(() => { failures.set(src, Date.now()); }).finally(() => { pending.delete(src); });
    pending.set(src, run);
  }
  return "";
}

export function clearEncryptedMedia(scope?: string) {
  generation += 1;
  if (scope) {
    for (const src of scopedUrls.get(scope) ?? []) invalidateCachedMediaUrl(src);
    scopedUrls.delete(scope);
  } else {
    for (const urls of scopedUrls.values()) for (const src of urls) invalidateCachedMediaUrl(src);
    scopedUrls.clear();
    legacyRestoredUrls.clear();
  }
  failures.clear();
}

export function markLegacyMediaRestored(src: string) {
  if (legacyRestoredUrls.has(src)) return;
  legacyRestoredUrls.set(src, `${src}${src.includes("?") ? "&" : "?"}acl=restored`);
  window.dispatchEvent(new Event("eclipse:media-ready"));
}

export function collectLegacyMediaUrls(text: string): string[] {
  if (!text.startsWith("__eclipse_media__:")) return [];
  try {
    const payload = JSON.parse(text.slice("__eclipse_media__:".length));
    const values = [payload.src, payload.url, payload.coverUrl, ...(Array.isArray(payload.items) ? payload.items.map((item: { src?: string }) => item.src) : [])];
    return [...new Set(values.filter((value): value is string => typeof value === "string" && value.startsWith("/media/") && !value.includes(PREFIX)))];
  } catch { return []; }
}

// Only display copies are rewritten. The original message remains portable and editable.
export function resolveMessageMedia<T extends { kind: string }>(parsed: T): T {
  const value = parsed as T & { src?: string; url?: string; coverUrl?: string; items?: Array<{ src: string }> };
  return { ...value,
    ...(typeof value.src === "string" ? { src: resolveEncryptedMediaUrl(value.src) } : {}),
    ...(typeof value.url === "string" ? { url: resolveEncryptedMediaUrl(value.url) } : {}),
    ...(typeof value.coverUrl === "string" ? { coverUrl: resolveEncryptedMediaUrl(value.coverUrl) } : {}),
    ...(value.items ? { items: value.items.map(item => ({ ...item, src: resolveEncryptedMediaUrl(item.src) })) } : {}),
  };
}

// Await decryption before copying an attachment into another conversation.
export async function loadEncryptedMediaBlob(src: string): Promise<Blob> {
  let url = resolveEncryptedMediaUrl(src);
  if (!url) { await pending.get(src); url = resolveEncryptedMediaUrl(src); }
  if (!url) throw new Error("Не удалось загрузить вложение для пересылки");
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Не удалось загрузить вложение для пересылки");
  return response.blob();
}
