import { afterEach, describe, expect, it, vi } from "vitest";
import { ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT } from "../chat-message-transport";
import { clearChatMemoryCaches, decryptWithTextCache, readConversationMemoryCache, writeConversationMemoryCache } from "./chat-cache";
import { type ConversationCacheSnapshot } from "../types";

afterEach(() => clearChatMemoryCaches());

describe("chat cache lifetime after module extraction", () => {
  it("keeps cached conversation history isolated by account", () => {
    const snapshot: ConversationCacheSnapshot = {
      savedAt: Date.now(), selfId: "account-a",
      conversation: { conversationId: "conversation", chatType: "direct", messages: [] },
      messages: [],
    };
    writeConversationMemoryCache("account-a", "peer", "direct", snapshot);
    expect(readConversationMemoryCache("account-a", "peer", "direct")).toBe(snapshot);
    expect(readConversationMemoryCache("account-b", "peer", "direct")).toBeNull();
  });

  it("shares an in-flight decryption instead of decrypting the same payload twice", async () => {
    let resolve!: (text: string) => void;
    const decrypt = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    const first = decryptWithTextCache("same-payload", decrypt);
    const second = decryptWithTextCache("same-payload", decrypt);
    resolve("Содержимое сообщения");
    expect(await first).toBe("Содержимое сообщения");
    expect(await second).toBe("Содержимое сообщения");
    expect(decrypt).toHaveBeenCalledTimes(1);
  });

  it("does not repopulate plaintext after an account switch clears the cache", async () => {
    let resolve!: (text: string) => void;
    const pending = decryptWithTextCache("old-account", () => new Promise<string>(done => { resolve = done; }));
    clearChatMemoryCaches();
    resolve("Сообщение предыдущего аккаунта");
    expect(await pending).toBe(ENCRYPTED_MESSAGE_UNAVAILABLE_TEXT);
    expect(await decryptWithTextCache("old-account", async () => "Новое сообщение")).toBe("Новое сообщение");
  });
});
