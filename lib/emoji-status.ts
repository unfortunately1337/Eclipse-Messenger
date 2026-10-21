import catalog from "./emoji-status-catalog.json";

export type EmojiStatus = (typeof catalog)[number] & { preview?: string };
const categoryOrder: Record<string, number> = { Halloween: 0, GameEmoji: 1, MasksEmoji: 2, DuckEmoji: 3, NewsEmoji: 4, FinanceEmoji: 5, CursedMoji: 6 };
export const EMOJI_STATUS_CATALOG: readonly EmojiStatus[] = [...catalog].sort((a, b) => (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99));
const byId = new Map(catalog.map(entry => [entry.id, entry]));

export function getEmojiStatus(id: string | null | undefined): EmojiStatus | null {
  return id ? byId.get(id) ?? null : null;
}
