import { z } from "zod";
import { isValidBase64Canonical } from "./e2e-crypto-validate";

// Validate the wire format, not the plaintext: only recipients can authenticate
// and decrypt the AES-GCM payload.
export const cipherTextSchema = z.string().min(24).max(1_200_000)
  .refine(isValidBase64Canonical, "Invalid ciphertext encoding")
  .refine((value) => Buffer.from(value, "base64").length >= 17, "Invalid ciphertext length");
export const messageIvSchema = z.string().length(16)
  .refine(isValidBase64Canonical, "Invalid IV encoding")
  .refine((value) => Buffer.from(value, "base64").length === 12, "Invalid IV length");
export const wrappedMessageKeySchema = z.string().min(344).max(1368)
  .refine(isValidBase64Canonical, "Invalid wrapped key encoding")
  .refine((value) => [256, 384, 512, 1024].includes(Buffer.from(value, "base64").length), "Invalid RSA wrapped key length");

export const directMessageEnvelopeSchema = z.object({
  cipherText: cipherTextSchema,
  iv: messageIvSchema,
  encryptedKeyForSender: wrappedMessageKeySchema,
  encryptedKeyForRecipient: wrappedMessageKeySchema,
  replyToMessageId: z.string().min(1).max(128).nullable().optional(),
  clientMessageId: z.string().trim().min(8).max(128).optional(),
});
