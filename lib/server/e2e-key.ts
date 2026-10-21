import { prisma } from "@/lib/server/prisma";
import { redis } from "@/lib/server/redis";
import { decryptPrivateKeyBackup } from "@/lib/server/e2e-backup";
import {
  decryptE2ESecretFromDb,
  decryptPublicKeyFromDb,
  encryptE2ESecretForDb,
  encryptPublicKeyForDb,
} from "@/lib/server/e2e-storage";

function maybeDecryptLegacyBackup(value: string | null) {
  if (!value) return null;
  if (!value.includes(".")) return value;
  const parts = value.split(".");
  if (parts.length !== 3) return value;
  try {
    return decryptPrivateKeyBackup(value);
  } catch {
    return value;
  }
}

function redisKey(userId: string) {
  return `e2e:public-key:${userId}`;
}

export function isPrismaSchemaMismatch(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === "P2021" || code === "P2022";
}

function isLifecycleColumnMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code !== "P2022" && code !== "P2010") return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return message.includes("status") || message.includes("version") || message.includes("algorithm");
}

export async function getUserPublicKey(userId: string) {
  // Invariant:
  // - PostgreSQL is the source of truth for long-lived identity keys.
  // - Redis can only be a cache layer and must never be the only source.
  try {
    const cached = await redis.get(redisKey(userId)).catch(() => null);
    if (cached) return cached;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { publicKey: true },
    });

    if (user?.publicKey) {
      const value = decryptPublicKeyFromDb(user.publicKey);
      if (value) {
        void redis.set(redisKey(userId), value, "EX", 60 * 10).catch(() => {});
        return value;
      }
      // Corrupted/undecryptable legacy value in User.publicKey:
      // continue with UserE2EKey fallback instead of returning null.
    }
    let active: { publicKey: string } | null = null;
    try {
      active = await prisma.userE2EKey.findFirst({
        where: { userId, status: "active" },
        select: { publicKey: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      });
    } catch (error) {
      if (!isLifecycleColumnMissing(error)) throw error;
      active = await prisma.userE2EKey.findFirst({
        where: { userId, isActive: true },
        select: { publicKey: true },
        orderBy: { createdAt: "desc" },
      });
    }
    if (active?.publicKey) {
      const value = decryptPublicKeyFromDb(active.publicKey);
      if (value) {
        void redis.set(redisKey(userId), value, "EX", 60 * 10).catch(() => {});
      }
      return value;
    }
  } catch (error) {
    // If schema/model is out of date, do not silently fall back to Redis as source-of-truth.
    if (isPrismaSchemaMismatch(error)) return null;
    throw error;
  }
  return null;
}

export async function getUserPublicKeys(userIds: string[]) {
  const normalized = Array.from(new Set(userIds.filter(Boolean)));
  const result = new Map<string, string | null>();
  if (normalized.length === 0) {
    return result;
  }

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: normalized } },
      select: { id: true, publicKey: true },
    });

    const missingIds: string[] = [];
    for (const user of users) {
      const value = decryptPublicKeyFromDb(user.publicKey);
      if (value) {
        result.set(user.id, value);
        void redis.set(redisKey(user.id), value, "EX", 60 * 10).catch(() => {});
      } else {
        missingIds.push(user.id);
      }
    }

    const unresolved = normalized.filter((userId) => !result.has(userId));
    if (unresolved.length > 0) {
      try {
        const activeRows = await prisma.userE2EKey.findMany({
          where: { userId: { in: unresolved }, status: "active" },
          select: { userId: true, publicKey: true, version: true, createdAt: true },
          orderBy: [{ userId: "asc" }, { version: "desc" }, { createdAt: "desc" }],
        });
        for (const row of activeRows) {
          if (result.has(row.userId)) continue;
          const value = decryptPublicKeyFromDb(row.publicKey);
          if (!value) continue;
          result.set(row.userId, value);
          void redis.set(redisKey(row.userId), value, "EX", 60 * 10).catch(() => {});
        }
      } catch (error) {
        if (!isLifecycleColumnMissing(error)) throw error;
        const fallbackRows = await prisma.userE2EKey.findMany({
          where: { userId: { in: unresolved }, isActive: true },
          select: { userId: true, publicKey: true, createdAt: true },
          orderBy: [{ userId: "asc" }, { createdAt: "desc" }],
        });
        for (const row of fallbackRows) {
          if (result.has(row.userId)) continue;
          const value = decryptPublicKeyFromDb(row.publicKey);
          if (!value) continue;
          result.set(row.userId, value);
          void redis.set(redisKey(row.userId), value, "EX", 60 * 10).catch(() => {});
        }
      }
    }
  } catch (error) {
    if (!isPrismaSchemaMismatch(error)) throw error;
  }

  normalized.forEach((userId) => {
    if (!result.has(userId)) {
      result.set(userId, null);
    }
  });
  return result;
}

export async function setUserPublicKey(userId: string, publicKey: string) {
  const publicKeyEnc = encryptPublicKeyForDb(publicKey);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { publicKey: publicKeyEnc },
      select: { id: true },
    });
  } catch (error) {
    if (!isPrismaSchemaMismatch(error)) throw error;
  }
  await redis.set(redisKey(userId), publicKey, "EX", 60 * 10).catch(() => {});
}

export async function getUserPrivateKeyBackup(userId: string) {
  try {
    let activeKey: { privateKeyBackupEnc: string; publicKey: string } | null = null;
    try {
      activeKey = await prisma.userE2EKey.findFirst({
        where: { userId, status: "active" },
        select: { privateKeyBackupEnc: true, publicKey: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      });
    } catch (error) {
      if (!isLifecycleColumnMissing(error)) throw error;
      activeKey = await prisma.userE2EKey.findFirst({
        where: { userId, isActive: true },
        select: { privateKeyBackupEnc: true, publicKey: true },
        orderBy: { createdAt: "desc" },
      });
    }
    if (activeKey?.privateKeyBackupEnc && activeKey.publicKey) {
      const publicKeyBase64 = decryptPublicKeyFromDb(activeKey.publicKey);
      const privateKeyBackupEnc = maybeDecryptLegacyBackup(decryptE2ESecretFromDb(activeKey.privateKeyBackupEnc));
      if (!publicKeyBase64 || !privateKeyBackupEnc) {
        return null;
      }
      const privateKeyBase64 = privateKeyBackupEnc;
      return {
        privateKeyBase64,
        publicKeyBase64,
      };
    }
    const rows = await prisma.$queryRaw<
      Array<{ privateKeyBackupEnc: string | null; publicKey: string | null }>
    >`SELECT "privateKeyBackupEnc", "publicKey" FROM "User" WHERE "id" = ${userId} LIMIT 1`;
    const user = rows[0] ?? null;

    if (!user?.privateKeyBackupEnc || !user.publicKey) {
      return null;
    }

    const publicKeyBase64 = decryptPublicKeyFromDb(user.publicKey);
    const privateKeyBackupEnc = maybeDecryptLegacyBackup(decryptE2ESecretFromDb(user.privateKeyBackupEnc));
    if (!publicKeyBase64 || !privateKeyBackupEnc) {
      return null;
    }
    const privateKeyBase64 = privateKeyBackupEnc;
    return {
      privateKeyBase64,
      publicKeyBase64,
    };
  } catch (error) {
    if (isPrismaSchemaMismatch(error) || isLifecycleColumnMissing(error)) {
      return null;
    }
    throw error;
  }
}

export async function replaceUserPrivateKeyBackup(input: { userId: string; publicKeyBase64: string; privateKeyBase64: string }) {
  const publicKey = encryptPublicKeyForDb(input.publicKeyBase64);
  const privateKeyBackupEnc = encryptE2ESecretForDb(input.privateKeyBase64);
  await prisma.$transaction(async tx => {
    const publicKeys = [publicKey, input.publicKeyBase64];
    const result = await tx.userE2EKey.updateMany({ where: { userId: input.userId, publicKey: { in: publicKeys } }, data: { privateKeyBackupEnc } });
    const legacy = await tx.user.updateMany({ where: { id: input.userId, publicKey: { in: publicKeys } }, data: { privateKeyBackupEnc } });
    if (!result.count && !legacy.count) throw new Error("Backup key not found");
  });
}

export async function setUserPrivateKeyBackup(input: {
  userId: string;
  publicKeyBase64: string;
  privateKeyBase64: string;
}) {
  const publicKeyEnc = encryptPublicKeyForDb(input.publicKeyBase64);
  const privateKeyBackupEncDb = encryptE2ESecretForDb(input.privateKeyBase64);
  try {
    await prisma.$transaction(async (tx) => {
      try {
        await tx.userE2EKey.updateMany({
          where: { userId: input.userId, status: "active" },
          data: { isActive: false, status: "rotated", rotatedAt: new Date() },
        });

        const existing = await tx.userE2EKey.findUnique({
          where: { userId_publicKey: { userId: input.userId, publicKey: publicKeyEnc } },
          select: { version: true },
        });
        const maxVersion = (
          await tx.userE2EKey.aggregate({
            where: { userId: input.userId },
            _max: { version: true },
          })
        )._max.version;
        const targetVersion = existing?.version ?? ((maxVersion ?? 0) + 1);

        await tx.userE2EKey.upsert({
          where: { userId_publicKey: { userId: input.userId, publicKey: publicKeyEnc } },
          update: {
            privateKeyBackupEnc: privateKeyBackupEncDb,
            isActive: true,
            status: "active",
            version: targetVersion,
            rotatedAt: null,
            revokedAt: null,
          },
          create: {
            userId: input.userId,
            publicKey: publicKeyEnc,
            privateKeyBackupEnc: privateKeyBackupEncDb,
            isActive: true,
            status: "active",
            version: targetVersion,
          },
        });
      } catch (error) {
        if (!isLifecycleColumnMissing(error)) throw error;
        await tx.userE2EKey.updateMany({
          where: { userId: input.userId, isActive: true },
          data: { isActive: false },
        });
        await tx.userE2EKey.upsert({
          where: { userId_publicKey: { userId: input.userId, publicKey: publicKeyEnc } },
          update: { privateKeyBackupEnc: privateKeyBackupEncDb, isActive: true },
          create: {
            userId: input.userId,
            publicKey: publicKeyEnc,
            privateKeyBackupEnc: privateKeyBackupEncDb,
            isActive: true,
          },
        });
      }
      await tx.user.update({
        where: { id: input.userId },
        data: { publicKey: publicKeyEnc, privateKeyBackupEnc: privateKeyBackupEncDb },
        select: { id: true },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const missingClientModel = message.includes("userE2EKey") || message.includes("undefined");
    if (!isPrismaSchemaMismatch(error) && !missingClientModel) {
      throw error;
    }
    await prisma.$executeRaw`
      UPDATE "User"
      SET "publicKey" = ${publicKeyEnc},
          "privateKeyBackupEnc" = ${privateKeyBackupEncDb}
      WHERE "id" = ${input.userId}
    `;
  }

  await redis.set(redisKey(input.userId), input.publicKeyBase64, "EX", 60 * 10).catch(() => {});
}

export async function getUserPrivateKeyBackups(userId: string) {
  try {
    let rows: Array<{
      privateKeyBackupEnc: string;
      publicKey: string;
      isActive: boolean;
      createdAt: Date;
      status?: string;
    }> = [];
    try {
      rows = await prisma.userE2EKey.findMany({
        where: { userId },
        select: { privateKeyBackupEnc: true, publicKey: true, isActive: true, createdAt: true, status: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      });
    } catch (error) {
      if (!isLifecycleColumnMissing(error)) throw error;
      rows = await prisma.userE2EKey.findMany({
        where: { userId },
        select: { privateKeyBackupEnc: true, publicKey: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
    }
    if (rows.length > 0) {
      return rows
        .map((row) => {
          try {
            const publicKeyBase64 = decryptPublicKeyFromDb(row.publicKey);
            const privateKeyBackupEnc = maybeDecryptLegacyBackup(decryptE2ESecretFromDb(row.privateKeyBackupEnc));
            if (!publicKeyBase64 || !privateKeyBackupEnc) {
              return null;
            }
            return {
              publicKeyBase64,
              privateKeyBase64: privateKeyBackupEnc,
              isActive: row.status ? row.status === "active" : row.isActive,
              createdAt: row.createdAt,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<{
          publicKeyBase64: string;
          privateKeyBase64: string;
          isActive: boolean;
          createdAt: Date;
        }>;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const missingClientModel = message.includes("userE2EKey") || message.includes("undefined");
    if (!isPrismaSchemaMismatch(error) && !missingClientModel) {
      // ignore and fall back
    }
  }

  const legacy = await getUserPrivateKeyBackup(userId);
  if (legacy) {
    return [
      {
        publicKeyBase64: legacy.publicKeyBase64,
        privateKeyBase64: legacy.privateKeyBase64,
        isActive: true,
        createdAt: new Date(),
      },
    ];
  }
  return [];
}
