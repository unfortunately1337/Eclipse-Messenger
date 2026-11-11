import { expect, it } from "vitest";
import { messageDeletionOffset, type MessageDeletionShift } from "./message-deletion-layout";
const shift: MessageDeletionShift = { afterIndex: 1, shiftY: 130, rows: [{ id: "one", index: 1, height: 50 }, { id: "two", index: 4, height: 80 }] };
it("closes nonadjacent gaps by the sum of only the deleted rows above each surviving message", () => {
  expect(messageDeletionOffset(shift, 0)).toBe(0);
  expect(messageDeletionOffset(shift, 2)).toBe(50);
  expect(messageDeletionOffset(shift, 3)).toBe(50);
  expect(messageDeletionOffset(shift, 5)).toBe(130);
});
it("holds selected bubbles still while their particles disperse", () => {
  expect(messageDeletionOffset(shift, 1)).toBe(0);
  expect(messageDeletionOffset(shift, 4)).toBe(0);
  expect(messageDeletionOffset(null, 5)).toBe(0);
});
