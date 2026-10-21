import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getBackupKey() {
  const raw = process.env.E2E_BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("E2E_BACKUP_ENCRYPTION_KEY должен быть задан");
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptPrivateKeyBackup(plainPrivateKeyBase64: string) {
  const key = getBackupKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainPrivateKeyBase64, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptPrivateKeyBackup(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid E2E backup payload");
  }

  const key = getBackupKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
