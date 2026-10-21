import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  randomUUID,
} from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PREFIX = "enc:v1:";
const PREFIX_DET = "encdet:v1:";

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
  if (!raw) {
    throw new Error("E2E_DB_ENCRYPTION_KEY is required");
  }
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

function encryptAtRest(plain, options = {}) {
  if (!plain) return plain;
  const key = keyHash(getPrimaryDbRawKey());
  const deterministic = options.deterministic === true;
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

function encryptSharedKeyForUser(sharedKeyBase64, recipientPublicKeyBase64) {
  const wrapped = publicEncrypt(
    {
      key: Buffer.from(recipientPublicKeyBase64, "base64"),
      format: "der",
      type: "spki",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(sharedKeyBase64, "base64"),
  );
  return wrapped.toString("base64");
}

function generateSharedKeyBase64() {
  return randomBytes(32).toString("base64");
}

async function findBrokenGroups() {
  return prisma.$queryRawUnsafe(`
    WITH latest AS (
      SELECT DISTINCT ON ("groupId") gk."id", gk."groupId"
      FROM "GroupE2EKey" gk
      WHERE gk."status" = 'active'
      ORDER BY gk."groupId", gk."version" DESC, gk."createdAt" DESC
    ),
    members AS (
      SELECT gm."groupId", gm."userId" FROM "GroupMember" gm
      UNION
      SELECT g."id" AS "groupId", g."ownerId" AS "userId" FROM "Group" g
    )
    SELECT DISTINCT l."groupId"
    FROM latest l
    JOIN members m ON m."groupId" = l."groupId"
    LEFT JOIN "GroupE2EKeyMember" gkm
      ON gkm."groupKeyId" = l."id"
     AND gkm."userId" = m."userId"
    WHERE gkm."id" IS NULL
    ORDER BY l."groupId"
  `);
}

async function resolveUserPublicKeyCandidates(userIds) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, publicKey: true, privateKeyBackupEnc: true },
  });

  const keyRows = await prisma.userE2EKey.findMany({
    where: { userId: { in: userIds }, status: "active" },
    select: { userId: true, publicKey: true, privateKeyBackupEnc: true, version: true, createdAt: true },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });

  const activeByUser = new Map();
  for (const row of keyRows) {
    if (!activeByUser.has(row.userId)) activeByUser.set(row.userId, row);
  }

  const publicByUser = new Map();
  const repairedFromBackup = [];

  for (const userId of userIds) {
    const user = users.find((item) => item.id === userId);
    const active = activeByUser.get(userId) ?? null;
    const candidatePublics = [active?.publicKey, user?.publicKey].filter(Boolean);

    let publicKeyBase64 = null;
    for (const candidate of candidatePublics) {
      const decoded = decryptAtRest(candidate);
      if (decoded) {
        publicKeyBase64 = decoded;
        break;
      }
    }

    if (!publicKeyBase64) {
      const backupCandidates = [active?.privateKeyBackupEnc, user?.privateKeyBackupEnc].filter(Boolean);
      for (const backup of backupCandidates) {
        const privateKeyBase64 = decodePrivateBackup(backup);
        if (!privateKeyBase64) continue;
        const derivedPublic = derivePublicFromPrivate(privateKeyBase64);
        if (!derivedPublic) continue;
        publicKeyBase64 = derivedPublic;
        repairedFromBackup.push({ userId, publicKeyBase64 });
        break;
      }
    }

    publicByUser.set(userId, publicKeyBase64);
  }

  return { publicByUser, repairedFromBackup };
}

async function reconcileGroup(groupId) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, ownerId: true },
  });
  if (!group) return { groupId, updated: false, reason: "group_not_found" };

  const members = await prisma.$queryRawUnsafe(
    `
      SELECT DISTINCT "userId"
      FROM "GroupMember"
      WHERE "groupId" = $1
      UNION
      SELECT $2::text AS "userId"
    `,
    group.id,
    group.ownerId,
  );
  const userIds = members.map((item) => item.userId);

  const { publicByUser, repairedFromBackup } = await resolveUserPublicKeyCandidates(userIds);

  if (repairedFromBackup.length > 0) {
    await prisma.$transaction(
      repairedFromBackup.map((item) =>
        prisma.user.update({
          where: { id: item.userId },
          data: { publicKey: encryptAtRest(item.publicKeyBase64, { deterministic: true }) },
          select: { id: true },
        }),
      ),
    );
  }

  const missingPublic = userIds.filter((id) => !publicByUser.get(id));
  if (missingPublic.length > 0) {
    return { groupId, updated: false, reason: "missing_public_keys", missingPublic };
  }

  const sharedKeyBase64 = generateSharedKeyBase64();

  await prisma.$transaction(async (tx) => {
    const maxVersion = await tx.groupE2EKey.aggregate({
      where: { groupId: group.id },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    await tx.groupE2EKey.updateMany({
      where: { groupId: group.id, status: "active" },
      data: { status: "rotated", rotatedAt: new Date() },
    });

    const keyId = randomUUID();
    await tx.groupE2EKey.create({
      data: {
        id: keyId,
        groupId: group.id,
        version: nextVersion,
        status: "active",
        algorithm: "aes-256-gcm+wrapped-group-key",
        createdById: group.ownerId,
      },
    });

    for (const userId of userIds) {
      const encryptedKey = encryptSharedKeyForUser(sharedKeyBase64, publicByUser.get(userId));
      await tx.groupE2EKeyMember.create({
        data: {
          id: randomUUID(),
          groupKeyId: keyId,
          userId,
          encryptedKey: encryptAtRest(encryptedKey),
        },
      });
    }
  });

  return { groupId, updated: true, repairedPublicKeys: repairedFromBackup.length };
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const broken = await findBrokenGroups();
  console.log(`Broken groups: ${broken.length}`);

  if (dryRun) {
    console.log("Dry run mode. Use --apply to execute.");
    console.log(JSON.stringify(broken, null, 2));
    return;
  }

  const results = [];
  for (const row of broken) {
    const result = await reconcileGroup(row.groupId);
    results.push(result);
    console.log(JSON.stringify(result));
  }

  const updated = results.filter((item) => item.updated).length;
  const failed = results.filter((item) => !item.updated).length;
  console.log(`Reconcile complete. updated=${updated} failed=${failed}`);
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
