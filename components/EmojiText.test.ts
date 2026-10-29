import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./InlineEmoji", () => ({ InlineEmoji: (props: { emoji?: string; id?: string }) => React.createElement("span", props) }));
import { renderEmojiText } from "./EmojiText";

describe("message emoji rendering", () => {
  it("keeps ordinary multilingual text intact without creating per-grapheme nodes", () => {
    const text = "Привет! Hello, 世界. https://eclpse.ru 123";
    expect(renderEmojiText(text)).toEqual([text]);
  });
  it("preserves joined emoji and skin tones as single animated emoji", () => {
    const nodes = renderEmojiText("Hi 👨‍👩‍👧‍👦 👍🏽 1️⃣ 🇫🇷 end");
    const emojis = nodes.filter(React.isValidElement).map(node => (node.props as { emoji?: string }).emoji).filter(Boolean);
    expect(emojis).toEqual(["👨‍👩‍👧‍👦", "👍🏽", "1️⃣", "🇫🇷"]);
  });
  it("does not lose unknown custom tokens or adjacent plain text", () => {
    const text = "before \uE000unknown\uE001 after";
    expect(renderEmojiText(text)).toEqual([text]);
  });
});
