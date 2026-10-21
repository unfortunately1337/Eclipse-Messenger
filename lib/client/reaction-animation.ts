import { getTelegramEmojiGifUrl, getTelegramEmojiPreviewUrl } from "./telegram-emoji-gifs";
import assets from "./emoji-animation-assets.json";

type AnimationAsset = { preview: string; durationMs: number; reactionScale?: number };
const catalog = assets as Record<string, AnimationAsset>;
const warmed = new Map<string, HTMLImageElement>();
export function reactionAnimationAsset(emoji: string): AnimationAsset | null {
  const name = getTelegramEmojiGifUrl(emoji)?.split("/").pop();
  const asset = name ? catalog[name] : null;
  return asset ? { ...asset, preview: getTelegramEmojiPreviewUrl(emoji) ?? asset.preview } : null;
}

// Small local previews are fetched and decoded before the realtime event arrives.
// Keep one warm image per URL; the original 512 px GIFs are never preloaded here.
export function warmReactionAnimations(emojis: readonly string[]) {
  if (typeof Image === "undefined") return;
  for (const emoji of emojis) {
    const asset = reactionAnimationAsset(emoji);
    if (!asset || warmed.has(asset.preview)) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = asset.preview;
    warmed.set(asset.preview, img);
    void img.decode().catch(() => {});
  }
}

export function shouldAnimateReaction(
  previousCount: number,
  nextCount: number,
) {
  return nextCount > previousCount;
}
