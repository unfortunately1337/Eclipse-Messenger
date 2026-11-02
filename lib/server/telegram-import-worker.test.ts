import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), cleanup: vi.fn(), receive: vi.fn(), notify: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { telegramImportUpdate: { findFirst: fake.find, updateMany: fake.update, deleteMany: fake.cleanup }, telegramImportTicket: { deleteMany: fake.cleanup } } }));
vi.mock("./telegram-import-receiver", () => ({ receiveTelegramImportUpdate: fake.receive, notifyTelegramImportFailed: fake.notify }));
import { processTelegramImportUpdates } from "./telegram-import-worker";
const job = { id: "event", payloadEnc: "encrypted", attempts: 0, status: "queued", leasedUntil: null };
beforeEach(() => { vi.resetAllMocks(); fake.update.mockResolvedValue({ count: 1 }); fake.find.mockResolvedValueOnce(job).mockResolvedValue(null); });
it("claims a durable lease, handles the message, and clears its private payload on completion", async () => {
  await processTelegramImportUpdates();
  expect(fake.update.mock.calls[0][0].data.status).toBe("processing");
  expect(fake.receive).toHaveBeenCalledWith("event", "encrypted");
  expect(fake.update.mock.lastCall![0].data).toEqual({ status: "done", leaseId: null, leasedUntil: null, payloadEnc: "" });
});
it("keeps transient failures retryable with a delay", async () => {
  fake.receive.mockRejectedValue(new Error("network")); await processTelegramImportUpdates();
  const retry = fake.update.mock.lastCall![0].data;
  expect(retry.status).toBe("processing"); expect(retry.leasedUntil.getTime()).toBeGreaterThan(Date.now() + 14000);
  expect(retry.payloadEnc).toBeUndefined();
});
it("does not process another worker's leased event", async () => {
  fake.update.mockResolvedValueOnce({ count: 0 }); await processTelegramImportUpdates(); expect(fake.receive).not.toHaveBeenCalled();
});
it("stops after three failed attempts and removes the private payload", async () => {
  fake.find.mockReset().mockResolvedValueOnce({ ...job, attempts: 2 }).mockResolvedValue(null); fake.receive.mockRejectedValue(new Error("unavailable"));
  await processTelegramImportUpdates(); expect(fake.update.mock.lastCall![0].data).toMatchObject({ status: "failed", payloadEnc: "" });
});
it("drains waiting updates in order without sleeping between user interactions", async () => {
  fake.find.mockReset().mockResolvedValueOnce(job).mockResolvedValueOnce({ ...job, id: "second" }).mockResolvedValue(null);
  await processTelegramImportUpdates();
  expect(fake.receive.mock.calls.map(args => args[0])).toEqual(["event", "second"]);
  expect(fake.receive.mock.invocationCallOrder[1]).toBeGreaterThan(fake.update.mock.invocationCallOrder[1]);
});
it("bounds each queue burst so a busy Telegram bot yields between batches", async () => {
  fake.find.mockReset().mockResolvedValue(job);
  await processTelegramImportUpdates();
  expect(fake.receive).toHaveBeenCalledTimes(8);
});
