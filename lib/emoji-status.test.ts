import { expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { EMOJI_STATUS_CATALOG, getEmojiStatus } from "./emoji-status";
import sharp from "sharp";

it.skipIf(!existsSync(`public${EMOJI_STATUS_CATALOG[0].animation}`))("bundles unique custom emoji IDs with local animations and thumbnails", () => {
  expect(new Set(EMOJI_STATUS_CATALOG.map(entry => entry.id)).size).toBe(EMOJI_STATUS_CATALOG.length);
  expect(new Set(EMOJI_STATUS_CATALOG.map(entry => entry.category))).toEqual(new Set([
    "Halloween", "GameEmoji", "MasksEmoji", "DuckEmoji", "NewsEmoji", "FinanceEmoji", "CursedMoji",
  ]));
  for (const entry of EMOJI_STATUS_CATALOG) {
    expect(entry.id).toMatch(/^tg-[a-f0-9]{24}$/);
    expect(entry.animation).toMatch(/^\/custom-emoji\/[A-Za-z]+\/\d+\.tgs$/);
    expect(existsSync(`public${entry.thumbnail}`)).toBe(true);
    const data = JSON.parse(gunzipSync(readFileSync(`public${entry.animation}`), { maxOutputLength: 4 * 1024 * 1024 }).toString());
    expect(data.op).toBeGreaterThan(data.ip);
    expect(data.assets?.some((asset: { p?: string; u?: string }) => asset.p || asset.u) ?? false).toBe(false);
    expect(getEmojiStatus(entry.id)).toBe(entry);
  }
  expect(getEmojiStatus("../anything.tgs")).toBeNull();
}, 15_000);

it.skipIf(!existsSync(`public${EMOJI_STATUS_CATALOG[0].preview}`))("has complete lightweight previews so no selectable emoji uses a missing image", async () => {
  for (const entry of EMOJI_STATUS_CATALOG) {
    expect(entry.preview).toMatch(/^\/custom-emoji\/[A-Za-z]+\/\d+\.picker-hq-v1\.webp$/);
    const preview = await sharp(`public${entry.preview}`, { animated: true }).metadata();
    expect(preview.width).toBe(96);
    expect(preview.height! % 96).toBe(0);
    expect((preview.pages ?? 1)).toBeLessThanOrEqual(72);
    expect(entry.animation).not.toBe("/custom-emoji/NewsEmoji/042.tgs");
  }
}, 15_000);

it("excludes removed packs and paints Masks white", () => {
  expect(EMOJI_STATUS_CATALOG.slice(0, 40).every(entry => entry.category === "Halloween")).toBe(true);
  expect(EMOJI_STATUS_CATALOG[40].category).not.toBe("Halloween");
  expect(EMOJI_STATUS_CATALOG.some(entry => ["EmojiStatus", "NeonEmoji", "AdaptiveEmojiStatus"].includes(entry.category))).toBe(false);
  expect(EMOJI_STATUS_CATALOG.filter(entry => entry.category === "MasksEmoji").every(entry => entry.adaptive)).toBe(true);
  expect(EMOJI_STATUS_CATALOG.filter(entry => entry.animation.includes("/GameIcons/")).every(entry => entry.category === "GameEmoji" && entry.adaptive)).toBe(true);
  expect(EMOJI_STATUS_CATALOG.filter(entry => entry.animation.includes("/GhostEmoji/")).every(entry => entry.category === "Halloween")).toBe(true);
  expect(EMOJI_STATUS_CATALOG.filter(entry => entry.animation.includes("/CreepyEmoji/")).every(entry => entry.category === "CursedMoji")).toBe(true);
  expect(EMOJI_STATUS_CATALOG.some(entry => entry.animation.includes("/HalloweenIcons/"))).toBe(false);
});
