import { expect, it } from "vitest";
import { renderedMessagesView, type RenderedMessagesViewContext } from "./message-viewport";

it.each([0, 800])("keeps call records separate from each other and adjacent ordinary messages at viewport height %s", messagesViewportHeight => {
  const messages = [
    { id: "call-one", senderId: "self", systemPayload: { eventType: "call" } },
    { id: "call-two", senderId: "self", systemPayload: { eventType: "call" } },
    { id: "file", senderId: "self" },
    { id: "text", senderId: "self" },
  ].map(value => ({ ...value, text: "Message", createdAt: "2026-11-11T09:41:00Z" }));
  const rows = renderedMessagesView({ selfId: "self", selfProfile: null, currentUserIdRef: { current: "self" }, messages, messagesViewportHeight, activeConversation: { chatType: "direct" }, messageVerticalOffset: 0, bannersHeight: 0, messageOffsets: { offsets: [0, 70, 140, 210] }, virtualMessages: messages.map((message, index) => ({ message, index, top: index * 70 })) } as unknown as RenderedMessagesViewContext);
  expect(rows.slice(0, 2).map(row => ({ previous: row.chainWithPrevious, next: row.chainWithNext, spacing: row.rowSpacingClassName }))).toEqual([
    { previous: false, next: false, spacing: "pb-2" },
    { previous: false, next: false, spacing: "pb-2" },
  ]);
  expect(rows[2].chainWithPrevious).toBe(false);
  expect(rows[2].chainWithNext).toBe(true);
});
