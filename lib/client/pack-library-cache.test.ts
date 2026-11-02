import { expect, it } from "vitest";
import { mergePackSummary } from "./pack-library-cache";
import type { ImportedPack, PackItem } from "@/lib/imported-packs";

const items = Array.from({ length: 20 }, (_, ordinal) => ({ id: `item-${ordinal}`, ordinal })) as PackItem[];
const full: ImportedPack = { id: "pack", sourceName: "Example", title: "Example", kind: "emoji", count: 20, ready: true, installed: true, revision: "v1", items };
it("keeps full loaded packs stable across unchanged summary refreshes", () => {
  expect(mergePackSummary({ ...full, items: items.slice(0, 1) }, full)).toBe(full);
});
it("invalidates old loaded items when a pack is updated", () => {
  const updated = { ...full, revision: "v2", count: 30, items: items.slice(0, 1) };
  expect(mergePackSummary(updated, full)).toBe(updated);
});
it("updates membership without downloading the same pack again", () => {
  const result = mergePackSummary({ ...full, installed: false, items: items.slice(0, 1) }, full);
  expect(result.installed).toBe(false); expect(result.items).toBe(items);
});
