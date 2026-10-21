import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

const PREFIX = "enc:v1:";
const PREFIX_DET = "encdet:v1:";

type DbKeyMaterial = {
  raw: string;
  key: Buffer;
};

function parseFallbacks(...rawValues: Array<string | undefined>) {
  const values: string[] = [];
  for (const raw of rawValues) {
    if (!raw) continue;
    for (const item of raw.split(",")) {
      const value = item.trim();
      if (value.length > 0) values.push(value);
    }
  }
  return values;
}

function toDbKey(raw: string): DbKeyMaterial {
  return {
    raw,
    key: createHash("sha256").update(raw).digest(),
  };
}

function getPrimaryDbKey() {
  const raw =
    process.env.E2E_DB_ENCRYPTION_KEY?.trim() ||
    process.env.E2E_BACKUP_ENCRYPTION_KEY?.trim() ||
    process.env.MEDIA_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (!raw && process.env.NODE_ENV === "production") throw new Error("A database encryption key must be configured in production");
  return toDbKey(raw || "eclipse-fallback-e2e-db-key-material-2026-safe-default");
}

function getDbKeyRing() {
  const primary = getPrimaryDbKey();
  const fallbacks = parseFallbacks(
    process.env.E2E_DB_ENCRYPTION_KEY_FALLBACKS,
    process.env.E2E_BACKUP_ENCRYPTION_KEY_FALLBACKS,
    process.env.OLD_E2E_DB_ENCRYPTION_KEY,
    process.env.OLD_E2E_BACKUP_ENCRYPTION_KEY,
  );

  const unique = new Set<string>();
  const keyRing: DbKeyMaterial[] = [];
  for (const raw of [primary.raw, ...fallbacks]) {
    if (unique.has(raw)) continue;
    unique.add(raw);
    keyRing.push(toDbKey(raw));
  }
  return keyRing;
}

function isEncryptedValue(value: string) {
  return value.startsWith(PREFIX) || value.startsWith(PREFIX_DET);
}

export function encryptAtRest(plain: string, options?: { deterministic?: boolean }) {
  if (!plain) return plain;
  if (isEncryptedValue(plain)) return plain;

  const key = getPrimaryDbKey().key;
  const deterministic = options?.deterministic === true;
  const iv = deterministic
    ? createHmac("sha256", key).update(plain).digest().subarray(0, 12)
    : randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  return `${deterministic ? PREFIX_DET : PREFIX}${payload}`;
}

function decryptPayloadWithKey(payload: string, key: Buffer) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid DB encryption payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

export function decryptAtRest(value: string) {
  if (!value) return value;
  if (!isEncryptedValue(value)) return value;

  const payload = value.startsWith(PREFIX_DET) ? value.slice(PREFIX_DET.length) : value.slice(PREFIX.length);
  let lastError: unknown = null;
  for (const candidate of getDbKeyRing()) {
    try {
      return decryptPayloadWithKey(payload, candidate.key);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unable to decrypt DB payload with configured keyring");
}
