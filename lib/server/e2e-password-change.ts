import { prisma } from "@/lib/server/prisma";
import { decryptPublicKeyFromDb, encryptE2ESecretForDb, encryptPublicKeyForDb } from "@/lib/server/e2e-storage";
import { HttpError } from "@/lib/server/http";

export async function updatePasswordAndE2EBackups(input: {
  userId: string; oldPasswordHash: string; passwordHash: string;
  backups?: { publicKey: string; privateKey: string }[];
}) {
  await prisma.$transaction(async tx => {
    const [user, keys] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { publicKey: true } }),
      tx.userE2EKey.findMany({ where: { userId: input.userId }, select: { publicKey: true } }),
    ]);
    const known = new Set([...keys.map(k => k.publicKey), ...(user?.publicKey ? [user.publicKey] : [])]
      .map(key => decryptPublicKeyFromDb(key)).filter((key): key is string => Boolean(key)));
    const supplied = new Map((input.backups ?? []).map(backup => [backup.publicKey, backup.privateKey]));
    if (known.size !== supplied.size || [...known].some(key => !supplied.has(key))) {
      throw new HttpError(409, "Restore all encryption keys before changing the password. Reload Settings and try again.");
    }
    for (const [publicKey, privateKey] of supplied) {
      const publicKeys = [publicKey, encryptPublicKeyForDb(publicKey)];
      const privateKeyBackupEnc = encryptE2ESecretForDb(privateKey);
      await tx.userE2EKey.updateMany({ where: { userId: input.userId, publicKey: { in: publicKeys } }, data: { privateKeyBackupEnc } });
      await tx.user.updateMany({ where: { id: input.userId, publicKey: { in: publicKeys } }, data: { privateKeyBackupEnc } });
    }
    // Compare-and-set: concurrent password changes cannot leave backups under a different password.
    const updated = await tx.user.updateMany({ where: { id: input.userId, passwordHash: input.oldPasswordHash }, data: { passwordHash: input.passwordHash } });
    if (updated.count !== 1) throw new HttpError(409, "Password changed in another session. Sign in again.");
  });
}
