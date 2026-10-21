"use client";

import { z } from "zod";
import { qrKeyTransferSchema, type QrKeyTransfer } from "@/lib/qr-key-transfer";
import {
  getE2EScopeGeneration, loadBackupSecret, loadPasswordMasterKey, loadStoredE2EKeyPairs,
  setActiveE2EUserId, storeBackupSecret, storeE2EIdentityFromBase64,
  storeE2EKeyPairToKeyring, storePasswordMasterKey, validateE2EKeyPairBase64,
} from "@/lib/client/e2e";
import { resolveE2EIdentity } from "@/lib/client/e2e-identity";
import { ensureE2EOwnerScope } from "@/lib/client/e2e-server-sync";

const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
const bytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const secretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const keySchema = z.object({ publicKeyBase64: z.string().min(20).max(20000), privateKeyBase64: z.string().min(20).max(20000) });
const bundleSchema = z.object({
  version: z.literal(1), userId: z.string().min(1).max(200), activePublicKey: z.string().min(20).max(20000),
  keys: z.array(keySchema).min(1).max(64),
  passwordMaster: z.string().optional(), backupSecret: z.string().optional(),
});

export function createQrKeySecret() {
  return base64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importTransferKey(secret: string) {
  secretSchema.parse(secret);
  return crypto.subtle.importKey("raw", bytes(secret.replace(/-/g, "+").replace(/_/g, "/") + "="), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptQrKeyTransfer(token: string, secret: string): Promise<QrKeyTransfer> {
  const identity = await resolveE2EIdentity();
  const generation = getE2EScopeGeneration();
  const userId = await ensureE2EOwnerScope();
  if (generation !== getE2EScopeGeneration()) throw new Error("Account changed during QR approval");
  const payload = bundleSchema.parse({
    version: 1, userId, activePublicKey: identity.publicKeyBase64,
    keys: loadStoredE2EKeyPairs(), passwordMaster: loadPasswordMasterKey() ?? undefined,
    backupSecret: loadBackupSecret() ?? undefined,
  });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherText = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`eclipse:qr-keys:v1:${token}`) }, await importTransferKey(secret), new TextEncoder().encode(JSON.stringify(payload)));
  if (generation !== getE2EScopeGeneration()) throw new Error("Account changed during QR approval");
  return qrKeyTransferSchema.parse({ version: 1, iv: base64(iv), cipherText: base64(new Uint8Array(cipherText)) });
}

export async function restoreQrKeyTransfer(token: string, secret: string, transfer: QrKeyTransfer, userId: string) {
  const generation = getE2EScopeGeneration();
  const envelope = qrKeyTransferSchema.parse(transfer);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(envelope.iv), additionalData: new TextEncoder().encode(`eclipse:qr-keys:v1:${token}`) }, await importTransferKey(secret), bytes(envelope.cipherText));
  const payload = bundleSchema.parse(JSON.parse(new TextDecoder().decode(plain)));
  if (payload.userId !== userId || !payload.keys.some(key => key.publicKeyBase64 === payload.activePublicKey)) throw new Error("QR key transfer belongs to another account");
  for (const value of [payload.passwordMaster, payload.backupSecret]) {
    if (value && (bytes(value).length !== 32 || base64(bytes(value)) !== value)) throw new Error("Invalid backup secret");
  }
  // Validate the entire bundle before writing anything, including the active pair.
  for (const pair of payload.keys) {
    if (!await validateE2EKeyPairBase64(pair)) throw new Error("Invalid QR key pair");
  }
  if (generation !== getE2EScopeGeneration()) throw new Error("Account changed during QR key transfer");
  setActiveE2EUserId(userId);
  for (const pair of payload.keys) storeE2EKeyPairToKeyring({ ...pair, makeActive: false });
  if (payload.passwordMaster) storePasswordMasterKey(payload.passwordMaster);
  if (payload.backupSecret) storeBackupSecret(payload.backupSecret);
  await storeE2EIdentityFromBase64(payload.keys.find(key => key.publicKeyBase64 === payload.activePublicKey)!);
}
