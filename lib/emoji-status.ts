import catalog from "./emoji-status-catalog.json";

export type EmojiStatus = {
  id: string; emoji: string; animation: string; thumbnail: string; keywords: string; category: string;
  name: string; nameEn: string; packTitle: string; adaptive: boolean; preview?: string;
  packId?: string; format?: "tgs" | "webm" | "webp";
};
const categoryOrder: Record<string, number> = { GameEmoji: 0, MasksEmoji: 1, DuckEmoji: 2, NewsEmoji: 3, FinanceEmoji: 4, CursedMoji: 5 };
export const EMOJI_STATUS_CATALOG: readonly EmojiStatus[] = [...catalog].sort((a, b) => (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99));
const byId = new Map<string, EmojiStatus>(catalog.map(entry => [entry.id, entry]));
const importedIds = new Set<string>();
const listeners = new Set<() => void>();
const entryListeners = new Map<string, Set<() => void>>();
let version = 0;
export function emojiCatalogVersion() { return version; }
export function subscribeEmojiCatalog(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function subscribeEmojiEntry(id: string | null | undefined, listener: () => void) {
  if (!id) return () => {};
  const subscribers = entryListeners.get(id) ?? new Set<() => void>();
  subscribers.add(listener); entryListeners.set(id, subscribers);
  return () => { subscribers.delete(listener); if (!subscribers.size) entryListeners.delete(id); };
}
function notifyEntries(ids: Iterable<string>) {
  for (const id of ids) entryListeners.get(id)?.forEach(listener => listener());
}
export function registerImportedEmojis(entries: EmojiStatus[]) {
  const changed = new Set<string>();
  for (const entry of entries) {
    if (!entry.packId || !/^tg-[a-f0-9]{24}$/.test(entry.id)) continue;
    const previous = byId.get(entry.id);
    const keys = Object.keys(entry) as (keyof EmojiStatus)[];
    if (previous && keys.length === Object.keys(previous).length && keys.every(key => Object.is(previous[key], entry[key]))) continue;
    byId.set(entry.id, entry); importedIds.add(entry.id); changed.add(entry.id);
  }
  if (changed.size) { version++; notifyEntries(changed); listeners.forEach(listener => listener()); }
}
export function clearImportedEmojiCatalog() {
  const removed = [...importedIds];
  for (const id of importedIds) byId.delete(id);
  importedIds.clear(); version++; notifyEntries(removed); listeners.forEach(listener => listener());
}

export function getEmojiStatus(id: string | null | undefined): EmojiStatus | null {
  return id ? byId.get(id) ?? null : null;
}
