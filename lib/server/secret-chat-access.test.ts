import { describe, expect, it } from "vitest";
import { requireSecretChatAccess } from "./secret-chat-access";

const chat = {
  isApproved: true,
  expiresAt: new Date(Date.now() + 60000),
  participants: [
    { userId: "alice", acceptedSessionId: "alice-session" },
    { userId: "bob", acceptedSessionId: "bob-session" },
  ],
};

describe("secret chat authorization", () => {
  it("allows a participant's accepted session", () => {
    expect(requireSecretChatAccess(chat, "alice", "alice-session").userId).toBe("alice");
  });
  it("rejects an outsider and a different session of a participant", () => {
    expect(() => requireSecretChatAccess(chat, "eve", "eve-session")).toThrow();
    expect(() => requireSecretChatAccess(chat, "alice", "another-session")).toThrow();
  });
  it("rejects expired chats even if cleanup has not run", () => {
    expect(() => requireSecretChatAccess({ ...chat, expiresAt: new Date(0) }, "alice", "alice-session", true)).toThrow();
  });
  it("allows viewing an invitation but not sending before acceptance", () => {
    const pending = { ...chat, isApproved: false, expiresAt: null, participants: [{ userId: "bob", acceptedSessionId: null }] };
    expect(requireSecretChatAccess(pending, "bob", "bob-session", true).userId).toBe("bob");
    expect(() => requireSecretChatAccess(pending, "bob", "bob-session")).toThrow();
  });
  it("rejects approved chats without a deadline or accepted participant", () => {
    expect(() => requireSecretChatAccess({ ...chat, expiresAt: null }, "alice", "alice-session", true)).toThrow();
    expect(() => requireSecretChatAccess({ ...chat, participants: [{ userId: "bob", acceptedSessionId: null }] }, "bob", "bob-session", true)).toThrow();
  });
});
