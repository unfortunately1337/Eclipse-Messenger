import { expect, it } from "vitest";
import { getMessageTailColor } from "./message-surface";
it("uses the actual gradient end instead of an unrelated preset tail color", () => {
  expect(getMessageTailColor({ backgroundImage: "linear-gradient(180deg, #e15d78 0%, #c94f71 100%)", "--tail-color": "#ef5a78" } as Parameters<typeof getMessageTailColor>[0])).toBe("#c94f71");
  expect(getMessageTailColor({ background: "linear-gradient(135deg,#f43f5e,#e11d48)" })).toBe("#e11d48");
});
it("preserves solid themes and the default white message", () => {
  expect(getMessageTailColor({ backgroundColor: "#ef5a78" })).toBe("#ef5a78");
  expect(getMessageTailColor()).toBe("#ffffff");
});
