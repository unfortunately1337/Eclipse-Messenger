import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  managedBot: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  botUpdate: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  query: vi.fn(), transaction: vi.fn(), post: vi.fn(),
}));
vi.mock("./prisma", () => ({ prisma: { managedBot: fake.managedBot, botUpdate: fake.botUpdate, $transaction: fake.transaction } }));
vi.mock("./bot-messaging", () => ({ enqueueBotUpdate: vi.fn(), apiBotMessage: vi.fn(), botVisibleUser: vi.fn() }));
vi.mock("./db-crypto", () => ({ decryptAtRest: (value: string) => value }));
vi.mock("./bot-webhook-target", () => ({ postBotWebhook: fake.post }));
import { deliverBotWebhooks } from "./bot-updates";

beforeEach(() => {
  vi.resetAllMocks();
  const bot = { id: "bot", webhookUrlEnc: "https://example.org/hook", webhookSecretEnc: "secret", webhookVersion: 3 };
  fake.managedBot.findMany.mockResolvedValue([bot]); fake.managedBot.findUnique.mockResolvedValue(bot); fake.managedBot.update.mockResolvedValue(bot);
  fake.query.mockResolvedValue([{ id: "bot" }]);
  fake.transaction.mockImplementation(callback => callback({ $queryRaw: fake.query, managedBot: fake.managedBot, botUpdate: fake.botUpdate }));
  const update = { id: "event", updateId: 7, payloadEnc: JSON.stringify({ message: { text: "hello" } }), attempts: 0, lockedUntil: null, nextAttemptAt: new Date(0) };
  fake.botUpdate.findFirst.mockResolvedValue(update); fake.botUpdate.update.mockResolvedValue({ ...update, attempts: 1 });
});
it("acknowledges only a successfully delivered event with matching webhook version", async () => {
  await deliverBotWebhooks();
  expect(fake.post).toHaveBeenCalledWith("https://example.org/hook", "secret", { update_id: 7, message: { text: "hello" } });
  expect(fake.botUpdate.update.mock.calls[0][0].data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  expect(fake.botUpdate.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "event", bot: { webhookVersion: 3 } }, data: { acknowledgedAt: expect.any(Date), lockedUntil: null, lastError: null } });
});
it("retries failures without acknowledging and without persisting secret-bearing errors", async () => {
  fake.post.mockRejectedValue(new Error("secret URL, token and body")); await deliverBotWebhooks();
  const change = fake.botUpdate.updateMany.mock.calls[0][0].data;
  expect(change.acknowledgedAt).toBeUndefined(); expect(change.lastError).toBe("Webhook delivery failed"); expect(change.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
});
it("does not bypass the earliest failed or leased event", async () => {
  fake.botUpdate.findFirst.mockResolvedValue({ nextAttemptAt: new Date(Date.now() + 60000), lockedUntil: null }); await deliverBotWebhooks(); expect(fake.post).not.toHaveBeenCalled();
  fake.botUpdate.findFirst.mockResolvedValue({ nextAttemptAt: new Date(0), lockedUntil: new Date(Date.now() + 60000) }); await deliverBotWebhooks(); expect(fake.post).not.toHaveBeenCalled();
  expect(fake.botUpdate.findFirst.mock.calls[0][0].orderBy).toEqual({ updateId: "asc" });
});
it("another worker's row lock and a changed webhook prevent stale deliveries", async () => {
  fake.query.mockResolvedValue([]); await deliverBotWebhooks(); expect(fake.post).not.toHaveBeenCalled();
  fake.query.mockResolvedValue([{ id: "bot" }]); fake.managedBot.findUnique.mockResolvedValue({ webhookVersion: 4 }); await deliverBotWebhooks(); expect(fake.post).not.toHaveBeenCalled();
  expect(fake.botUpdate.updateMany).toHaveBeenCalledWith({ where: { id: "event" }, data: { lockedUntil: null } });
});
