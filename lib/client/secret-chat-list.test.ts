import { expect, it } from "vitest";
import { buildChatSummaryKey, deduplicateChatSummaries } from "@/app/app/(chats)/chat-realtime-chatlist";

const chat = (id: string, time = "2026-10-15T00:00:00Z") => ({
  chatType: "direct" as const, link: `secret-${id}`, conversationId: `secret:${id}`,
  peerId: "same-peer", displayName: "Peer", lastMessage: "Секретный чат", lastMessageAt: time,
});
it("identifies a secret chat by its ID regardless of list representation", () => {
  expect(buildChatSummaryKey({ link: "secret-one" })).toBe(buildChatSummaryKey({ conversationId: "secret:one" }));
  expect(deduplicateChatSummaries([chat("one"), { ...chat("one"), link: "" }])).toHaveLength(1);
});
it("merges creation and refresh results without duplicating a secret chat", () => {
  const created = chat("one", "2026-10-15T00:00:01Z");
  const result = deduplicateChatSummaries([created, chat("one")]);
  expect(result).toHaveLength(1);
  expect(result[0].lastMessageAt).toBe(created.lastMessageAt);
});
it("keeps separate secret chats and a normal dialog with the same person", () => {
  expect(deduplicateChatSummaries([chat("one"), chat("two"), { ...chat("one"), link: "peer", conversationId: "normal" }])).toHaveLength(3);
});
it("repairs a secret route overwritten by a profile update, including a single cached chat", () => {
  const corrupted = { ...chat("one"), link: "peer" };
  expect(deduplicateChatSummaries([corrupted])[0].link).toBe("secret-one");
  const repaired = deduplicateChatSummaries([corrupted, { ...corrupted, conversationId: "normal" }]);
  expect(repaired.map(item => item.link).sort()).toEqual(["peer", "secret-one"]);
});
