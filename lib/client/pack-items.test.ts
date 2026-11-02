import { beforeEach, expect, it, vi } from "vitest";
import type { ResolvedPackItem } from "./pack-items";

const fake = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./http", () => ({ apiRequest: fake.api }));

const id = "tg-" + "a".repeat(24);
const item = { id, packId: "pack-" + "b".repeat(24), title: "Pack", kind: "emoji", ordinal: 0, emoji: "😀", format: "tgs", src: "/asset", thumbnail: "/thumb", adaptive: false } satisfies ResolvedPackItem;
beforeEach(() => { vi.resetModules(); fake.api.mockReset(); });

it("shares a running resolution with emoji mounted after its request started", async () => {
  let finish!: (value: { items: ResolvedPackItem[] }) => void;
  fake.api.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { resolvePackItem } = await import("./pack-items");
  const first = resolvePackItem(id);
  await Promise.resolve();
  const later = resolvePackItem(id);
  await Promise.resolve();
  expect(fake.api).toHaveBeenCalledOnce();
  finish({ items: [item] });
  expect(await first).toEqual(item); expect(await later).toEqual(item);
  expect(await resolvePackItem(id)).toEqual(item);
  expect(fake.api).toHaveBeenCalledOnce();
});

it("bounds batches and resolves every consumer when the same item is missing", async () => {
  fake.api.mockResolvedValue({ items: [] });
  const { resolvePackItem } = await import("./pack-items");
  const ids = Array.from({ length: 205 }, (_, index) => "tg-" + index.toString(16).padStart(24, "0"));
  const result = await Promise.all([...ids.map(resolvePackItem), resolvePackItem(ids[0])]);
  expect(result.every(value => value === null)).toBe(true);
  expect(fake.api).toHaveBeenCalledTimes(3);
  expect(fake.api.mock.calls.every(([url]) => url.split("ids=")[1].split(",").length <= 100)).toBe(true);
  expect(await resolvePackItem(ids[0])).toBeNull();
  expect(fake.api).toHaveBeenCalledTimes(3);
});
