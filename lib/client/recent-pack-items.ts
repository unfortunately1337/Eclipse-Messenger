import { DEFAULT_ANIMATED_EMOJIS } from "./default-animated-emojis";
import type { PackKind } from "@/lib/imported-packs";

export type RecentPackItems = Record<PackKind, string[]>;
export const emptyRecentPackItems = (): RecentPackItems => ({ emoji: [], sticker: [] });
const native = new Set<string>(DEFAULT_ANIMATED_EMOJIS);
export function parseRecentPackItems(raw: string | null): RecentPackItems {
  try {
    const value = JSON.parse(raw ?? "null");
    return Object.fromEntries((["emoji", "sticker"] as const).map(kind => [kind,
      Array.isArray(value?.[kind]) ? [...new Set<string>(value[kind].filter((id: unknown): id is string =>
        typeof id === "string" && (/^tg-[a-f0-9]{24}$/.test(id) || kind === "emoji" && native.has(id))))].slice(0, 48) : [],
    ])) as RecentPackItems;
  } catch { return emptyRecentPackItems(); }
}
export function recordRecentPackItem(previous: RecentPackItems, kind: PackKind, id: string): RecentPackItems {
  return parseRecentPackItems(JSON.stringify({ ...previous, [kind]: [id, ...previous[kind].filter(value => value !== id)] }));
}
