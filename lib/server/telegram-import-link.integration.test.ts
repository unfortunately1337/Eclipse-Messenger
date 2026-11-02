import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import dotenv from "dotenv";
vi.mock("./telegram-pack-import", () => ({ telegramRequest: async () => ({ id: 123, username: "integrationbot" }) }));
import { prisma } from "./prisma";
import { disconnectTelegramImporter, issueTelegramImportLink, redeemTelegramImportLink, telegramTicketHash } from "./telegram-import-link";

describe.skipIf(process.env.TELEGRAM_IMPORT_INTEGRATION !== "1")("Telegram linking against the local database", () => {
  const ids: string[] = [], run = randomUUID().slice(0, 8);
  const rawToken = (url: string) => new URL(url).searchParams.get("start")!.slice(7);
  beforeAll(async () => {
    dotenv.config({ quiet: true });
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Only the local database can be used");
    vi.stubEnv("TELEGRAM_IMPORT_BOT_TOKEN", "123:integration-test");
    for (let i = 0; i < 2; i++) ids.push((await prisma.user.create({ data: { link: `tgcheck_${run}_${i}`, displayName: "Telegram import check", passwordHash: randomUUID() } })).id);
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: ids } } }); vi.unstubAllEnvs(); await prisma.$disconnect(); });
  it("persists a single-use, account-scoped link, prevents takeover, and disconnects", async () => {
    const token = rawToken((await issueTelegramImportLink(ids[0])).url);
    expect(await redeemTelegramImportLink(token, 42, `first-${run}`)).toBe(ids[0]);
    expect(await redeemTelegramImportLink(token, 42, `first-${run}`)).toBe(ids[0]);
    await expect(redeemTelegramImportLink(token, 43, `replay-${run}`)).rejects.toThrow();
    const other = rawToken((await issueTelegramImportLink(ids[1])).url);
    await expect(redeemTelegramImportLink(other, 42, `other-${run}`)).rejects.toThrow("другому аккаунту");
    await disconnectTelegramImporter(ids[0]);
    expect((await prisma.packImporterState.findUnique({ where: { userId: ids[0] } }))?.telegramAccount).toBeNull();
    await expect(redeemTelegramImportLink(token, 42, `first-${run}`)).rejects.toThrow();
  });
  it("only allows one winner when two Telegram accounts redeem a token simultaneously", async () => {
    const token = rawToken((await issueTelegramImportLink(ids[0])).url);
    const result = await Promise.allSettled([redeemTelegramImportLink(token, 51, `race-a-${run}`), redeemTelegramImportLink(token, 52, `race-b-${run}`)]);
    expect(result.filter(value => value.status === "fulfilled")).toHaveLength(1);
    expect(result.filter(value => value.status === "rejected")).toHaveLength(1);
  });
  it("rejects an expired ticket stored in the database", async () => {
    const token = rawToken((await issueTelegramImportLink(ids[0])).url);
    await prisma.telegramImportTicket.update({ where: { tokenHash: telegramTicketHash(token) }, data: { expiresAt: new Date(0) } });
    await expect(redeemTelegramImportLink(token, 55, `expired-${run}`)).rejects.toThrow();
  });
});
