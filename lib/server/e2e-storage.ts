import { decryptAtRest, encryptAtRest } from "@/lib/server/db-crypto";

export function encryptPublicKeyForDb(publicKey: string) {
  return encryptAtRest(publicKey, { deterministic: true });
}

export function decryptPublicKeyFromDb(value: string | null) {
  if (!value) return null;
  try {
    return decryptAtRest(value);
  } catch {
    return null;
  }
}

export function encryptE2ESecretForDb(value: string) {
  return encryptAtRest(value);
}

export function decryptE2ESecretFromDb(value: string | null) {
  if (!value) return null;
  try {
    return decryptAtRest(value);
  } catch {
    return null;
  }
}
