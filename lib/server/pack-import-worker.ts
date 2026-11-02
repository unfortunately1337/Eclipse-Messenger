import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { importTelegramItem, refreshTelegramFiles, telegramSetSchema, packImportSnapshotSchema, packItemId } from "./telegram-pack-import";
import { updateImporterCard, writeImporterReply } from "./pack-importer-bot";
import { importedEmojiToken, type ImportCard, type PackKind } from "@/lib/imported-packs";
import { HttpError } from "./http";

async function runJob(job: NonNullable<Awaited<ReturnType<typeof claimJob>>>) {
  let card: ImportCard = { packId: job.pack.id, title: job.pack.title, kind: job.pack.kind as PackKind, count: job.pack.count, status: "importing", completed: job.completed };
  try {
    const snapshot = job.sourceSnapshot ? packImportSnapshotSchema.parse(job.sourceSnapshot) : { source: telegramSetSchema.parse(job.pack.sourceSnapshot), baseItemIds: [], update: false };
    const source = snapshot.source;
    const base = new Set(snapshot.baseItemIds);
    const targetIds = [...new Set(source.stickers.map(item => packItemId(job.packId, item.file_unique_id)))];
    const addedIds = targetIds.filter(id => !base.has(id));
    const progressIds = snapshot.update ? addedIds : [...new Set([...base, ...targetIds])];
    const existing = await prisma.importedPackItem.findMany({ where: { packId: job.packId }, select: { id: true, ordinal: true } });
    const known = new Set(existing.map(item => item.id));
    const missing = source.stickers.filter(item => !known.has(packItemId(job.packId, item.file_unique_id)));
    // Renew only files that are actually needed. Archived, removed Telegram
    // stickers never need to be fetched again and remain usable in old messages.
    const pending = missing.length ? (await refreshTelegramFiles({ ...source, stickers: missing })).stickers : [];
    const ordinal = existing.reduce((maximum, item) => Math.max(maximum, item.ordinal + 1), 0);
    const alreadyDownloaded = progressIds.filter(id => known.has(id)).length;
    card = { ...card, title: source.title, count: progressIds.length, packCount: new Set([...base, ...targetIds]).size, update: snapshot.update, completed: alreadyDownloaded };
    await updateImporterCard(job.messageId, card);
    let lastProgressAt = Date.now();
    // Bounded batches overlap network waits without loading a whole pack into
    // memory. Settle the complete batch before failing or releasing the lease.
    for (let index = 0; index < pending.length; index += 3) {
      const held = await prisma.packImportJob.updateMany({ where: { id: job.id, status: "importing", leaseId: job.leaseId }, data: { leasedUntil: new Date(Date.now() + 300_000) } });
      if (!held.count) return;
      const results = await Promise.allSettled(pending.slice(index, index + 3).map((sticker, offset) => importTelegramItem(job.packId, sticker, ordinal + index + offset, job.userId)));
      const failed = results.find(result => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      card.completed = Math.min(alreadyDownloaded + index + 3, card.count);
      await prisma.packImportJob.updateMany({ where: { id: job.id, leaseId: job.leaseId }, data: { completed: card.completed } });
      // A cached/fast batch must not cause a full chat refresh for every three
      // files. Keep progress responsive while bounding realtime notifications.
      if (index + 3 >= pending.length || Date.now() - lastProgressAt >= 350) {
        await updateImporterCard(job.messageId, card);
        lastProgressAt = Date.now();
      }
    }
    const downloaded = await prisma.importedPackItem.findMany({ where: { packId: job.packId, id: { in: targetIds } }, orderBy: { ordinal: "asc" } });
    if (downloaded.length !== targetIds.length) throw new HttpError(502, "Не все файлы набора загрузились. Повторите импорт.");
    const first = downloaded.find(item => addedIds.includes(item.id)) ?? downloaded[0];
    if (!first) throw new HttpError(502, "Не все файлы набора загрузились. Повторите импорт.");
    const publishedCount = await prisma.$transaction(async db => {
      const held = await db.packImportJob.updateMany({ where: { id: job.id, status: "importing", leaseId: job.leaseId }, data: { status: "finishing", completed: card.count, error: null } });
      if (!held.count) throw new Error("Import lease lost");
      await db.importedPackItem.updateMany({ where: { packId: job.packId, id: { in: targetIds } }, data: { published: true } });
      const count = await db.importedPackItem.count({ where: { packId: job.packId, published: true } });
      await db.importedPack.update({ where: { id: job.packId }, data: { ready: true, title: source.title, count } });
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pack-library:${job.userId}`}, 0))`;
      if (!snapshot.update) {
        if (!await db.userImportedPack.findUnique({ where: { userId_packId: { userId: job.userId, packId: job.packId } } }) && await db.userImportedPack.count({ where: { userId: job.userId } }) >= 200) throw new HttpError(400, "Можно добавить до 200 наборов.");
        await db.userImportedPack.upsert({ where: { userId_packId: { userId: job.userId, packId: job.packId } }, update: {}, create: { userId: job.userId, packId: job.packId } });
      }
      return count;
    });
    await updateImporterCard(job.messageId, { ...card, packCount: publishedCount, completed: card.count, status: "ready" });
    const sample = job.pack.kind === "emoji" ? importedEmojiToken(first.id) : `__eclipse_media__:${JSON.stringify({ type: "sticker", src: `/api/packs/assets/${first.id}/original`, emoji: first.emoji, packId: first.packId })}`;
    await writeImporterReply(job.conversationId, sample, `import-sample:${job.id}`);
    await writeImporterReply(job.conversationId, snapshot.update ? `«${source.title}» обновлён. Добавлено новых элементов: ${addedIds.length}.` : `«${source.title}» добавлен в ваш аккаунт. Нажмите на стикер или эмодзи, чтобы открыть весь набор.`, `import-done:${job.id}`);
    await prisma.packImportJob.updateMany({ where: { id: job.id, leaseId: job.leaseId }, data: { status: "ready", leaseId: null, leasedUntil: null } });
  } catch (error) {
    const changed = await prisma.packImportJob.updateMany({ where: { id: job.id, status: { in: ["importing", "finishing"] }, leaseId: job.leaseId }, data: { status: "failed", error: error instanceof HttpError ? error.message : "Импорт прервался. Попробуйте ещё раз.", leasedUntil: null, leaseId: null } });
    if (changed.count) await updateImporterCard(job.messageId, { ...card, status: "failed", error: error instanceof HttpError ? error.message : "Импорт прервался. Попробуйте ещё раз." });
  }
}
async function claimJob(jobId?: string) {
  const now = new Date();
  const candidate = await prisma.packImportJob.findFirst({ where: { ...(jobId ? { id: jobId } : {}), OR: [{ status: "queued" }, { status: { in: ["importing", "finishing"] }, leasedUntil: { lt: now } }], pack: { jobs: { none: { status: { in: ["importing", "finishing"] }, leasedUntil: { gte: now } } } } }, orderBy: { createdAt: "asc" }, include: { pack: true } });
  if (!candidate) return null;
  const leaseId = randomUUID();
  return prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pack-worker:${candidate.packId}`}, 0))`;
    if (await db.packImportJob.findFirst({ where: { packId: candidate.packId, id: { not: candidate.id }, status: { in: ["importing", "finishing"] }, leasedUntil: { gte: now } } })) return null;
    const claimed = await db.packImportJob.updateMany({ where: { id: candidate.id, status: candidate.status, leasedUntil: candidate.leasedUntil }, data: { status: "importing", leaseId, leasedUntil: new Date(Date.now() + 300_000) } });
    return claimed.count ? { ...candidate, leaseId } : null;
  });
}
const state = globalThis as typeof globalThis & { eclipsePackWorker?: ReturnType<typeof setInterval>; eclipsePackImportActive?: number };
export async function processPackImports(jobId?: string) {
  // Independent packs may overlap their network waits. Each pack still holds
  // its database lease, and at most six files are processed in this process.
  if ((state.eclipsePackImportActive ?? 0) >= 2) return;
  state.eclipsePackImportActive = (state.eclipsePackImportActive ?? 0) + 1;
  try { const job = await claimJob(jobId); if (job) await runJob(job); }
  finally { state.eclipsePackImportActive!--; }
}
export function startPackImportWorker() {
  if (state.eclipsePackWorker) return;
  state.eclipsePackWorker = setInterval(() => { void Promise.allSettled([processPackImports(), processPackImports()]); }, 2000);
  state.eclipsePackWorker.unref();
}
