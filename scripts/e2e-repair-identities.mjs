import { PrismaClient } from "@prisma/client";
import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "crypto";

const prisma = new PrismaClient();

const PREFIX = "enc:v1:";
const PREFIX_DET = "encdet:v1:";

function parseArgs() {
  const users = [];
  let forceReset = false;
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--user") {
      const value = process.argv[i + 1];
      if (value) {
        users.push(value);
        i += 1;
      }
      continue;
    }
    if (arg === "--force-reset") {
      forceReset = true;
    }
  }
  return { users, forceReset };
}

function parseFallbacks(...rawValues) {
  const values = [];
  for (const raw of rawValues) {
    if (!raw) continue;
    for (const item of raw.split(",")) {
      const value = item.trim();
      if (value.length > 0) values.push(value);
    }
  }
  return values;
}

function keyHash(raw) {
  return createHash("sha256").update(raw).digest();
}

function getPrimaryDbRawKey() {
  const raw = process.env.E2E_DB_ENCRYPTION_KEY?.trim() ?? process.env.E2E_BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("E2E_DB_ENCRYPTION_KEY is required");
  return raw;
}

function getDbKeyRing() {
  const primary = getPrimaryDbRawKey();
  const fallbacks = parseFallbacks(
    process.env.E2E_DB_ENCRYPTION_KEY_FALLBACKS,
    process.env.E2E_BACKUP_ENCRYPTION_KEY_FALLBACKS,
    process.env.OLD_E2E_DB_ENCRYPTION_KEY,
    process.env.OLD_E2E_BACKUP_ENCRYPTION_KEY,
  );
  const unique = new Set();
  const keys = [];
  for (const raw of [primary, ...fallbacks]) {
    if (unique.has(raw)) continue;
    unique.add(raw);
    keys.push(keyHash(raw));
  }
  return keys;
}

function encryptAtRest(plain, deterministic = false) {
  if (!plain) return plain;
  if (plain.startsWith(PREFIX) || plain.startsWith(PREFIX_DET)) return plain;
  const key = keyHash(getPrimaryDbRawKey());
  const iv = deterministic
    ? createHmac("sha256", key).update(plain).digest().subarray(0, 12)
    : randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  return `${deterministic ? PREFIX_DET : PREFIX}${payload}`;
}

function decryptAtRest(value) {
  if (!value) return null;
  if (!value.startsWith(PREFIX) && !value.startsWith(PREFIX_DET)) return value;
  const payload = value.startsWith(PREFIX_DET) ? value.slice(PREFIX_DET.length) : value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  for (const key of getDbKeyRing()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      // continue
    }
  }
  return null;
}

function decryptPrivateKeyBackup(payload) {
  const backupRaw = process.env.E2E_BACKUP_ENCRYPTION_KEY?.trim();
  if (!backupRaw) return null;
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const key = keyHash(backupRaw);
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

function decodePrivateBackup(value) {
  const dbDecrypted = decryptAtRest(value);
  if (!dbDecrypted) return null;
  const maybeLegacy = decryptPrivateKeyBackup(dbDecrypted);
  return maybeLegacy ?? dbDecrypted;
}

function derivePublicFromPrivate(privateKeyBase64) {
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyBase64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const publicKey = createPublicKey(privateKey);
    return publicKey.export({ format: "der", type: "spki" }).toString("base64");
  } catch {
    return null;
  }
}

function generateIdentityKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  return {
    publicKeyBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    privateKeyBase64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  };
}

function validateRsaKeyPair(publicKeyBase64, privateKeyBase64) {
  try {
    const probe = randomBytes(32);
    const encrypted = publicEncrypt(
      {
        key: Buffer.from(publicKeyBase64, "base64"),
        format: "der",
        type: "spki",
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      probe,
    );
    const decrypted = privateDecrypt(
      {
        key: Buffer.from(privateKeyBase64, "base64"),
        format: "der",
        type: "pkcs8",
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encrypted,
    );
    return probe.equals(decrypted);
  } catch {
    return false;
  }
}

async function findTargetUsers(explicitUsers) {
  if (explicitUsers.length > 0) {
    return [...new Set(explicitUsers)];
  }
  const rows = await prisma.$queryRawUnsafe(`
    WITH active_users AS (
      SELECT m."senderId" AS "userId" FROM "Message" m
      UNION
      SELECT cp."userId" FROM "ConversationParticipant" cp
      UNION
      SELECT gm."senderId" FROM "GroupMessage" gm
      UNION
      SELECT gm2."userId" FROM "GroupMember" gm2
      UNION
      SELECT cp2."authorId" FROM "ChannelPost" cp2
      UNION
      SELECT cs."userId" FROM "ChannelSubscriber" cs
    )
    SELECT DISTINCT u."id" AS "userId"
    FROM active_users au
    JOIN "User" u ON u."id" = au."userId"
    WHERE
      u."publicKey" IS NULL
      OR (
        u."privateKeyBackupEnc" IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "UserE2EKey" uk
          WHERE uk."userId" = u."id"
            AND uk."privateKeyBackupEnc" IS NOT NULL
        )
      )
  `);
  return rows.map((row) => row.userId);
}

async function repairUserIdentity(userId, forceReset) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, link: true, publicKey: true, privateKeyBackupEnc: true },
  });
  if (!user) return { userId, status: "skipped", reason: "user_not_found" };

  const keys = await prisma.userE2EKey.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { version: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      version: true,
      status: true,
      publicKey: true,
      privateKeyBackupEnc: true,
      createdAt: true,
    },
  });

  let privateKeyBase64 = null;
  let publicKeyBase64 = null;

  for (const key of keys) {
    privateKeyBase64 = decodePrivateBackup(key.privateKeyBackupEnc);
    if (privateKeyBase64) {
      publicKeyBase64 = derivePublicFromPrivate(privateKeyBase64);
      if (publicKeyBase64) break;
    }
  }

  if (!privateKeyBase64) {
    privateKeyBase64 = decodePrivateBackup(user.privateKeyBackupEnc);
    if (privateKeyBase64) {
      publicKeyBase64 = derivePublicFromPrivate(privateKeyBase64);
    }
  }

  if (!privateKeyBase64 || !publicKeyBase64) {
    if (!forceReset) {
      return { userId, link: user.link, status: "failed", reason: "missing_recoverable_private_key" };
    }
    const generated = generateIdentityKeyPair();
    privateKeyBase64 = generated.privateKeyBase64;
    publicKeyBase64 = generated.publicKeyBase64;
  }

  if (!validateRsaKeyPair(publicKeyBase64, privateKeyBase64)) {
    return { userId, link: user.link, status: "failed", reason: "invalid_key_pair" };
  }

  const publicKeyEnc = encryptAtRest(publicKeyBase64, true);
  const privateBackupEnc = encryptAtRest(privateKeyBase64, false);

  await prisma.$transaction(async (tx) => {
    await tx.userE2EKey.updateMany({
      where: { userId, status: "active" },
      data: { status: "rotated", isActive: false, rotatedAt: new Date() },
    });

    const maxVersion = await tx.userE2EKey.aggregate({
      where: { userId },
      _max: { version: true },
    });
    const existing = await tx.userE2EKey.findUnique({
      where: { userId_publicKey: { userId, publicKey: publicKeyEnc } },
      select: { version: true },
    });
    const nextVersion = existing?.version ?? ((maxVersion._max.version ?? 0) + 1);

    await tx.userE2EKey.upsert({
      where: { userId_publicKey: { userId, publicKey: publicKeyEnc } },
      update: {
        privateKeyBackupEnc: privateBackupEnc,
        status: "active",
        isActive: true,
        version: nextVersion,
        rotatedAt: null,
        revokedAt: null,
      },
      create: {
        userId,
        publicKey: publicKeyEnc,
        privateKeyBackupEnc: privateBackupEnc,
        version: nextVersion,
        status: "active",
        isActive: true,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        publicKey: publicKeyEnc,
        privateKeyBackupEnc: privateBackupEnc,
      },
    });
  });

  return {
    userId,
    link: user.link,
    status: "repaired",
    strategy: forceReset ? "restore_or_reset" : "restore",
  };
}

async function run() {
  const { users, forceReset } = parseArgs();
  const targetUsers = await findTargetUsers(users);
  if (targetUsers.length === 0) {
    console.log("No users to repair.");
    return;
  }

  console.log(`Repair targets: ${targetUsers.length}`);
  const results = [];
  for (const userId of targetUsers) {
    const result = await repairUserIdentity(userId, forceReset);
    results.push(result);
    console.log(JSON.stringify(result));
  }

  const repaired = results.filter((r) => r.status === "repaired").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`Repair complete. repaired=${repaired} failed=${failed} forceReset=${forceReset}`);

  if (failed > 0) {
    process.exitCode = 1;
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
