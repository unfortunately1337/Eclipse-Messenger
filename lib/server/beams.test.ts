import { afterEach, beforeEach, expect, it, vi } from "vitest";
const visible = vi.hoisted(() => vi.fn());
vi.mock("./notification-view", () => ({ isNotificationChatVisible: visible }));
import { publishBeamsMessageToUser } from "./beams";
const payload = { messageId: "message", chatId: "alice", senderId: "sender", senderName: "Alice", text: "hello", createdAt: new Date().toISOString() };
beforeEach(() => {
  vi.stubEnv("PUSHER_BEAMS_INSTANCE_ID", "test"); vi.stubEnv("PUSHER_BEAMS_SECRET_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  visible.mockReset().mockResolvedValue(false);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("does not publish a push when the recipient reads this chat on any device", async () => {
  visible.mockResolvedValue(true);
  await publishBeamsMessageToUser("reader", payload);
  expect(visible).toHaveBeenCalledWith("reader", "alice");
  expect(fetch).not.toHaveBeenCalled();
});
it("preserves delivery outside the chat and if temporary view storage is unavailable", async () => {
  await publishBeamsMessageToUser("reader", payload); expect(fetch).toHaveBeenCalledTimes(1);
  visible.mockRejectedValueOnce(new Error("unavailable"));
  await publishBeamsMessageToUser("reader", payload); expect(fetch).toHaveBeenCalledTimes(2);
});
