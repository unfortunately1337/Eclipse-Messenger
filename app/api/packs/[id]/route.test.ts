import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ auth: vi.fn(), pack: vi.fn(), find: vi.fn(), count: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireUserFromRequest: mock.auth }));
vi.mock("@/lib/server/csrf", () => ({ verifyCsrf: vi.fn() }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/server/prisma", () => {
  const db = { importedPack: { findUnique: mock.pack }, userImportedPack: { findUnique: mock.find, count: mock.count, upsert: mock.upsert, deleteMany: mock.remove }, $executeRaw: vi.fn() };
  return { prisma: { ...db, $transaction: (fn: (db: unknown) => unknown) => fn(db) } };
});
import { GET, POST } from "./route";
const id = "pack-0123456789abcdef01234567", params = { params: Promise.resolve({ id }) };
const req = (action: string) => new NextRequest(`http://localhost/api/packs/${id}`, { method: "POST", body: JSON.stringify({ action }) });
beforeEach(() => { vi.resetAllMocks(); mock.auth.mockResolvedValue({ user: { id: "reader" } }); mock.pack.mockResolvedValue({ id, ready: true }); mock.find.mockResolvedValue(null); mock.count.mockResolvedValue(0); });
it("adds only to the authenticated account with a database uniqueness key", async () => {
  expect((await POST(req("add"), params)).status).toBe(200);
  expect(mock.upsert).toHaveBeenCalledWith({ where: { userId_packId: { userId: "reader", packId: id } }, update: {}, create: { userId: "reader", packId: id } });
});
it("removes only membership, preserving shared files and historical messages", async () => {
  expect((await POST(req("remove"), params)).status).toBe(200);
  expect(mock.remove).toHaveBeenCalledWith({ where: { userId: "reader", packId: id } }); expect(mock.upsert).not.toHaveBeenCalled();
});
it("does not install an incomplete import", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {}); mock.pack.mockResolvedValue({ ready: false });
  expect((await POST(req("add"), params)).status).toBe(409); expect(mock.upsert).not.toHaveBeenCalled(); vi.restoreAllMocks();
});
it("reads the pack without loading its Telegram file snapshot or storage keys", async () => {
  mock.pack.mockResolvedValue({ id, sourceName: "test", title: "Test", kind: "emoji", count: 0, ready: true, updatedAt: new Date(0), items: [] });
  const response = await GET(new NextRequest(`http://localhost/api/packs/${id}`), params);
  expect(response.status).toBe(200);
  const selection = mock.pack.mock.calls[0][0].select;
  expect(selection.sourceSnapshot).toBeUndefined();
  expect(selection.items.select.objectKey).toBeUndefined();
  expect((await response.json()).data.pack).toMatchObject({ title: "Test", items: [] });
});
