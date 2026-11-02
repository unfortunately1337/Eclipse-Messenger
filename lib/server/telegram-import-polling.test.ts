import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ request: vi.fn(), queue: vi.fn(), get: vi.fn(), set: vi.fn(), acquire: vi.fn(), renew: vi.fn(), release: vi.fn() }));
vi.mock("./telegram-pack-import", () => ({ telegramRequest: fake.request }));
vi.mock("./telegram-import-link", () => ({ telegramImporterBotId: () => "123" }));
vi.mock("./redis", () => ({ redis: { setIfAbsent: fake.acquire, compareAndSet: fake.renew, compareAndDelete: fake.release, get: fake.get, set: fake.set } }));
vi.mock("./telegram-import-receiver", async load => {
  const original = await load<typeof import("./telegram-import-receiver")>();
  return { telegramImportUpdateSchema: original.telegramImportUpdateSchema, enqueueTelegramImportUpdate: fake.queue };
});
import { pollTelegramImporter } from "./telegram-import-polling";
beforeEach(() => {
  vi.resetAllMocks();
  (globalThis as typeof globalThis & { telegramImportWebhookCheck?: unknown }).telegramImportWebhookCheck = undefined;
  fake.acquire.mockResolvedValue(true); fake.renew.mockResolvedValue(true); fake.get.mockResolvedValue(null);
  fake.release.mockResolvedValue(true);
  fake.request.mockImplementation(async method => method === "getWebhookInfo" ? { url: "" } : []);
});
it("never takes updates from an already configured production webhook", async () => {
  fake.request.mockResolvedValue({ url: "https://eclpse.ru/api/telegram/importer/webhook" });
  await pollTelegramImporter(); expect(fake.request).toHaveBeenCalledTimes(1); expect(fake.set).not.toHaveBeenCalled();
});
it("saves its offset only after updates are durably queued", async () => {
  fake.request.mockImplementation(async method => method === "getWebhookInfo" ? { url: "" } : [{ update_id: 21 }, { update_id: 22 }]);
  await pollTelegramImporter(); expect(fake.queue).toHaveBeenCalledTimes(2); expect(fake.set).toHaveBeenCalledWith("telegram-import:offset:123", "23");
  expect(fake.queue.mock.invocationCallOrder[1]).toBeLessThan(fake.set.mock.invocationCallOrder[0]);
});
it("does not acknowledge an update when persistence failed", async () => {
  fake.request.mockImplementation(async method => method === "getWebhookInfo" ? { url: "" } : [{ update_id: 21 }]);
  fake.queue.mockRejectedValue(new Error("database unavailable"));
  await expect(pollTelegramImporter()).rejects.toThrow(); expect(fake.set).not.toHaveBeenCalled(); expect(fake.release).toHaveBeenCalled();
});
it("leaves polling to the process that owns the shared lease", async () => {
  fake.acquire.mockResolvedValue(false); await pollTelegramImporter(); expect(fake.request).not.toHaveBeenCalled();
});
