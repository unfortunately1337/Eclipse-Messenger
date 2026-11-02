import { expect, it } from "vitest";
import { importedItemIdFromSrc, parseTelegramPackLink } from "./imported-packs";
it("extracts emoji and sticker links from ordinary messages", () => {
  expect(parseTelegramPackLink("Хочу этот https://t.me/addemoji/MasksEmoji пожалуйста" )).toEqual({ name: "MasksEmoji", kind: "emoji" });
  expect(parseTelegramPackLink("https://t.me/addstickers/DuckPack?x=1")).toEqual({ name: "DuckPack", kind: "sticker" });
  expect(parseTelegramPackLink("t.me/addemoji/MyPack")).toEqual({ name: "MyPack", kind: "emoji" });
});
it.each(["https://evil.test/t.me/addemoji/Test", "https://t.me.evil.test/addemoji/Test", "https://eviltelegram.me/addemoji/Test", "https://t.me/addemoji/../secret", "https://t.me/addemoji/" + "a".repeat(65)])("rejects lookalike or invalid pack links: %s", value => {
  expect(parseTelegramPackLink(value)).toBeNull();
});
it("recognizes only server-owned imported sticker URLs", () => {
  expect(importedItemIdFromSrc("/api/packs/assets/tg-0123456789abcdef01234567/original")).toBe("tg-0123456789abcdef01234567");
  expect(importedItemIdFromSrc("https://evil.test/api/packs/assets/tg-0123456789abcdef01234567/original")).toBeNull();
  expect(importedItemIdFromSrc("/api/packs/assets/../secret/original")).toBeNull();
});
