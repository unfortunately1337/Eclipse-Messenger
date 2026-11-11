import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import type { DecryptedMessage } from "@/app/app/(chats)/types";
import { clearFailedMessages, readFailedMessages, removeFailedMessage, saveFailedMessage } from "./failed-message-store";
const message: DecryptedMessage = { id: "retry-id", localId: "retry-id", senderId: "alice", text: "pending payload", createdAt: "2026-11-11T00:00:00Z", pending: false, sendFailure: { kind: "rate_limit", retryAt: 6000 } };
beforeEach(clearFailedMessages);
it("restores the original payload and id only in the owning account and conversation", async () => {
  await saveFailedMessage("alice", "direct:bob", message);
  expect(await readFailedMessages("alice", "direct:bob")).toEqual([message]);
  expect(await readFailedMessages("bob", "direct:bob")).toEqual([]);
  expect(await readFailedMessages("alice", "group:bob")).toEqual([]);
  await removeFailedMessage(message.id);
  expect(await readFailedMessages("alice", "direct:bob")).toEqual([]);
});
it("keeps secret chat content out of the general failed message store", async () => {
  await saveFailedMessage("alice", "direct:secret-one", message);
  expect(await readFailedMessages("alice", "direct:secret-one")).toEqual([]);
});
it("removes persisted drafts on logout/cache clearing", async () => {
  await saveFailedMessage("alice", "direct:bob", message);
  await clearFailedMessages();
  expect(await readFailedMessages("alice", "direct:bob")).toEqual([]);
});
it("cannot resurrect a failed draft when deletion races its persistence", async () => {
  const write = saveFailedMessage("alice", "direct:bob", message);
  const remove = removeFailedMessage(message.id);
  await Promise.all([write, remove]);
  expect(await readFailedMessages("alice", "direct:bob")).toEqual([]);
});
it("finishes old writes before clearing and preserves saves started after clearing", async () => {
  const write = saveFailedMessage("alice", "direct:bob", message);
  const clear = clearFailedMessages();
  const next = saveFailedMessage("bob", "direct:alice", { ...message, id: "bob-message", senderId: "bob" });
  await Promise.all([write, clear, next]);
  expect(await readFailedMessages("alice", "direct:bob")).toEqual([]);
  expect(await readFailedMessages("bob", "direct:alice")).toHaveLength(1);
});
