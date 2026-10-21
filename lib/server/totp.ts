import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

function getEncryptionKey() {
  const raw =
    process.env.TOTP_ENCRYPTION_KEY?.trim() ||
    process.env.E2E_DB_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (!raw && process.env.NODE_ENV === "production") throw new Error("A TOTP encryption key must be configured in production");
  return createHash("sha256").update(raw || "eclipse-fallback-totp-encryption-key-2026").digest();
}

function encrypt(text: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decrypt(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted TOTP payload");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

export function generateTotpSecret() {
  return authenticator.generateSecret();
}

export function getTotpUri(secret: string, accountLabel: string) {
  const issuer = process.env.TOTP_ISSUER ?? "Eclipse";
  return authenticator.keyuri(accountLabel, issuer, secret);
}

export async function getTotpQrDataUrl(uri: string) {
  return QRCode.toDataURL(uri, {
    margin: 1,
    width: 256,
  });
}

export function verifyTotpToken(secret: string, token: string) {
  return authenticator.check(token, secret);
}

export function encryptTotpSecret(secret: string) {
  return encrypt(secret);
}

export function decryptTotpSecret(secretEnc: string) {
  return decrypt(secretEnc);
}
