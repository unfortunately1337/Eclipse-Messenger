import { expect, it } from "vitest";
import { areMessageRowPropsEqual, type MessageRowProps } from "./message-row-equality";
const message = { id: "one", senderId: "alice", text: "hello", createdAt: "2026-11-11T00:00:00Z" };
const make = (): MessageRowProps => ({ row: { message, index: 0, top: 0, chainWithPrevious: false, chainWithNext: false, showDateSeparator: true, rowSpacingClassName: "pb-2" }, shared: { removingMessageIds: new Set(), deletingShift: null } as MessageRowProps["shared"] });
it("does not rebuild unchanged bubbles when a virtual window moves their outer position", () => {
  const a = make(), b = { ...a, row: { ...a.row, top: 100 } };
  expect(areMessageRowPropsEqual(a, b, [])).toBe(true);
  expect(areMessageRowPropsEqual(a, { ...b, row: { ...b.row, message: { ...message, text: "edited" } } }, [])).toBe(false);
});
it("updates grouping, callbacks and read state rather than retaining stale interaction closures", () => {
  const a = make();
  expect(areMessageRowPropsEqual(a, { ...a, row: { ...a.row, chainWithNext: true } }, [])).toBe(false);
  expect(areMessageRowPropsEqual(a, { ...a, shared: { ...a.shared, deleteMessage: async () => {} } }, ["deleteMessage"])).toBe(false);
});
it("only updates the deleted bubble, leaving cumulative gap motion to its outer wrapper", () => {
  const a = make();
  expect(areMessageRowPropsEqual(a, { ...a, shared: { ...a.shared, removingMessageIds: new Set(["other"]) } }, ["removingMessageIds"])).toBe(true);
  expect(areMessageRowPropsEqual(a, { ...a, shared: { ...a.shared, removingMessageIds: new Set(["one"]) } }, ["removingMessageIds"])).toBe(false);
});
