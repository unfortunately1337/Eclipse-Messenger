import { expect, it } from "vitest";
import { hasActiveSecretChatWithPeer } from "./secret-chat-state";

it("blocks both a pending invitation and a live secret chat for the same peer", () => {
  expect(hasActiveSecretChatWithPeer([{ conversationId: "secret:one", peerId: "peer", expiresAt: null }], "peer")).toBe(true);
  expect(hasActiveSecretChatWithPeer([{ link: "secret-one", peerId: "peer", expiresAt: "2026-10-16T00:00:00Z" }], "peer", Date.parse("2026-10-15T00:00:00Z"))).toBe(true);
});

it("ignores expired secret chats, ordinary chats and other peers", () => {
  const chats = [
    { conversationId: "secret:expired", peerId: "peer", expiresAt: "2026-10-14T00:00:00Z" },
    { conversationId: "normal", link: "peer", peerId: "peer" },
    { conversationId: "secret:other", peerId: "other" },
  ];
  expect(hasActiveSecretChatWithPeer(chats, "peer", Date.parse("2026-10-15T00:00:00Z"))).toBe(false);
});
