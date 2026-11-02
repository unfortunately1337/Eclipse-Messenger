import { beforeEach, expect, it, vi } from "vitest";
type Item = { id: string; ordinal: number; published: boolean; packId: string; emoji: string };
const fake = vi.hoisted(() => ({ job: vi.fn(), changeJob: vi.fn(), item: vi.fn(), card: vi.fn(), reply: vi.fn(), publish: vi.fn(), pack: vi.fn(), member: vi.fn(), rows: [] as Item[], progress: [] as number[] }));
vi.mock("./telegram-pack-import", () => ({ importTelegramItem: fake.item, refreshTelegramFiles: async (value: unknown) => value, telegramSetSchema: { parse: (value: unknown) => value }, packImportSnapshotSchema: { parse: (value: unknown) => value }, packItemId: (_pack: string, id: string) => "item-" + id }));
vi.mock("./pack-importer-bot", () => ({ updateImporterCard: fake.card, writeImporterReply: fake.reply }));
vi.mock("./prisma", () => {
  const db = { packImportJob: { findFirst: fake.job, updateMany: fake.changeJob }, importedPack: { update: fake.pack },
    importedPackItem: { findMany: async ({ where }: { where: { id?: { in: string[] } } }) => fake.rows.filter(row => !where.id || where.id.in.includes(row.id)), count: async () => fake.rows.filter(row => row.published).length, updateMany: fake.publish },
    userImportedPack: { findUnique: async () => null, count: async () => 0, upsert: fake.member }, $executeRaw: vi.fn() };
  return { prisma: { ...db, $transaction: (callback: (value: typeof db) => unknown) => callback(db) } };
});
import { processPackImports } from "./pack-import-worker";
const sticker = (id: number) => ({ file_unique_id: String(id) });
const row = (id: number, published = false): Item => ({ id: "item-" + id, ordinal: id, published, packId: "pack", emoji: "🙂" });
const job = () => ({ id: "job", packId: "pack", messageId: "message", conversationId: "conversation", userId: "user", completed: 0, status: "queued", leasedUntil: null, sourceSnapshot: null as unknown,
  pack: { id: "pack", title: "Ducks", kind: "emoji", count: 7, ready: false, sourceSnapshot: { title: "Ducks", stickers: Array.from({ length: 7 }, (_, id) => sticker(id)) } } });
const saveItem = (ordinal: number, id: string) => { fake.rows.push({ ...row(Number(id)), ordinal }); };
beforeEach(() => {
  vi.resetAllMocks();
  fake.rows = [];
  fake.progress = []; fake.card.mockImplementation(async (_id, card) => { fake.progress.push(card.completed); });
  fake.changeJob.mockResolvedValue({ count: 1 });
  const record = job(); fake.job.mockImplementation(async args => args.where.packId ? null : record);
  fake.publish.mockImplementation(async ({ where }) => { for (const row of fake.rows) if (where.id.in.includes(row.id)) row.published = true; });
  fake.item.mockImplementation(async (_pack, item, ordinal) => { saveItem(ordinal, item.file_unique_id); });
});
it("imports bounded parallel batches, preserves ordinal order and names the pack in the completion notice", async () => {
  let active = 0, peak = 0;
  fake.item.mockImplementation(async (_pack, item, ordinal) => { active++; peak = Math.max(active, peak); await new Promise(resolve => setTimeout(resolve, 5)); active--; saveItem(ordinal, item.file_unique_id); });
  await processPackImports();
  expect(peak).toBe(3); expect(active).toBe(0);
  expect(fake.item.mock.calls.map(args => args[2])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(fake.reply.mock.lastCall![1].startsWith("«Ducks» добавлен в ваш аккаунт.")).toBe(true);
  expect(fake.card.mock.lastCall![1]).toMatchObject({ status: "ready", completed: 7 });
});
it("settles all in-flight files before failure and does not launch another batch", async () => {
  let active = 0;
  fake.item.mockImplementation(async (_pack, _item, ordinal) => {
    active++;
    try { if (ordinal === 0) throw new Error("network"); await new Promise(resolve => setTimeout(resolve, 10)); }
    finally { active--; }
  });
  await processPackImports();
  expect(fake.item).toHaveBeenCalledTimes(3); expect(active).toBe(0);
  expect(fake.card.mock.lastCall![1].status).toBe("failed");
  expect(fake.reply).not.toHaveBeenCalled();
  expect(fake.publish).not.toHaveBeenCalled();
});
it("imports 20 → 30 by downloading only ten additions and preserves a sticker removed from Telegram", async () => {
  fake.rows = Array.from({ length: 20 }, (_, i) => row(i, true));
  const record = job(); record.pack.ready = true; record.pack.count = 20;
  record.sourceSnapshot = { source: { title: "Ducks", stickers: Array.from({ length: 29 }, (_, i) => sticker(i + 1)) }, baseItemIds: fake.rows.map(item => item.id), update: true };
  fake.job.mockImplementation(async args => args.where.packId ? null : record);
  await processPackImports();
  expect(fake.item).toHaveBeenCalledTimes(10); expect(fake.rows).toHaveLength(30);
  expect(fake.rows.every(item => item.published)).toBe(true); expect(fake.rows[0].id).toBe("item-0");
  expect(fake.pack.mock.lastCall![0].data.count).toBe(30);
  expect(fake.card.mock.lastCall![1]).toMatchObject({ count: 10, completed: 10, packCount: 30, update: true });
  expect(fake.reply.mock.lastCall![1]).toBe("«Ducks» обновлён. Добавлено новых элементов: 10.");
  expect(fake.member).not.toHaveBeenCalled();
});
it("resumes staged files without downloading them twice and publishes only after completion", async () => {
  fake.rows = [row(0), row(1)];
  await processPackImports();
  expect(fake.item).toHaveBeenCalledTimes(5); expect(fake.rows).toHaveLength(7);
  expect(fake.progress[0]).toBe(2); expect(fake.publish).toHaveBeenCalledOnce();
});
it("does not run two workers for the same pack concurrently", async () => {
  const record = job(); fake.job.mockImplementation(async args => args.where.packId ? { id: "other-active-job" } : record);
  await processPackImports(); expect(fake.item).not.toHaveBeenCalled(); expect(fake.changeJob).not.toHaveBeenCalled();
});
it("lets two independent packs progress together while bounding total concurrency", async () => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  let active = 0, peak = 0;
  fake.job.mockImplementation(async args => {
    if (args.where.packId) return null;
    const record = job(), id = args.where.id === "second" ? 1 : 0;
    return { ...record, id: args.where.id, packId: "pack-" + id, pack: { ...record.pack, id: "pack-" + id, count: 1, sourceSnapshot: { title: "Ducks", stickers: [sticker(id)] } } };
  });
  fake.item.mockImplementation(async (_pack, item, ordinal) => {
    active++; peak = Math.max(active, peak);
    await blocked; saveItem(ordinal, item.file_unique_id); active--;
  });
  const first = processPackImports("first"), second = processPackImports("second");
  await vi.waitFor(() => expect(active).toBe(2));
  await processPackImports("third");
  expect(fake.item).toHaveBeenCalledTimes(2); expect(peak).toBe(2);
  release(); await Promise.all([first, second]);
  expect(active).toBe(0);
});
it("coalesces fast batch notifications while publishing the final progress", async () => {
  await processPackImports();
  expect(fake.progress).toEqual([0, 7, 7]);
});
