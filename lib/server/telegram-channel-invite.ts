import { createHash, randomInt } from "node:crypto";
import { redis } from "./redis";
import { telegramRequest } from "./telegram-pack-import";
import { telegramImporterBotId } from "./telegram-import-link";
import { localizeSystemText } from "@/lib/i18n/translate";

export const ECLIPSE_TELEGRAM_CHANNEL = "https://t.me/eclipsemessenger";
const invitation = "Подпишитесь на канал Eclipse в Telegram, чтобы узнавать о новостях и обновлениях. Подписка необязательна и не влияет на импорт.";

/** Only called in response to a private user interaction, never a broadcast. */
export async function maybeInviteToEclipseChannel(chatId: number, languageCode?: string) {
  try {
    const recipient = createHash("sha256").update(String(chatId)).digest("hex");
    const key = `telegram-import:channel-invite:v1:${telegramImporterBotId()}:${recipient}`;
    // Claim before sending: concurrent updates and retries cannot send a second
    // invitation. Keep the cooldown even on an ambiguous Telegram timeout.
    const seconds = randomInt(30 * 86400, 60 * 86400 + 1);
    if (!await redis.setIfAbsent(key, "shown", seconds)) return;
    const locale = languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en";
    await telegramRequest("sendMessage", {
      chat_id: String(chatId), text: localizeSystemText(invitation, locale),
      disable_notification: "true",
      link_preview_options: JSON.stringify({ is_disabled: true }),
      reply_markup: JSON.stringify({ inline_keyboard: [[{ text: localizeSystemText("Подписаться", locale), url: ECLIPSE_TELEGRAM_CHANNEL }]] }),
    });
  } catch {
    // This optional suggestion must never block linking or pack imports.
  }
}
