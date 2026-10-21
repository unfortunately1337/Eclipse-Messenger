import { afterEach, expect, it, vi } from "vitest";
import { encryptMessageForUsers, decryptMessageWithPrivateKey } from "./e2e";

afterEach(() => vi.restoreAllMocks());
it("encrypts ordinary messages without undefined Web Crypto BufferSource properties", async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const publicKey = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey)).toString("base64");
  for (const method of ["encrypt", "decrypt"] as const) {
    const native = crypto.subtle[method].bind(crypto.subtle);
    vi.spyOn(crypto.subtle, method).mockImplementation(async (algorithm, key, data) => {
      if (typeof algorithm === "object") {
        for (const property of ["additionalData", "label"]) if (property in algorithm) {
          const value = (algorithm as unknown as Record<string, unknown>)[property];
          if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) throw new TypeError(`${property}: Not a BufferSource`);
        }
      }
      return native(algorithm, key, data);
    });
  }
  const encrypted = await encryptMessageForUsers({ plainText: "Обычное сообщение", senderPublicKeyBase64: publicKey, recipientPublicKeyBase64: publicKey });
  for (const encryptedKey of [encrypted.encryptedKeyForSender, encrypted.encryptedKeyForRecipient]) {
    expect(await decryptMessageWithPrivateKey({ privateKey: pair.privateKey, ...encrypted, encryptedKey })).toBe("Обычное сообщение");
  }
});
it("preserves authenticated context for secret messages and rejects another chat context", async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const publicKey = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey)).toString("base64");
  const encrypted = await encryptMessageForUsers({ plainText: "Секретное сообщение", senderPublicKeyBase64: publicKey, recipientPublicKeyBase64: publicKey, context: "eclipse-secret-v2:test-chat" });
  expect(await decryptMessageWithPrivateKey({ privateKey: pair.privateKey, ...encrypted, encryptedKey: encrypted.encryptedKeyForRecipient, context: "eclipse-secret-v2:test-chat" })).toBe("Секретное сообщение");
  await expect(decryptMessageWithPrivateKey({ privateKey: pair.privateKey, ...encrypted, encryptedKey: encrypted.encryptedKeyForRecipient, context: "eclipse-secret-v2:another-chat" })).rejects.toThrow();
});
