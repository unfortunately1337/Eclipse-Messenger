import { beforeEach, afterEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ ticket: vi.fn(), deleteTickets: vi.fn(), createTicket: vi.fn(), updateTicket: vi.fn(), account: vi.fn(), upsert: vi.fn(), disconnect: vi.fn(), raw: vi.fn(), request: vi.fn() }));
vi.mock("./telegram-pack-import", () => ({ telegramRequest: fake.request }));
vi.mock("./prisma", () => {
  const db = { telegramImportTicket: { findUnique: fake.ticket, deleteMany: fake.deleteTickets, create: fake.createTicket, update: fake.updateTicket }, packImporterState: { findUnique: fake.account, upsert: fake.upsert, updateMany: fake.disconnect }, $executeRaw: fake.raw };
  return { prisma: { ...db, $transaction: (run: (value: typeof db) => unknown) => run(db) } };
});
import { disconnectTelegramImporter, issueTelegramImportLink, redeemTelegramImportLink, telegramTicketHash } from "./telegram-import-link";
const token = "a".repeat(32);
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("TELEGRAM_IMPORT_BOT_TOKEN", "123:secret"); fake.request.mockResolvedValue({ id: 123, username: "examplebot" }); });
afterEach(() => vi.unstubAllEnvs());
it("stores only a hash and issues a five-minute single-use link for the authenticated account", async () => {
  const result = await issueTelegramImportLink("user");
  expect(result.url).toMatch(/^https:\/\/t.me\/examplebot\?start=import_[A-Za-z0-9_-]{32}$/);
  const raw = new URL(result.url).searchParams.get("start")!.slice(7);
  const data = fake.createTicket.mock.calls[0][0].data;
  expect(data.tokenHash).toBe(telegramTicketHash(raw)); expect(data.tokenHash).not.toBe(raw);
  expect(data.userId).toBe("user"); expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(290_000);
});
it("rejects missing, expired and previously consumed links", async () => {
  for (const ticket of [null, { userId: "user", expiresAt: new Date(0) }, { userId: "user", expiresAt: new Date(Date.now() + 10000), consumedUpdateId: "another-event" }]) {
    fake.ticket.mockResolvedValue(ticket);
    await expect(redeemTelegramImportLink(token, 42, "event")).rejects.toThrow();
  }
  expect(fake.upsert).not.toHaveBeenCalled();
});
it("does not silently attach a Telegram account already owned by another Eclipse user", async () => {
  fake.ticket.mockResolvedValue({ userId: "user", expiresAt: new Date(Date.now() + 10000), consumedUpdateId: null });
  fake.account.mockResolvedValue({ userId: "other-user" });
  await expect(redeemTelegramImportLink(token, 42, "event")).rejects.toThrow("другому аккаунту");
  expect(fake.upsert).not.toHaveBeenCalled();
});
it("allows an identical update retry but consumes the link for any other event", async () => {
  fake.ticket.mockResolvedValue({ userId: "user", expiresAt: new Date(Date.now() + 10000), consumedUpdateId: "event" });
  fake.account.mockResolvedValue(null);
  await expect(redeemTelegramImportLink(token, 42, "event")).resolves.toBe("user");
  expect(fake.upsert.mock.calls[0][0].update.telegramAccount).toBe("123:42");
});
it("disconnects the account and invalidates all outstanding links", async () => {
  await disconnectTelegramImporter("user");
  expect(fake.disconnect).toHaveBeenCalledWith({ where: { userId: "user" }, data: { telegramAccount: null, telegramLinkedAt: null } });
  expect(fake.deleteTickets).toHaveBeenCalledWith({ where: { userId: "user" } });
});
