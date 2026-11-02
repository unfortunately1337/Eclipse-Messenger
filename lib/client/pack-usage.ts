import type { PackKind } from "@/lib/imported-packs";
export type PackUsage = Record<PackKind, Record<string, number>>;
export const emptyPackUsage = (): PackUsage => ({ emoji: {}, sticker: {} });
export function parsePackUsage(raw: string | null): PackUsage {
  try {
    const value = JSON.parse(raw ?? "null"), result = emptyPackUsage();
    for (const kind of ["emoji", "sticker"] as const) {
      if (!value?.[kind] || typeof value[kind] !== "object" || Array.isArray(value[kind])) continue;
      for (const [id, count] of Object.entries(value[kind]).slice(0, 201)) {
        if ((/^pack-[a-f0-9]{24}$/.test(id) || kind === "emoji" && id === "default") && typeof count === "number" && Number.isSafeInteger(count) && count > 0) result[kind][id] = count;
      }
    }
    return result;
  } catch { return emptyPackUsage(); }
}
