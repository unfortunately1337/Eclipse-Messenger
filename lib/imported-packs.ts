export const IMPORTER_BOT_LINK = "importbot";
export const IMPORTER_BOT_TITLE = "Stickers & Emoji Importer";
export const IMPORTER_BOT_AVATAR = "/brand/importbot.svg";
export type PackKind = "emoji" | "sticker";
export type PackItem = {
  id: string; packId: string; ordinal: number; emoji: string; format: "tgs" | "webm" | "webp";
  src: string; thumbnail: string; adaptive: boolean;
};
export type ImportedPack = {
  id: string; sourceName: string; title: string; kind: PackKind; count: number;
  ready: boolean; installed: boolean; items: PackItem[];
  revision?: string;
};
export type ImportCard = {
  packId: string; title: string; kind: PackKind; count: number;
  status: "confirm" | "queued" | "importing" | "ready" | "failed" | "cancelled";
  completed: number; error?: string;
  update?: boolean; packCount?: number;
};

/** Extract one actual Telegram pack URL; never fetch arbitrary user-supplied hosts. */
export function parseTelegramPackLink(text: string): { name: string; kind: PackKind } | null {
  const match = text.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(addemoji|addstickers)\/([A-Za-z][A-Za-z0-9_]{0,63})(?=$|[\s/?#.,!;)\]])/i);
  if (!match || (match.index && /[A-Za-z0-9_.@/-]/.test(text[match.index - 1]))) return null;
  return { name: match[2], kind: match[1].toLowerCase() === "addemoji" ? "emoji" : "sticker" };
}
export function importedItemIdFromSrc(src: string): string | null {
  return /^\/api\/packs\/assets\/(tg-[a-f0-9]{24})\/(?:original|thumbnail)$/.exec(src)?.[1] ?? null;
}
export function importedEmojiToken(itemId: string) { return `\uE000${itemId}\uE001`; }
