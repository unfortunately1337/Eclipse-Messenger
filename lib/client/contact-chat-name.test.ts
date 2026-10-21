import { expect, it } from "vitest";
import { applyIncomingDirectChatPreview } from "@/app/app/(chats)/chat-realtime-message-updates";
import { deduplicateChatSummaries } from "@/app/app/(chats)/chat-realtime-chatlist";

const contact = { chatType: "direct" as const, conversationId: "direct:one", peerId: "peer", link: "peer", displayName: "My contact", contactAlias: "My contact", lastMessage: "old", lastMessageAt: "2026-10-15T00:00:00Z", lastMessageMine: false };

it("preserves a contact name when a realtime message carries the public profile name", () => {
  const result = applyIncomingDirectChatPreview([contact], { id: "new", link: "peer", senderId: "peer", displayName: "Public name", previewText: "new message", createdAt: "2026-10-15T01:00:00Z", isOwnMessage: false });
  expect(result[0]?.displayName).toBe("My contact");
  expect(result[0]?.lastMessage).toBe("new message");
});

it("preserves the known contact alias when merging a newer realtime summary", () => {
  const newer = { ...contact, contactAlias: undefined, displayName: "Public name", lastMessageAt: "2026-10-15T01:00:00Z" };
  expect(deduplicateChatSummaries([contact, newer])[0]?.displayName).toBe("My contact");
});

it("allows explicit contact removal to restore the public name", () => {
  const newer = { ...contact, contactAlias: null, displayName: "Public name", lastMessageAt: "2026-10-15T01:00:00Z" };
  expect(deduplicateChatSummaries([contact, newer])[0]?.displayName).toBe("Public name");
});
