import { expect, it } from "vitest";
import { botMessageRequestSchema, botReplyMarkupSchema } from "./bot-api";
it("rejects reserved media payloads and ambiguous/oversized inline buttons", () => {
  expect(botMessageRequestSchema.safeParse({ chat_id: "chat", text: '__eclipse_media__:{"type":"image"}' }).success).toBe(false);
  for (const button of [{ text: "x", url: "javascript:alert(1)" }, { text: "x", callback_data: "😀".repeat(17) }, { text: "x", callback_data: "x", url: "https://example.org" }, { text: "x" }]) expect(botReplyMarkupSchema.safeParse({ inline_keyboard: [[button]] }).success).toBe(false);
  expect(botReplyMarkupSchema.safeParse({ inline_keyboard: [[{ text: "x", callback_data: "😀".repeat(16) }]] }).success).toBe(true);
});
