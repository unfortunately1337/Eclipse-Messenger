import { expect, it } from "vitest";
import { parsePackUsage, emptyPackUsage } from "./pack-usage";
it("keeps valid per-kind counts and ignores malformed storage", () => {
  const id = "pack-" + "a".repeat(24);
  expect(parsePackUsage(JSON.stringify({ emoji: { default: 3, [id]: 7, bogus: 15 }, sticker: { default: 1, [id]: -3 } }))).toEqual({ emoji: { default: 3, [id]: 7 }, sticker: {} });
  expect(parsePackUsage("broken")).toEqual(emptyPackUsage());
});
