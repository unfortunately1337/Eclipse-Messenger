import assets from "./inline-emoji-assets.json";
import { getTelegramEmojiGifUrl, TELEGRAM_COMPOSER_EMOJIS } from "./telegram-emoji-gifs";

export const DEFAULT_ANIMATED_EMOJIS = [...new Set(TELEGRAM_COMPOSER_EMOJIS)].filter(emoji => {
  const filename = getTelegramEmojiGifUrl(emoji)?.split("/").pop();
  return filename ? (assets as Record<string,{animated?:boolean}>)[filename]?.animated === true : false;
});
