import React from "react";
import emojiMap from "@/public/emoji-map.json";

export const GROUP_NAME_COLORS = ["text-sky-400", "text-pink-400", "text-orange-400", "text-green-400"] as const;
export const CHAT_ITEM_ESTIMATED_HEIGHT = 72;
export const CHAT_PAGE_SIZE = 60;

export const STICKER_CATALOG = [
  "/stickers/hallo.json",
  "/stickers/puga-fun.json",
  "/stickers/puga-laughing.json",
  "/stickers/puga-sleep1.json",
  "/stickers/puga-comp-1.json",
  "/stickers/puga-crying.json",
  "/stickers/puga-run-3.json",
  "/stickers/coffee.json",
  "/stickers/puga-relax.json",
  "/stickers/puga-ananas.json",
  "/stickers/puga-cool.json",
] as const;

import { TELEGRAM_COMPOSER_EMOJIS } from "@/lib/client/telegram-emoji-gifs";

export const COMPOSER_EMOJIS = TELEGRAM_COMPOSER_EMOJIS;

export function isGeneratedDefaultAvatarUrl(avatarUrl?: string | null) {
  const value = (avatarUrl ?? "").trim();
  return value.startsWith("data:image/svg+xml;charset=UTF-8,");
}

export function pickGroupNameColor(seed?: string | null) {
  if (!seed) return GROUP_NAME_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % GROUP_NAME_COLORS.length;
  }
  return GROUP_NAME_COLORS[hash];
}

export { renderStaticEmojiText as renderTextWithEmojis } from "@/components/StaticEmojiText";
