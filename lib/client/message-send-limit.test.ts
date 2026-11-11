import { beforeEach, expect, it } from "vitest";
import { ApiRequestError } from "./api-error";
import { assertMessageCooldown, clearMessageCooldowns, messageRateLimit, rememberMessageCooldown } from "./message-send-limit";

beforeEach(clearMessageCooldowns);
it("recognizes only message quotas and preserves their server retry time", () => {
  expect(messageRateLimit(new Error("429"), 1000)).toBeNull();
  expect(messageRateLimit(new ApiRequestError("other limit", 429, {}), 1000)).toBeNull();
  expect(messageRateLimit(new ApiRequestError("wait", 429, { code: "MESSAGE_RATE_LIMIT", retryAfterSeconds: 2, scope: "account" }), 1000)).toEqual({ retryAt: 3000, scope: "account" });
});
it("prevents repeated API calls during a chat cooldown without blocking another chat", () => {
  rememberMessageCooldown("alice", "direct:bob", { retryAt: 5000, scope: "chat" });
  expect(() => assertMessageCooldown("alice", "direct:bob", 1000)).toThrow(ApiRequestError);
  expect(() => assertMessageCooldown("alice", "direct:charlie", 1000)).not.toThrow();
  expect(() => assertMessageCooldown("bob", "direct:bob", 1000)).not.toThrow();
  expect(() => assertMessageCooldown("alice", "direct:bob", 5000)).not.toThrow();
});
it("does not shorten an existing cooldown and honors account wide quotas", () => {
  rememberMessageCooldown("alice", "direct:bob", { retryAt: 8000, scope: "chat" });
  rememberMessageCooldown("alice", "direct:bob", { retryAt: 2000, scope: "chat" });
  rememberMessageCooldown("alice", "direct:charlie", { retryAt: 5000, scope: "account" });
  expect(() => assertMessageCooldown("alice", "channel:one", 4000)).toThrow();
  expect(() => assertMessageCooldown("alice", "direct:bob", 6000)).toThrow();
  clearMessageCooldowns();
  expect(() => assertMessageCooldown("alice", "direct:bob", 6000)).not.toThrow();
});
