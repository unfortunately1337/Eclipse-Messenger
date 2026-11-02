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
let version = 0;
export function emojiCatalogVersion() { return version; }
export function subscribeEmojiCatalog(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function registerImportedEmojis(entries: EmojiStatus[]) {
  let changed = false;
  for (const entry of entries) {
    if (!entry.packId || !/^tg-[a-f0-9]{24}$/.test(entry.id)) continue;
    if (JSON.stringify(byId.get(entry.id)) === JSON.stringify(entry)) continue;
    byId.set(entry.id, entry); importedIds.add(entry.id); changed = true;
  }
  if (changed) { version++; listeners.forEach(listener => listener()); }
}
export function clearImportedEmojiCatalog() {
  for (const id of importedIds) byId.delete(id);
  importedIds.clear(); version++; listeners.forEach(listener => listener());
}

export function getEmojiStatus(id: string | null | undefined): EmojiStatus | null {
  return id ? byId.get(id) ?? null : null;
}
