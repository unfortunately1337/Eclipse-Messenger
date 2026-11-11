import { afterEach, expect, it, vi } from "vitest";
import { getEmojisInfo } from "./message-content";
afterEach(() => vi.restoreAllMocks());
it("does not segment ordinary messages, including non-Latin text", () => {
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
  for (const text of ["Обычный текст", "Plain message", "中文消息", "مرحبا بالعالم"]) expect(getEmojisInfo(text)).toEqual({ isOnly: false, count: 0 });
  expect(segment).not.toHaveBeenCalled();
});
it.each([["😀", 1], ["👨‍👩‍👧‍👦", 1], ["👍🏽 🇺🇦", 2], ["1️⃣", 1]])("preserves composed emoji detection for %s", (text, count) => {
  expect(getEmojisInfo(text)).toEqual({ isOnly: true, count });
});
it("does not treat mixed text as an emoji-only bubble", () => expect(getEmojisInfo("Привет 🙂")).toEqual({ isOnly: false, count: 0 }));
