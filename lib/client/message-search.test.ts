import { describe, expect, it } from "vitest";
import { messageSearchNeedle, messageSearchRanges } from "./message-search";

describe("literal message search highlights", () => {
  it("only searches from three trimmed characters", () => {
    for (const query of ["", "а", "аб", "  аб  "]) {
      expect(messageSearchNeedle(query)).toBe("");
      expect(messageSearchRanges("абв", query)).toEqual([]);
    }
    expect(messageSearchNeedle("  АБВ  ")).toBe("абв");
  });
  it("matches Cyrillic regardless of case and returns source offsets", () => {
    expect(messageSearchRanges("Привет, ПРИВЕТ!", "привет")).toEqual([{ start: 0, end: 6 }, { start: 8, end: 14 }]);
  });
  it("treats regular-expression and markup characters literally", () => {
    expect(messageSearchRanges("a.*b [test] <script>", ".*b")).toEqual([{ start: 1, end: 4 }]);
    expect(messageSearchRanges("[test]", "[test]")).toEqual([{ start: 0, end: 6 }]);
  });
  it("preserves UTF-16 offsets around emoji", () => {
    expect(messageSearchRanges("👋 hello 👋", "hello")).toEqual([{ start: 3, end: 8 }]);
  });
  it("ignores empty/whitespace queries and bounds highlighting work", () => {
    expect(messageSearchRanges("text", "  ")).toEqual([]);
    expect(messageSearchRanges("a".repeat(10000), "aaa")).toHaveLength(500);
  });
});
