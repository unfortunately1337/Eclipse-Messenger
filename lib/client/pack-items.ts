"use client";
import { useEffect, useSyncExternalStore } from "react";
import { apiRequest } from "./http";
import { emojiCatalogVersion, getEmojiStatus, registerImportedEmojis, subscribeEmojiCatalog } from "@/lib/emoji-status";
import type { PackItem } from "@/lib/imported-packs";

export type ResolvedPackItem = PackItem & { title: string; kind: string };
const items = new Map<string, ResolvedPackItem>();
const missing = new Map<string, number>();
const pending = new Map<string, Array<(item: ResolvedPackItem | null) => void>>();
const inFlight = new Set<string>();
let scheduled = false;
export function registerPackItems(values: ResolvedPackItem[]) {
  for (const value of values) items.set(value.id, value);
  registerImportedEmojis(values.filter(value => value.kind === "emoji").map(value => ({
    id: value.id, emoji: value.emoji, animation: value.src, thumbnail: value.thumbnail,
    name: value.title, nameEn: value.title, keywords: `${value.title} ${value.emoji}`, category: value.packId,
    packTitle: value.title, adaptive: value.adaptive, packId: value.packId, format: value.format,
  })));
}
async function flush() {
  scheduled = false;
  const batch = [...pending.keys()].filter(id => !inFlight.has(id)).slice(0, 100);
  if (!batch.length) return;
  batch.forEach(id => inFlight.add(id));
  try {
    const response = await apiRequest<{ items: ResolvedPackItem[] }>(`/api/packs/resolve?ids=${batch.join(",")}`);
    registerPackItems(response.items);
  } catch { /* All callers below share the same missing-item retry window. */ }
  for (const id of batch) {
    const item = items.get(id) ?? null;
    if (!item) missing.set(id, Date.now());
    const listeners = pending.get(id) ?? [];
    pending.delete(id); inFlight.delete(id);
    listeners.forEach(listener => listener(item));
  }
  if ([...pending.keys()].some(id => !inFlight.has(id)) && !scheduled) { scheduled = true; queueMicrotask(() => { void flush(); }); }
}
export function resolvePackItem(id: string): Promise<ResolvedPackItem | null> {
  if (!/^tg-[a-f0-9]{24}$/.test(id)) return Promise.resolve(null);
  const cached = items.get(id); if (cached) return Promise.resolve(cached);
  if (Date.now() - (missing.get(id) ?? 0) < 30_000) return Promise.resolve(null);
  return new Promise(resolve => {
    const listeners = pending.get(id) ?? []; listeners.push(resolve); pending.set(id, listeners);
    if (!scheduled) { scheduled = true; queueMicrotask(() => { void flush(); }); }
  });
}
export function useEmojiEntry(id: string | null | undefined) {
  useSyncExternalStore(subscribeEmojiCatalog, emojiCatalogVersion, () => 0);
  const entry = getEmojiStatus(id);
  useEffect(() => { if (id && !entry) void resolvePackItem(id); }, [id, entry]);
  return entry;
}
export function openImportedPack(detail: { packId?: string; itemId?: string }) {
  window.dispatchEvent(new CustomEvent("eclipse:open-pack", { detail }));
}
