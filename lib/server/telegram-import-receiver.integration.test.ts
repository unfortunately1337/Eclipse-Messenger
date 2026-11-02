import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import dotenv from "dotenv";
const replies = vi.hoisted(() => vi.fn());
vi.mock("./telegram-pack-import", async load => {
  const original = await load<typeof import("./telegram-pack-import")>();
  return { ...original, telegramRequest: (method: Parameters<typeof original.telegramRequest>[0], data: Record<string, string>) => method === "sendMessage" ? replies(data) : original.telegramRequest(method, data) };
});
import { prisma } from "./prisma";
import { encryptAtRest } from "./db-crypto";
import { receiveTelegramImportUpdate } from "./telegram-import-receiver";
import { telegramImporterBotId } from "./telegram-import-link";

describe.skipIf(process.env.TELEGRAM_IMPORT_INTEGRATION !== "1")("Telegram pack detection against local Eclipse and the real Telegram pack API", () => {
  const run = randomUUID().slice(0, 8); let userId = "";
  const sender = 4_000_000_000_000 + Date.now() % 1_000_000_000;
  beforeAll(async () => {
    dotenv.config({ quiet: true });
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Only local Eclipse data is allowed");
    userId = (await prisma.user.create({ data: { link: `tgbridge_${run}`, displayName: "Telegram bridge check", passwordHash: randomUUID() } })).id;
    await prisma.packImporterState.create({ data: { userId, telegramAccount: `${telegramImporterBotId()}:${sender}`, telegramLinkedAt: new Date() } });
    replies.mockResolvedValue({});
  });
  afterAll(async () => {
    if (userId) {
      await prisma.conversation.deleteMany({ where: { participants: { some: { userId } } } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });
  it("turns a received sticker into one real pack confirmation without automatically installing it", async () => {
    const eventId = `integration-${run}`;
    const message = encryptAtRest(JSON.stringify({ update_id: Date.now(), message: { message_id: 1, from: { id: sender }, chat: { id: sender, type: "private" }, sticker: { set_name: "GreatMinds", type: "regular" } } }));
    await receiveTelegramImportUpdate(eventId, message);
    await receiveTelegramImportUpdate(eventId, message);
    const cards = await prisma.message.findMany({ where: { id: { startsWith: `telegram-pack:${eventId}:` } } });
    expect(cards).toHaveLength(1);
    const payload = cards[0].systemPayload as { metadata?: { packImport?: { title: string; count: number; status: string } } };
    expect(payload.metadata?.packImport).toMatchObject({ count: 3, status: "confirm" });
    expect(await prisma.userImportedPack.count({ where: { userId } })).toBe(0);
    expect(replies).toHaveBeenCalled();
  }, 60000);
});
