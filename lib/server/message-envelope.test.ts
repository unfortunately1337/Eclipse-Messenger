import { describe, expect, it } from "vitest";
import { directMessageEnvelopeSchema } from "./message-envelope";

const envelope = {
  cipherText: Buffer.alloc(32, 1).toString("base64"),
  iv: Buffer.alloc(12, 2).toString("base64"),
  encryptedKeyForSender: Buffer.alloc(256, 3).toString("base64"),
  encryptedKeyForRecipient: Buffer.alloc(256, 4).toString("base64"),
};

describe("encrypted message wire format", () => {
  it("accepts the current RSA-2048 / AES-GCM format", () => {
    expect(directMessageEnvelopeSchema.parse(envelope)).toEqual(envelope);
  });
  it("rejects plaintext-only messages", () => {
    expect(directMessageEnvelopeSchema.safeParse({ text: "secret" }).success).toBe(false);
  });
  it.each([
    { iv: Buffer.alloc(16).toString("base64") },
    { cipherText: "not encrypted but a long string" },
    { cipherText: Buffer.alloc(16).toString("base64") },
    { encryptedKeyForRecipient: Buffer.alloc(32).toString("base64") },
  ])("rejects malformed envelopes: %j", (change) => {
    expect(directMessageEnvelopeSchema.safeParse({ ...envelope, ...change }).success).toBe(false);
  });
  it("does not retain a plaintext side channel", () => {
    expect(directMessageEnvelopeSchema.parse({ ...envelope, text: "leak" })).not.toHaveProperty("text");
  });
});
