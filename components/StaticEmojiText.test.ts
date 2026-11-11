import React from "react";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/client/pack-items", () => ({ useEmojiEntry: () => undefined }));
import { renderStaticEmojiText } from "./StaticEmojiText";
it("leaves plain multilingual text intact without segmenting every character", () => {
  const spy = vi.spyOn(Intl.Segmenter.prototype, "segment");
  const text = "Привет, Hello, 世界. 123";
  expect(renderStaticEmojiText(text)).toEqual([text]);
  expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
});
it("preserves joined emoji, skin tones, flags and keycaps in static previews", () => {
  const nodes = renderStaticEmojiText("Hi 👨‍👩‍👧‍👦 👍🏽 1️⃣ 🇫🇷 end");
  const images = nodes.filter(React.isValidElement).filter(node => node.type === "img");
  expect(images.map(image => (image.props as { alt: string }).alt)).toEqual(["👨‍👩‍👧‍👦", "👍🏽", "1️⃣", "🇫🇷"]);
});
