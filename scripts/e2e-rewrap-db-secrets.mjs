import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PREFIX = "enc:v1:";
const PREFIX_DET = "encdet:v1:";

function deriveKey(raw) {
  return createHash("sha256").update(raw).digest();
}

function encryptWithKey(plain, key, deterministic = false) {
  const iv = deterministic
    ? createHmac("sha256", key).update(plain).digest().subarray(0, 12)
    : randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  return `${deterministic ? PREFIX_DET : PREFIX}${payload}`;
}

function decryptWithKey(value, key) {
  if (!value.startsWith(PREFIX) && !value.startsWith(PREFIX_DET)) {
    return value;
  }
  const payload = value.startsWith(PREFIX_DET) ? value.slice(PREFIX_DET.length) : value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("invalid_payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

function tryDecrypt(value, key) {
  try {
    return { ok: true, plain: decryptWithKey(value, key) };
  } catch {
    return { ok: false, plain: null };
  }
}

async function rewrapTableColumn(input) {
  const {
    tableName,
    idColumn,
    valueColumn,
    deterministic,
    currentKey,
    oldKey,
    dryRun,
  } = input;

  const rows = await prisma.$queryRawUnsafe(`SELECT "${idColumn}" AS id, "${valueColumn}" AS value FROM "${tableName}" WHERE "${valueColumn}" IS NOT NULL`);
  let scanned = 0;
  let converted = 0;
  let currentReadable = 0;
  let unreadable = 0;

  for (const row of rows) {
    scanned += 1;
    const value = row.value;
    if (!value || typeof value !== "string") continue;
    if (!value.startsWith(PREFIX) && !value.startsWith(PREFIX_DET)) continue;

    const now = tryDecrypt(value, currentKey);
    if (now.ok) {
      currentReadable += 1;
      continue;
    }
    const legacy = tryDecrypt(value, oldKey);
    if (!legacy.ok || !legacy.plain) {
      unreadable += 1;
      continue;
    }
    const nextValue = encryptWithKey(legacy.plain, currentKey, deterministic);
    converted += 1;
    if (!dryRun) {
      await prisma.$executeRawUnsafe(
        `UPDATE "${tableName}" SET "${valueColumn}" = $1 WHERE "${idColumn}" = $2`,
        nextValue,
        row.id,
      );
    }
  }

  return { tableName, valueColumn, scanned, currentReadable, converted, unreadable };
}

async function run() {
  const currentRaw =
    process.env.E2E_DB_ENCRYPTION_KEY?.trim() ??
    process.env.E2E_BACKUP_ENCRYPTION_KEY?.trim();
  const oldRaw =
    process.env.OLD_E2E_DB_ENCRYPTION_KEY?.trim() ??
    process.env.OLD_E2E_BACKUP_ENCRYPTION_KEY?.trim();
  const dryRun = !process.argv.includes("--apply");

  if (!currentRaw) {
    throw new Error("Current E2E_DB_ENCRYPTION_KEY is required");
  }
  if (!oldRaw) {
    throw new Error("OLD_E2E_DB_ENCRYPTION_KEY is required");
  }

  const currentKey = deriveKey(currentRaw);
  const oldKey = deriveKey(oldRaw);
  const targets = [
    { tableName: "User", idColumn: "id", valueColumn: "publicKey", deterministic: true },
    { tableName: "User", idColumn: "id", valueColumn: "privateKeyBackupEnc", deterministic: false },
    { tableName: "UserE2EKey", idColumn: "id", valueColumn: "publicKey", deterministic: true },
    { tableName: "UserE2EKey", idColumn: "id", valueColumn: "privateKeyBackupEnc", deterministic: false },
    { tableName: "GroupE2EKeyMember", idColumn: "id", valueColumn: "encryptedKey", deterministic: false },
    { tableName: "ChannelE2EKeyMember", idColumn: "id", valueColumn: "encryptedKey", deterministic: false },
  ];

  console.log(`Rewrap mode: ${dryRun ? "dry-run" : "apply"}`);
  const results = [];
  for (const target of targets) {
    const result = await rewrapTableColumn({
      ...target,
      currentKey,
      oldKey,
      dryRun,
    });
    results.push(result);
    console.log(JSON.stringify(result));
  }

  const converted = results.reduce((acc, item) => acc + item.converted, 0);
  const unreadable = results.reduce((acc, item) => acc + item.unreadable, 0);
  console.log(`Done. converted=${converted} unreadable=${unreadable}`);
  if (unreadable > 0) {
    process.exitCode = 2;
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
