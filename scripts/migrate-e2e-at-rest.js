const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const PREFIX = "enc:v1:";
const PREFIX_DET = "encdet:v1:";

function getDbKey() {
  const raw = (process.env.E2E_DB_ENCRYPTION_KEY || process.env.E2E_BACKUP_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new Error("E2E_DB_ENCRYPTION_KEY is required for migration");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function isEncrypted(value) {
  return value.startsWith(PREFIX) || value.startsWith(PREFIX_DET);
}

function encryptAtRest(plain, options = {}) {
  if (!plain || isEncrypted(plain)) return plain;
  const key = getDbKey();
  const deterministic = options.deterministic === true;
  const iv = deterministic
    ? crypto.createHmac("sha256", key).update(plain).digest().subarray(0, 12)
    : crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  return `${deterministic ? PREFIX_DET : PREFIX}${payload}`;
}

async function migrateUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, publicKey: true, privateKeyBackupEnc: true },
  });
  let updated = 0;
  for (const user of users) {
    const nextPublicKey = user.publicKey ? encryptAtRest(user.publicKey, { deterministic: true }) : null;
    const nextPrivateKeyBackup = user.privateKeyBackupEnc ? encryptAtRest(user.privateKeyBackupEnc) : null;
    if (nextPublicKey === user.publicKey && nextPrivateKeyBackup === user.privateKeyBackupEnc) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        publicKey: nextPublicKey,
        privateKeyBackupEnc: nextPrivateKeyBackup,
      },
      select: { id: true },
    });
    updated += 1;
  }
  return updated;
}

async function migrateUserE2EKeys() {
  const rows = await prisma.userE2EKey.findMany({
    select: { id: true, publicKey: true, privateKeyBackupEnc: true },
  });
  let updated = 0;
  for (const row of rows) {
    const nextPublicKey = encryptAtRest(row.publicKey, { deterministic: true });
    const nextPrivateKeyBackup = encryptAtRest(row.privateKeyBackupEnc);
    if (nextPublicKey === row.publicKey && nextPrivateKeyBackup === row.privateKeyBackupEnc) continue;
    await prisma.userE2EKey.update({
      where: { id: row.id },
      data: {
        publicKey: nextPublicKey,
        privateKeyBackupEnc: nextPrivateKeyBackup,
      },
      select: { id: true },
    });
    updated += 1;
  }
  return updated;
}

async function migrateGroupKeys() {
  const rows = await prisma.groupE2EKeyMember.findMany({
    select: { id: true, encryptedKey: true },
  });
  let updated = 0;
  for (const row of rows) {
    const nextEncrypted = encryptAtRest(row.encryptedKey);
    if (nextEncrypted === row.encryptedKey) continue;
    await prisma.groupE2EKeyMember.update({
      where: { id: row.id },
      data: { encryptedKey: nextEncrypted },
      select: { id: true },
    });
    updated += 1;
  }
  return updated;
}

async function migrateChannelKeys() {
  const rows = await prisma.channelE2EKeyMember.findMany({
    select: { id: true, encryptedKey: true },
  });
  let updated = 0;
  for (const row of rows) {
    const nextEncrypted = encryptAtRest(row.encryptedKey);
    if (nextEncrypted === row.encryptedKey) continue;
    await prisma.channelE2EKeyMember.update({
      where: { id: row.id },
      data: { encryptedKey: nextEncrypted },
      select: { id: true },
    });
    updated += 1;
  }
  return updated;
}

async function main() {
  console.log("Starting E2E at-rest migration...");
  const userUpdated = await migrateUsers();
  const userKeyUpdated = await migrateUserE2EKeys();
  const groupUpdated = await migrateGroupKeys();
  const channelUpdated = await migrateChannelKeys();
  console.log("Migration complete.");
  console.log({
    usersUpdated: userUpdated,
    userE2EKeysUpdated: userKeyUpdated,
    groupKeyMembersUpdated: groupUpdated,
    channelKeyMembersUpdated: channelUpdated,
  });
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
