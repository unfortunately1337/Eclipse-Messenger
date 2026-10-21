import { z } from "zod";

// Only this authenticated ciphertext crosses the server. The AES secret stays in
// the QR fragment and the two browsers, never in an HTTP query or Redis record.
export const qrKeyTransferSchema = z.object({
  version: z.literal(1),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  cipherText: z.string().min(24).max(256 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();
export type QrKeyTransfer = z.infer<typeof qrKeyTransferSchema>;
