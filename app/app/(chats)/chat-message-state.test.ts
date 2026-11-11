import { expect, it } from "vitest";
import { appendAndSortMessages, finalizeOptimisticMessage, getMessageSelectionNeighbors, mergeMessageWindow } from "./chat-message-state";
const at = "2026-11-01T00:00:00.000Z";

it("groups selected rows using absolute history indices after virtual scrolling", () => {
  const history = Array.from({ length: 200 }, (_, index) => ({ id: String(index) }));
  const selected = new Set(["148", "149", "150"]);
  // A window showing rows 149..160 still has a selected predecessor off-screen.
  expect(getMessageSelectionNeighbors(history, 149, selected)).toEqual({ previous: true, next: true });
  expect(getMessageSelectionNeighbors(history, 150, selected)).toEqual({ previous: true, next: false });
  expect(getMessageSelectionNeighbors(history, 0, selected)).toEqual({ previous: false, next: false });
  expect(getMessageSelectionNeighbors(history, 199, selected)).toEqual({ previous: false, next: false });
  expect(getMessageSelectionNeighbors([], 0, selected)).toEqual({ previous: false, next: false });
});
type Message = { id: string; createdAt: string; senderId: string; text: string; localId?: string; pending?: boolean; sendFailure?: { kind: string; retryAt: number } };
const pending: Message = { id: "optimistic:one", localId: "optimistic:one", createdAt: at, pending: true, senderId: "self", text: "😀" };
const echo: Message = { id: "server-one", createdAt: "2026-11-01T00:00:00.100Z", senderId: "self", text: "😀" };
it("keeps one stable row when a bot refresh arrives before the send response", () => {
  const merged = mergeMessageWindow([pending], [echo]);
  expect(merged).toHaveLength(1); expect(merged[0]).toMatchObject({ id: echo.id, localId: pending.localId, pending: false });
  const finalized = finalizeOptimisticMessage({ prev: merged, nextMessage: echo, optimisticMessageId: pending.id });
  expect(finalized).toHaveLength(1); expect(finalized[0].localId).toBe(pending.localId);
  expect(mergeMessageWindow(finalized, [echo])[0].localId).toBe(pending.localId);
});
it("does not re-use a single pending row for two legitimate identical sends", () => {
  const pendingTwo = { ...pending, id: "optimistic:two", localId: "optimistic:two" };
  const merged = mergeMessageWindow([pending, pendingTwo], [echo, { ...echo, id: "server-two" }]);
  expect(merged).toHaveLength(2); expect(merged.map(value => value.localId)).toEqual([pending.localId, pendingTwo.localId]);
});
it("never swallows another sender's message or an old message with the same content", () => {
  expect(mergeMessageWindow([pending], [{ ...echo, senderId: "other" }])).toHaveLength(2);
  expect(mergeMessageWindow([pending], [{ ...echo, createdAt: "2026-10-30T00:00:00.000Z" }])).toHaveLength(2);
});
it("does not mistake a restored failed draft for the confirmation of another identical send", () => {
  const failed = { ...echo, id: "failed", localId: "failed", pending: false, sendFailure: { kind: "rate_limit", retryAt: 5000 } };
  expect(mergeMessageWindow([pending], [failed])).toHaveLength(2);
  expect(appendAndSortMessages([pending], failed)).toHaveLength(2);
});
it("clears the failure marker after a manual retry is confirmed while preserving the row key", () => {
  const failed = { ...pending, pending: false, sendFailure: { kind: "rate_limit", retryAt: 5000 } };
  const confirmed = finalizeOptimisticMessage<Message>({ prev: [failed], nextMessage: echo, optimisticMessageId: failed.id });
  expect(confirmed).toHaveLength(1);
  expect(confirmed[0]).toMatchObject({ id: echo.id, localId: failed.localId, pending: false, sendFailure: undefined });
});
