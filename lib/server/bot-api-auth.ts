import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { hashBotToken } from "./bot-management-validation";
import { enforceRateLimit } from "./rate-limit";
import { HttpError } from "./http";

export async function requireBot(req: NextRequest) {
  // Bound failed authentication without trusting user-supplied forwarding headers.
  // Valid tokens use a separate per-bot bucket; an attacker cannot consume it.
  const authorization = req.headers.get("authorization") ?? "";
  const match = /^Bearer (ecb_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43})$/i.exec(authorization);
  if (!match) {
    await enforceRateLimit({ key: "bot-api:invalid-auth", limit: 600, windowSeconds: 60 });
    throw new HttpError(401, "Provide a bot token in the Authorization: Bearer header.");
  }
  const bot = await prisma.managedBot.findUnique({ where: { tokenHash: hashBotToken(match[1]) }, include: { profile: true } });
  if (!bot || !bot.profile.isBot || bot.profile.isSystemAccount) {
    await enforceRateLimit({ key: "bot-api:invalid-auth", limit: 600, windowSeconds: 60 });
    throw new HttpError(401, "Invalid or revoked bot token.");
  }
  await enforceRateLimit({ key: `bot-api:${bot.id}`, limit: 120, windowSeconds: 60 });
  return bot;
}
export type AuthenticatedBot = Awaited<ReturnType<typeof requireBot>>;
