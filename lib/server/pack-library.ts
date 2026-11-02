import type { ImportedPack as DbPack, ImportedPackItem } from "@prisma/client";
import type { ImportedPack, PackItem, PackKind } from "@/lib/imported-packs";
export const packMetadataSelect = { id: true, sourceName: true, title: true, kind: true, count: true, ready: true, updatedAt: true } as const;
export const packItemMetadataSelect = { id: true, packId: true, ordinal: true, emoji: true, format: true, adaptive: true, published: true } as const;
type PackItemMetadata = Pick<ImportedPackItem, keyof typeof packItemMetadataSelect>;
export function packItemView(item: PackItemMetadata): PackItem {
  return { id: item.id, packId: item.packId, ordinal: item.ordinal, emoji: item.emoji, format: item.format as PackItem["format"], adaptive: item.adaptive,
    src: `/api/packs/assets/${item.id}/original`, thumbnail: `/api/packs/assets/${item.id}/thumbnail` };
}
export function packView(pack: Pick<DbPack, keyof typeof packMetadataSelect> & { items: PackItemMetadata[] }, installed: boolean): ImportedPack {
  return { id: pack.id, sourceName: pack.sourceName, title: pack.title, kind: pack.kind as PackKind, count: pack.count, ready: pack.ready, installed, revision: pack.updatedAt.toISOString(), items: pack.items.filter(item => item.published).map(packItemView) };
}
