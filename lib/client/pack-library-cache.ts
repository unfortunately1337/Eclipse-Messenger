import type { ImportedPack } from "@/lib/imported-packs";

/** Reuse loaded items and object identity until the published pack changes. */
export function mergePackSummary(summary: ImportedPack, cached?: ImportedPack): ImportedPack {
  if (!cached || cached.revision !== summary.revision || cached.count !== summary.count) return summary;
  const same = cached.id === summary.id && cached.title === summary.title && cached.sourceName === summary.sourceName
    && cached.kind === summary.kind && cached.ready === summary.ready && cached.installed === summary.installed;
  if (cached.items.length >= summary.items.length && same) return cached;
  return cached.items.length === summary.count ? { ...summary, items: cached.items } : summary;
}
