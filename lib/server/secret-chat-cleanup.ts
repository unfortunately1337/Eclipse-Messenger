import { prisma } from "./prisma";
import { deleteMediaObject } from "./media-storage";

// expiresAt in PostgreSQL is the durable job. Redis availability is irrelevant.
export async function cleanupExpiredSecretChats(now = new Date()) {
  const chats = await prisma.secretChat.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: 100 });
  for (const chat of chats) {
    const assets = await prisma.mediaAsset.findMany({ where: { scopeType: "secret", scopeId: chat.id } });
    try {
      for (const asset of assets) {
        if (asset.bucket && asset.objectKey) await deleteMediaObject(asset.bucket, asset.objectKey, { strict: true });
        await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
      }
      await prisma.secretChat.deleteMany({ where: { id: chat.id, expiresAt: { lte: now } } });
    } catch {
      // Keep the expired row and attachment metadata for retry after restart.
      console.warn("Secret attachment cleanup deferred; storage unavailable");
    }
  }
  // An upload may finish after the chat expired or was manually deleted.
  const orphans = await prisma.$queryRaw<Array<{ id: string; bucket: string | null; objectKey: string | null }>>`
    SELECT m."id", m."bucket", m."objectKey" FROM "MediaAsset" m
    WHERE m."scopeType" = 'secret' AND (
      m."expiresAt" <= ${now} OR NOT EXISTS (
        SELECT 1 FROM "SecretChat" c WHERE c."id" = m."scopeId"
      )
    )
    ORDER BY m."expiresAt" ASC NULLS LAST LIMIT 100
  `;
  for (const asset of orphans) {
    try {
      if (asset.bucket && asset.objectKey) await deleteMediaObject(asset.bucket, asset.objectKey, { strict: true });
      await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
    } catch { console.warn("Expired attachment cleanup deferred"); }
  }
}

const state = globalThis as typeof globalThis & { eclipseSecretCleanup?: ReturnType<typeof setInterval> };
export function startSecretChatCleanup() {
  if (state.eclipseSecretCleanup) return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await cleanupExpiredSecretChats(); }
    catch { console.warn("Secret cleanup database unavailable; retry scheduled"); }
    finally { running = false; }
  };
  state.eclipseSecretCleanup = setInterval(() => { void run(); }, 30_000);
  state.eclipseSecretCleanup.unref();
  void run();
}
