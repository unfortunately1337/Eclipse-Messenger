import { describe, expect, it } from "vitest";
import { singleStoryEmoji, storyColorToHsv, storyHsvToColor } from "./story-editor";
import { normalizeStoryOverlay, parseStoryOverlay, stringifyStoryOverlay } from "./story-overlay";

describe("story editor overlays", () => {
  it("recognizes one composed emoji and keeps multiple emoji static", () => {
    for (const value of ["❤️", "👨‍👩‍👧‍👦", "👍🏽", "🇷🇺", "1️⃣"]) expect(singleStoryEmoji(value)).toBe(value);
    for (const value of ["😀🔥", "hello", "😀 text", ""]) expect(singleStoryEmoji(value)).toBeNull();
  });
  it("preserves emoji layers across publication serialization", () => {
    const overlay = normalizeStoryOverlay({ texts: [{ id: "emoji", kind: "emoji", text: "🔥", x: .4, y: .6, size: 64 }] });
    expect(parseStoryOverlay(stringifyStoryOverlay(overlay))?.texts[0]).toMatchObject({ kind: "emoji", text: "🔥", x: .4, y: .6 });
  });
  it("preserves chosen fonts and expanded text and emoji sizes after publication", () => {
    const overlay = normalizeStoryOverlay({ texts: [
      { id: "small", text: "Мелкий текст", font: "georgia", size: 8 },
      { id: "large", text: "Big text", font: "tiktok", size: 384 },
      { id: "emoji", kind: "emoji", text: "🔥", size: 384 },
      { id: "legacy", text: "Legacy", font: "untrusted-font" },
    ] });
    const published = parseStoryOverlay(stringifyStoryOverlay(overlay));
    expect(published?.texts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "small", font: "georgia", size: 8 }),
      expect.objectContaining({ id: "large", font: "tiktok", size: 384 }),
      expect.objectContaining({ id: "emoji", kind: "emoji", size: 384 }),
      expect.objectContaining({ id: "legacy", font: "tiktok" }),
    ]));
  });
  it("round trips custom colors including gray, black and hue boundary", () => {
    for (const color of ["#ffffff", "#000000", "#808080", "#ff0000", "#3399cc", "#ab19ef"]) {
      const hsv = storyColorToHsv(color);
      expect(storyHsvToColor(hsv.h, hsv.s, hsv.v)).toBe(color);
    }
    expect(storyHsvToColor(360, 1, 1)).toBe("#ff0000");
  });
});
