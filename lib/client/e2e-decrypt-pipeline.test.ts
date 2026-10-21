import { describe, expect, it, vi } from "vitest";
import {
  decryptDirectPayloadDeterministic,
  decryptSharedPayloadDeterministic,
  isValidDirectEncryptedPayload,
  isValidSharedEncryptedPayload,
} from "@/lib/client/e2e-decrypt-pipeline";

describe("e2e-decrypt-pipeline", () => {
  it("validates direct payload boundaries", () => {
    expect(
      isValidDirectEncryptedPayload({
        cipherText: "a".repeat(64),
        iv: "b".repeat(16),
        encryptedKey: "k".repeat(256),
      }),
    ).toBe(true);
    expect(isValidDirectEncryptedPayload({ cipherText: "", iv: "b", encryptedKey: "k" })).toBe(false);
    expect(isValidDirectEncryptedPayload({ cipherText: "a", iv: "", encryptedKey: "k" })).toBe(false);
    expect(isValidDirectEncryptedPayload({ cipherText: "a", iv: "b", encryptedKey: "" })).toBe(false);
  });

  it("validates shared payload boundaries", () => {
    expect(
      isValidSharedEncryptedPayload({
        cipherText: "a".repeat(64),
        iv: "b".repeat(16),
        keyVersion: 2,
      }),
    ).toBe(true);
    expect(isValidSharedEncryptedPayload({ cipherText: "a", iv: "b", keyVersion: 0 })).toBe(false);
    expect(isValidSharedEncryptedPayload({ cipherText: "a", iv: "b", keyVersion: null })).toBe(false);
  });

  it("uses direct fallback deterministically", async () => {
    const logger = vi.fn();
    const text = await decryptDirectPayloadDeterministic({
      payload: { cipherText: "c", iv: "i", encryptedKey: "k" },
      tryPrimary: async () => {
        throw new Error("primary");
      },
      tryFallback: async () => "fallback",
      fallbackText: "stub",
      logger,
    });
    expect(text).toBe("fallback");
    expect(logger).toHaveBeenCalled();
  });

  it("returns fallback text when shared key is absent", async () => {
    const text = await decryptSharedPayloadDeterministic({
      payload: { cipherText: "c", iv: "i", keyVersion: 4 },
      chatType: "group",
      chatLink: "abc",
      resolveKeyByVersion: () => null,
      fallbackText: "Сообщение",
      decryptWithKey: async () => "never",
    });
    expect(text).toBe("Сообщение");
  });

  it("decrypts shared payload after fetching missing version key", async () => {
    const text = await decryptSharedPayloadDeterministic({
      payload: { cipherText: "c", iv: "i", keyVersion: 7 },
      chatType: "channel",
      chatLink: "news",
      resolveKeyByVersion: () => null,
      fetchKeyByVersion: async (version) => (version === 7 ? "shared-key" : null),
      decryptWithKey: async (key) => `ok:${key}`,
      fallbackText: "stub",
    });
    expect(text).toBe("ok:shared-key");
  });
});
