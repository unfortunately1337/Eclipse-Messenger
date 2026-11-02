import { gzipSync, gunzipSync } from "node:zlib";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), find: vi.fn(), items: vi.fn(), member: vi.fn(), findItem: vi.fn(), saveItem: vi.fn(), upload: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { importedPack: { upsert: mocks.upsert, findUnique: mocks.find }, importedPackItem: { findMany: mocks.items, findUnique: mocks.findItem, upsert: mocks.saveItem }, userImportedPack: { findUnique: mocks.member } } }));
vi.mock("./media-storage", () => ({ uploadMediaBuffer: mocks.upload }));
import { inspectTelegramPack, importTelegramItem, preparePackImport, packIdForName, packItemId, refreshTelegramFiles, telegramRequest, validateTgs } from "./telegram-pack-import";
const sticker = { file_id: "file", file_unique_id: "unique", emoji: "🙂", is_animated: true, is_video: false, file_size: 100 };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("TELEGRAM_IMPORT_BOT_TOKEN", "test-token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("deduplicates entries and identifies a pack consistently across accounts and letter case", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true, result: { name: "TestPack", title: "Test Pack", sticker_type: "custom_emoji", stickers: [sticker, sticker] } })));
  mocks.upsert.mockImplementation(async args => args.create);
  const pack = await inspectTelegramPack("https://t.me/addemoji/TestPack", "emoji");
  expect(pack.count).toBe(1); expect(pack.id).toBe(packIdForName("testpack"));
  expect(packItemId(pack.id, "unique")).toBe(packItemId(packIdForName("TESTPACK"), "unique"));
  expect(mocks.upsert.mock.calls[0][0].update).toEqual({ sourceSnapshot: expect.objectContaining({ stickers: [sticker] }) });
});
it("does not contact an arbitrary host or accept a different pack type", async () => {
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  await expect(inspectTelegramPack("https://evil.test/t.me/addemoji/TestPack")).rejects.toThrow();
  await expect(inspectTelegramPack("https://t.me/addstickers/TestPack", "emoji")).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it("checks Telegram again for ready packs while leaving their published count and artwork intact", async () => {
  const source = { name: "TestPack", title: "Updated title", sticker_type: "custom_emoji", stickers: [sticker, { ...sticker, file_unique_id: "new" }] };
  const request = vi.fn().mockImplementation(async () => Response.json({ ok: true, result: source })); vi.stubGlobal("fetch", request);
  const pack = { id: "pack-id", title: "Test", kind: "emoji", ready: true };
  mocks.find.mockResolvedValue(pack); mocks.upsert.mockResolvedValue(pack);
  await expect(inspectTelegramPack("https://t.me/addemoji/TestPack")).resolves.toBe(pack);
  expect(mocks.find).toHaveBeenCalledWith({ where: { sourceName: "testpack" } });
  await expect(inspectTelegramPack("https://t.me/addstickers/TestPack")).rejects.toThrow("Тип набора");
  expect(request).toHaveBeenCalledTimes(2);
  expect(mocks.upsert.mock.calls[0][0].update).toEqual({ sourceSnapshot: source });
});
it("plans only the ten additions for an owned 20-item pack and retains an immutable job snapshot", async () => {
  const source = { name: "TestPack", title: "Test", sticker_type: "custom_emoji", stickers: Array.from({ length: 30 }, (_, i) => ({ ...sticker, file_unique_id: String(i) })) };
  mocks.find.mockResolvedValue({ id: "pack", kind: "emoji", sourceSnapshot: source });
  mocks.member.mockResolvedValue({});
  mocks.items.mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ id: packItemId("pack", String(i)), sourceUniqueId: String(i) })));
  const plan = await preparePackImport("pack", "user");
  expect(plan.card).toMatchObject({ update: true, count: 10, packCount: 30 });
  expect(plan.snapshot.baseItemIds).toHaveLength(20); expect(plan.snapshot.source.stickers).toHaveLength(30);
});
it("does not confuse deleted/reordered source items with additions or discard archived stickers", async () => {
  const source = { name: "TestPack", title: "Test", sticker_type: "custom_emoji", stickers: [{ ...sticker, file_unique_id: "b" }] };
  mocks.find.mockResolvedValue({ id: "pack", kind: "emoji", sourceSnapshot: source }); mocks.member.mockResolvedValue({});
  mocks.items.mockResolvedValue([{ id: "old-a", sourceUniqueId: "a" }, { id: "old-b", sourceUniqueId: "b" }]);
  const plan = await preparePackImport("pack", "user");
  expect(plan.added).toBe(0); expect(plan.card.packCount).toBe(2);
});
it("does not reveal credentials or upstream request URLs on a network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("https://api.telegram.org/bottest-token/getFile")));
  await expect(telegramRequest("getFile", { file_id: "file" })).rejects.toThrow("Не удалось связаться с Telegram");
});
it("retries a temporary Telegram failure without requiring another import action", async () => {
  const request = vi.fn().mockResolvedValueOnce(new Response("Unavailable", { status: 503 })).mockResolvedValueOnce(Response.json({ ok: true, result: { file_path: "stickers/item.tgs" } }));
  vi.stubGlobal("fetch", request);
  await expect(telegramRequest("getFile", { file_id: "file" })).resolves.toEqual({ file_path: "stickers/item.tgs" });
  expect(request).toHaveBeenCalledTimes(2);
});
it("renews bot-specific file IDs while preserving the imported pack order and identities", async () => {
  const original = { name: "TestPack", title: "Test", sticker_type: "custom_emoji", stickers: [sticker, { ...sticker, file_unique_id: "second" }] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true, result: { ...original, stickers: [{ ...sticker, file_unique_id: "second", file_id: "new-second" }, { ...sticker, file_id: "new-first" }] } })));
  const renewed = await refreshTelegramFiles(original);
  expect(renewed.stickers.map(item => item.file_id)).toEqual(["new-first", "new-second"]);
  expect(renewed.stickers.map(item => item.file_unique_id)).toEqual(["unique", "second"]);
});
it("rejects external resources and excessive duration, and strips executable expressions", () => {
  const base = { v: "5.7.0", w: 512, h: 512, ip: 0, op: 60, fr: 30, layers: [], assets: [] };
  expect(() => validateTgs(gzipSync(JSON.stringify(base)))).not.toThrow();
  for (const changed of [{ ...base, assets: [{ p: "https://evil.test/image.png" }] }, { ...base, op: 3000 }]) {
    expect(() => validateTgs(gzipSync(JSON.stringify(changed)))).toThrow();
  }
  const safe = validateTgs(gzipSync(JSON.stringify({ ...base, layers: [{ x: "expression()", k: 50 }] })));
  expect(JSON.parse(gunzipSync(safe).toString()).layers).toEqual([{ k: 50 }]);
  expect(() => validateTgs(Buffer.from("not gzip"))).toThrow();
});
it("builds static previews from the original instead of downloading a second Telegram file", async () => {
  const image = await sharp({ create: { width: 16, height: 16, channels: 4, background: "white" } }).webp().toBuffer();
  const request = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/getFile")) {
      expect(JSON.parse(String(init?.body))).toEqual({ file_id: "file" });
      return Response.json({ ok: true, result: { file_path: "stickers/original.webp" } });
    }
    return new Response(new Uint8Array(image));
  });
  vi.stubGlobal("fetch", request);
  mocks.upload.mockImplementation(async args => ({ bucket: "media", objectKey: args.objectKey }));
  mocks.saveItem.mockImplementation(async args => args.create);
  await importTelegramItem("pack", { ...sticker, is_animated: false, thumbnail: { file_id: "preview" } }, 0, "user");
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ file_id: "file" });
  expect(mocks.upload).toHaveBeenCalledTimes(2);
});
it("downloads an animated original and preview concurrently and settles both before failure", async () => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const started: string[] = [];
  const request = vi.fn(async (_url: string, init?: RequestInit) => {
    const id = JSON.parse(String(init?.body)).file_id;
    started.push(id);
    if (id === "preview") { await blocked; return Response.json({ ok: true, result: { file_path: "stickers/preview.webp" } }); }
    return new Response("Not found", { status: 404 });
  });
  vi.stubGlobal("fetch", request);
  let completed = false;
  const importResult = importTelegramItem("pack", { ...sticker, thumbnail: { file_id: "preview" } }, 0, "user").catch(error => error).finally(() => { completed = true; });
  await vi.waitFor(() => expect(started).toEqual(["file", "preview"]));
  expect(completed).toBe(false);
  // Do not let the thumbnail's file download contact any real host.
  request.mockImplementation(async () => new Response("Not found", { status: 404 }));
  release();
  expect(await importResult).toBeInstanceOf(Error);
  expect(mocks.upload).not.toHaveBeenCalled();
});
