import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import dotenv from "dotenv";
import sharp from "sharp";
const viewer = vi.hoisted(() => ({ id: "" }));
vi.mock("./auth", () => ({ requireUserFromRequest: async () => ({ user: { id: viewer.id } }) }));
vi.mock("./csrf", () => ({ verifyCsrf: vi.fn() }));
vi.mock("./bot-messaging", async () => ({ readBotContent: (await import("./bot-content")).readBotContent, notifyBotChat: vi.fn() }));
import { prisma } from "./prisma";
import { inspectTelegramPack, packItemId } from "./telegram-pack-import";
import { ensureImporterBotUser, offerImporterPack, handleImporterCallback } from "./pack-importer-bot";
import { getOrCreateDirectConversation } from "./chat";
import { deleteMediaObject } from "./media-storage";
import { getMediaStorageConfig } from "./media-config";
import { GET as getPack } from "@/app/api/packs/[id]/route";
import { GET as getAsset } from "@/app/api/packs/assets/[id]/[variant]/route";

describe.skipIf(process.env.PACK_UPDATE_INTEGRATION !== "1")("incremental imports against local PostgreSQL and encrypted media storage", () => {
  const run = randomUUID().replaceAll("-", "").slice(0, 16), packs: string[] = [], users: string[] = [];
  let conversationId = "";
  beforeAll(async () => {
    dotenv.config({ quiet: true });
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Local database required");
    if (!/localhost|127\.0\.0\.1/.test(getMediaStorageConfig().endpoint)) throw new Error("Local media storage required");
    for (let i = 0; i < 2; i++) users.push((await prisma.user.create({ data: { link: `packupd_${run}_${i}`, displayName: "Pack update check", passwordHash: randomUUID() } })).id);
    viewer.id = users[0];
    const bot = await ensureImporterBotUser(); conversationId = await getOrCreateDirectConversation(viewer.id, bot.id);
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    const files = await prisma.importedPackItem.findMany({ where: { packId: { in: packs } } });
    await prisma.importedPack.deleteMany({ where: { id: { in: packs } } });
    for (const file of files) {
      if (!await prisma.importedPackItem.findFirst({ where: { objectKey: file.objectKey } })) {
        await deleteMediaObject(file.bucket, file.objectKey); await deleteMediaObject(file.bucket, file.thumbnailKey);
      }
    }
    await prisma.conversation.deleteMany({ where: { participants: { some: { userId: { in: users } } } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect();
  }, 60000);

  for (const kind of ["emoji", "sticker"] as const) it(`${kind}: 20 → 30, atomic publication, no duplicates, archived files and retry after failure`, async () => {
    const name = `UpdateAudit${kind}${run}`, messagePrefix = `${kind}-${run}`;
    const images = await Promise.all(Array.from({ length: 31 }, (_, i) => sharp({ create: { width: 8, height: 8, channels: 4, background: { r: i * 7, g: parseInt(run.slice(0, 2), 16), b: kind === "emoji" ? 23 : 203, alpha: 1 } } }).webp().toBuffer()));
    let count = 20, removed = false, failed = false, release: (() => void) | undefined, blocked = false;
    let hold: Promise<void> | null = null;
    const network = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.hostname !== "api.telegram.org") return network(input, init);
      if (url.pathname.endsWith("/getStickerSet")) {
        expect(JSON.parse(String(init?.body)).name).toBe(name);
        return Response.json({ ok: true, result: { name, title: "Update audit " + kind, sticker_type: kind === "emoji" ? "custom_emoji" : "regular", stickers: Array.from({ length: count }, (_, i) => i).filter(i => !removed || i >= 5).map(i => ({ file_id: "file" + i, file_unique_id: `${run}-${kind}-${i}`, emoji: "🙂", is_animated: false, is_video: false, file_size: images[i].length })) } });
      }
      if (url.pathname.endsWith("/getFile")) { const id = Number(JSON.parse(String(init?.body)).file_id.slice(4)); return Response.json({ ok: true, result: { file_path: `audit/${name}/${id}.webp`, file_size: images[id].length } }); }
      const match = url.pathname.match(/\/(\d+)\.webp$/);
      if (!match) throw new Error("Unexpected Telegram operation in test");
      const index = Number(match[1]);
      if (index >= 20 && hold) { blocked = true; await hold; }
      if (index === 30 && failed) throw new Error("Simulated download failure");
      return new Response(new Uint8Array(images[index]), { headers: { "Content-Type": "image/webp" } });
    });
    const link = `https://t.me/${kind === "emoji" ? "addemoji" : "addstickers"}/${name}`;
    const callback = (id: string) => handleImporterCallback(new NextRequest("http://localhost/api/bots/importbot/callback", { method: "POST", body: JSON.stringify({ messageId: id, data: "import", requestId: randomUUID() }) }));
    const wait = async (id: string, status = "ready") => {
      for (let i = 0; i < 400; i++) {
        const job = await prisma.packImportJob.findUnique({ where: { messageId: id } });
        if (job?.status === status) return job;
        if (job?.status === "failed" && status !== "failed") throw new Error(job.error ?? "Import failed");
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error("Import timed out");
    };
    const pack = await inspectTelegramPack(link); packs.push(pack.id);
    await offerImporterPack(viewer.id, conversationId, pack, messagePrefix + "-initial");
    await callback(messagePrefix + "-initial"); await wait(messagePrefix + "-initial");
    const original = await prisma.importedPackItem.findMany({ where: { packId: pack.id, published: true }, orderBy: { ordinal: "asc" } }); expect(original).toHaveLength(20);
    await prisma.userImportedPack.create({ data: { userId: users[1], packId: pack.id } });
    count = 30; const refreshed = await inspectTelegramPack(link);
    expect(refreshed.id).toBe(pack.id); expect(refreshed.ready).toBe(true); expect(refreshed.count).toBe(20);
    expect(await offerImporterPack(viewer.id, conversationId, refreshed, messagePrefix + "-update")).toBe(true);
    const offered = await prisma.message.findUniqueOrThrow({ where: { id: messagePrefix + "-update" } });
    expect((offered.systemPayload as { metadata: { packImport: unknown } }).metadata.packImport).toMatchObject({ update: true, count: 10, packCount: 30 });
    hold = new Promise(resolve => { release = resolve; });
    await callback(messagePrefix + "-update");
    for (let i = 0; i < 100 && !blocked; i++) await new Promise(resolve => setTimeout(resolve, 25));
    expect(blocked).toBe(true);
    const during = await getPack(new NextRequest("http://localhost/api/packs/" + pack.id), { params: Promise.resolve({ id: pack.id }) });
    expect((await during.json()).data.pack.items).toHaveLength(20);
    release!(); hold = null; await wait(messagePrefix + "-update");
    const updated = await prisma.importedPack.findUniqueOrThrow({ where: { id: pack.id }, include: { items: true, users: true } });
    expect(updated.count).toBe(30); expect(updated.items).toHaveLength(30); expect(updated.users).toHaveLength(2); expect(updated.items.every(item => item.published)).toBe(true);
    for (const item of original) expect(updated.items.find(value => value.id === item.id)).toMatchObject({ objectKey: item.objectKey, ordinal: item.ordinal });
    expect(await offerImporterPack(viewer.id, conversationId, await inspectTelegramPack(link), messagePrefix + "-duplicate")).toBe(false);
    expect(await prisma.packImportJob.count({ where: { packId: pack.id } })).toBe(2);
    removed = true; expect(await offerImporterPack(viewer.id, conversationId, await inspectTelegramPack(link), messagePrefix + "-removed")).toBe(false);
    const oldId = packItemId(pack.id, `${run}-${kind}-0`);
    const oldAsset = await getAsset(new NextRequest("http://localhost/api/packs/assets/" + oldId + "/original"), { params: Promise.resolve({ id: oldId, variant: "original" }) });
    expect(oldAsset.status).toBe(200); expect((await oldAsset.arrayBuffer()).byteLength).toBeGreaterThan(0);
    removed = false; count = 31; failed = true;
    await offerImporterPack(viewer.id, conversationId, await inspectTelegramPack(link), messagePrefix + "-retry");
    await callback(messagePrefix + "-retry"); await wait(messagePrefix + "-retry", "failed");
    expect((await prisma.importedPack.findUniqueOrThrow({ where: { id: pack.id } })).count).toBe(30);
    failed = false; await callback(messagePrefix + "-retry"); await wait(messagePrefix + "-retry");
    expect((await prisma.importedPack.findUniqueOrThrow({ where: { id: pack.id } })).count).toBe(31);
    expect(await prisma.importedPackItem.count({ where: { packId: pack.id, published: true } })).toBe(31);
    vi.unstubAllGlobals();
  }, 120000);
});
