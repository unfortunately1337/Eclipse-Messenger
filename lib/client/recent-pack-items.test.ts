import { expect, it } from "vitest";
import { emptyRecentPackItems, parseRecentPackItems, recordRecentPackItem } from "./recent-pack-items";

it("keeps emoji and sticker history separate and moves reused items to the front without duplicates", () => {
  const id = "tg-" + "a".repeat(24);
  let value = recordRecentPackItem(emptyRecentPackItems(), "emoji", "😀");
  value = recordRecentPackItem(value, "emoji", "❤️");
  value = recordRecentPackItem(value, "emoji", "😀");
  value = recordRecentPackItem(value, "sticker", id);
  expect(value).toEqual({ emoji: ["😀", "❤️"], sticker: [id] });
});
it("bounds persisted history and ignores malformed, executable or unsupported entries", () => {
  const ids = Array.from({ length: 70 }, (_, i) => "tg-" + i.toString(16).padStart(24, "0"));
  expect(parseRecentPackItems(JSON.stringify({ sticker: ids })).sticker).toHaveLength(48);
  expect(parseRecentPackItems(JSON.stringify({ emoji: [{ id: "x" }, "javascript:alert(1)", "text"], sticker: ["😀", null] }))).toEqual(emptyRecentPackItems());
  expect(parseRecentPackItems("broken")).toEqual(emptyRecentPackItems());
});
