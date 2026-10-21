import { expect, it } from "vitest";
import { pinIndicator, pinScopeKey } from "./message-pins";

it("limits indicators to three without limiting the number of pinned messages", () => {
  expect(pinIndicator(1, 0)).toEqual({ segments: 1, active: 0 });
  expect(pinIndicator(2, 1)).toEqual({ segments: 2, active: 1 });
  expect(pinIndicator(3, 2)).toEqual({ segments: 3, active: 2 });
  expect(pinIndicator(150, 149)).toEqual({ segments: 3, active: 2 });
});
it("keeps scopes separate even when different kinds of chat share the same id", () => {
  expect(pinScopeKey(null)).toBe("");
  expect(pinScopeKey({ chatType: "group", chatId: "id" })).not.toBe(pinScopeKey({ chatType: "channel", chatId: "id" }));
});
