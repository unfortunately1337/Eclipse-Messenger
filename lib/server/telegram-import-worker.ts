import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { receiveTelegramImportUpdate, notifyTelegramImportFailed } from "./telegram-import-receiver";

async function processNextTelegramImportUpdate() {
  const now = new Date(), leaseId = randomUUID();
  const job = await prisma.telegramImportUpdate.findFirst({ where: { OR: [{ status: "queued" }, { status: "processing", leasedUntil: { lt: now } }] }, orderBy: { createdAt: "asc" } });
  if (!job) return false;
  const held = await prisma.telegramImportUpdate.updateMany({ where: { id: job.id, status: job.status, leasedUntil: job.leasedUntil }, data: { status: "processing", leaseId, leasedUntil: new Date(Date.now() + 600_000), attempts: { increment: 1 } } });
  if (!held.count) return false;
  try {
    await receiveTelegramImportUpdate(job.id, job.payloadEnc);
    await prisma.telegramImportUpdate.updateMany({ where: { id: job.id, leaseId }, data: { status: "done", leaseId: null, leasedUntil: null, payloadEnc: "" } });
  } catch {
    if (job.attempts >= 2) await notifyTelegramImportFailed(job.payloadEnc);
    await prisma.telegramImportUpdate.updateMany({ where: { id: job.id, leaseId }, data: { status: job.attempts >= 2 ? "failed" : "processing", leaseId: null, leasedUntil: new Date(Date.now() + 15_000), ...(job.attempts >= 2 ? { payloadEnc: "" } : {}) } });
  }
  return true;
}
const state = globalThis as typeof globalThis & { telegramImportTimer?: ReturnType<typeof setInterval>; telegramImportRunning?: boolean; telegramImportCleanup?: number };
export async function processTelegramImportUpdates() {
  if (state.telegramImportRunning) return;
  state.telegramImportRunning = true;
  try {
    if ((state.telegramImportCleanup ?? 0) < Date.now() - 3_600_000) {
      await prisma.telegramImportUpdate.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) }, status: { in: ["done", "failed"] } } });
      await prisma.telegramImportTicket.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } });
      state.telegramImportCleanup = Date.now();
    }
    // Drain a short burst in order instead of imposing a one-second pause
    // between every user interaction. The durable queue remains the source of truth.
    for (let index = 0; index < 8; index++) if (!await processNextTelegramImportUpdate()) break;
  } finally { state.telegramImportRunning = false; }
}
export function startTelegramImportWorker() {
  if (state.telegramImportTimer || !process.env.TELEGRAM_IMPORT_WEBHOOK_SECRET) return;
  state.telegramImportTimer = setInterval(() => { void processTelegramImportUpdates().catch(() => {}); }, 1000);
  state.telegramImportTimer.unref();
}
