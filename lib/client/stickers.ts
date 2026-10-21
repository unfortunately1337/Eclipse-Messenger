export type StickerItem = {
  id: string;
  src: string;
  name: string;
  emoji: string;
};

export type StickerPack = {
  id: string;
  title: string;
  stickers: StickerItem[];
};

export const STICKER_PACKS: StickerPack[] = [];

export const ALL_STICKER_SRCS = Array.from(
  new Set(STICKER_PACKS.flatMap((pack) => pack.stickers.map((s) => s.src)))
);

const STICKER_EMOJI_BY_SRC = new Map<string, string>([
  ["/stickers/tg-duck-greeting.tgs", "👋"],
  ["/stickers/tg-duck-talk.tgs", "💬"],
  ["/stickers/tg-duck-sleep.tgs", "😴"],
  ["/stickers/tg-duck-cleaning.tgs", "🧹"],
  ["/stickers/tg-duck-searching.tgs", "🔍"],
  ["/stickers/tg-duck-notfound.tgs", "🤷"],
  ["/stickers/tg-duck-ban.tgs", "🔨"],
  ["/stickers/utya-tg-Amazing_1.json", "🤩"],
  ["/stickers/utya-tg-Angry_1.json", "😡"],
  ["/stickers/utya-tg-Crying_1.json", "😭"],
  ["/stickers/utya-tg-Excited_1.json", "🎉"],
  ["/stickers/utya-tg-Emotionless_1.json", "😐"],
  ["/stickers/duck-dance.json", "💃"],
  ["/stickers/duck-detective.json", "🕵️"],
  ["/stickers/duck-knife.json", "🔪"],
  ["/stickers/tg-flame.tgs", "🔥"],
  ["/stickers/tg-party.tgs", "🎉"],
  ["/stickers/tg-sparkles.tgs", "✨"],
  ["/stickers/tg-diamond.tgs", "💎"],
  ["/stickers/tg-cake.tgs", "🎂"],
  ["/stickers/tg-robot.tgs", "🤖"],
  ["/stickers/tg-eyes.tgs", "👀"],
  ["/stickers/tg-writing.tgs", "✍️"],
  ["/stickers/tg-stop.tgs", "✋"],
  ["/stickers/tg-palette.tgs", "🎨"],
  ["/stickers/tg-camera.tgs", "📷"],
  ["/stickers/tg-hours.tgs", "⏳"],
  ["/stickers/tg-fragment.tgs", "⭐️"],
  ["/stickers/tg-cocoon.tgs", "🔮"],
  ["/stickers/tg-monkey-tracking.tgs", "👀"],
  ["/stickers/tg-monkey-peek.tgs", "🙈"],
  ["/stickers/tg-monkey-close.tgs", "🙈"],
  ["/stickers/tg-monkey-idle.tgs", "🐒"],
  ["/stickers/pepe-chill.json", "☕"],
  ["/stickers/pepe-laugh.json", "😂"],
  ["/stickers/pepe-love.json", "❤️"],
  ["/stickers/pepe-cry.json", "😭"],
  ["/stickers/pepe-coffee.json", "☕"],
  ["/stickers/pepe-rage.json", "😡"],
  ["/stickers/cat-vibe.json", "🐱"],
  ["/stickers/cat-heart.json", "😻"],
  ["/stickers/cat-sleep.json", "💤"],
  ["/stickers/meme-doge.json", "🐕"],
  ["/stickers/meme-stonks.json", "📈"],
  ["/stickers/react-fire.json", "🔥"],
  ["/stickers/react-100.json", "💯"],
  ["/stickers/react-boom.json", "💥"],
  ["/stickers/react-rocket.json", "🚀"],
  ["/stickers/dev-laptop.json", "💻"],
  ["/stickers/dev-git.json", "🐙"],
  ["/stickers/dev-bug.json", "🐛"],
  ["/stickers/pixel-sword.json", "⚔️"],
  ["/stickers/pixel-heart.json", "💖"],
  ["/stickers/pixel-coin.json", "🪙"],
  ["/stickers/hallo.json", "👋"],
  ["/stickers/coffee.json", "☕"],
]);

export function getStickerEmojiBySrc(src: string): string {
  if (!src) return "✨";
  const direct = STICKER_EMOJI_BY_SRC.get(src);
  if (direct) return direct;

  for (const pack of STICKER_PACKS) {
    for (const sticker of pack.stickers) {
      if (sticker.src === src && sticker.emoji) {
        return sticker.emoji;
      }
    }
  }

  if (src.includes("flame") || src.includes("fire")) return "🔥";
  if (src.includes("party")) return "🎉";
  if (src.includes("sparkle") || src.includes("diamond")) return "✨";
  if (src.includes("greeting") || src.includes("hello") || src.includes("hallo")) return "👋";
  if (src.includes("duck")) return "🦆";
  if (src.includes("monkey")) return "🐒";
  if (src.includes("cake")) return "🎂";
  if (src.includes("robot")) return "🤖";
  if (src.includes("sleep")) return "😴";
  if (src.includes("cry")) return "😭";
  if (src.includes("laugh")) return "😂";
  if (src.includes("love") || src.includes("heart")) return "❤️";
  if (src.includes("coffee")) return "☕";
  return "✨";
}

type StickerAnimationData = Record<string, unknown>;
const stickerDataCache = new Map<string, StickerAnimationData>();
const pendingStickerData = new Map<string, Promise<StickerAnimationData>>();
const MAX_STICKER_DATA = 64;
function cacheStickerData(src: string, data: StickerAnimationData) {
  if (stickerDataCache.size >= MAX_STICKER_DATA) {
    const oldest = stickerDataCache.keys().next().value;
    if (oldest) stickerDataCache.delete(oldest);
  }
  stickerDataCache.set(src, data);
}

export function fetchStickerAnimationData(src: string): Promise<StickerAnimationData> {
  const cached = stickerDataCache.get(src);
  if (cached) {
    stickerDataCache.delete(src);
    stickerDataCache.set(src, cached);
    return Promise.resolve(cached);
  }
  const existing = pendingStickerData.get(src);
  if (existing) return existing;
  const pending = loadStickerAnimationData(src).finally(() => pendingStickerData.delete(src));
  pendingStickerData.set(src, pending);
  return pending;
}

/**
 * Loads and caches sticker animation data, automatically handling both `.json` (Lottie)
 * and `.tgs` (gzipped Telegram animated sticker) formats via native DecompressionStream
 * with fallback to uncompressed JSON.
 */
async function loadStickerAnimationData(src: string): Promise<StickerAnimationData> {
  const cached = stickerDataCache.get(src);
  if (cached) return cached;

  const isTgs =
    src.endsWith(".tgs") ||
    src.includes(".tgs?") ||
    src.includes("tg-");

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      if (src.endsWith(".tgs")) {
        const jsonFallbackUrl = src.replace(/\.tgs(\?.*)?$/, ".json$1");
        const jsonFallbackRes = await fetch(jsonFallbackUrl, { signal: AbortSignal.timeout(10_000) });
        if (jsonFallbackRes.ok) {
          const fallbackData = await jsonFallbackRes.json();
          cacheStickerData(src, fallbackData);
          return fallbackData;
        }
      }
      throw new Error(`Failed to load sticker ${src}: ${res.status}`);
    }

    if (isTgs) {
      if (typeof DecompressionStream !== "undefined") {
        try {
          const ds = new DecompressionStream("gzip");
          const decompressedStream = res.clone().body?.pipeThrough(ds);
          if (decompressedStream) {
            const decompressedBlob = await new Response(decompressedStream).blob();
            const text = await decompressedBlob.text();
            const parsed = JSON.parse(text);
            cacheStickerData(src, parsed);
            return parsed;
          }
        } catch {
          // DecompressionStream failed, fallback to json
        }
      }

      const jsonUrl = src.replace(/\.tgs(\?.*)?$/, ".json$1");
      try {
        const jsonRes = await fetch(jsonUrl, { signal: AbortSignal.timeout(10_000) });
        if (jsonRes.ok) {
          const jsonData = await jsonRes.json();
          cacheStickerData(src, jsonData);
          return jsonData;
        }
      } catch {
        // ignore
      }
    }

    const data = await res.json();
    cacheStickerData(src, data);
    return data;
  } catch (err) {
    if (src.endsWith(".tgs")) {
      try {
        const jsonUrl = src.replace(/\.tgs(\?.*)?$/, ".json$1");
        const jsonRes = await fetch(jsonUrl, { signal: AbortSignal.timeout(10_000) });
        if (jsonRes.ok) {
          const jsonData = await jsonRes.json();
          cacheStickerData(src, jsonData);
          return jsonData;
        }
      } catch {
        // ignore
      }
    }
    throw err;
  }
}
