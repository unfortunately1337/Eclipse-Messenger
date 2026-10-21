import emojiAnimationAssets from "./emoji-animation-assets.json";
import inlineEmojiAssets from "./inline-emoji-assets.json";
/**
 * Telegram Animated Emoji GIFs Mapping
 * Source repository: https://github.com/goforbg/telegram-emoji-gifs
 * CDN base: https://cdn.jsdelivr.net/gh/goforbg/telegram-emoji-gifs@master/
 */

export const TELEGRAM_EMOJI_GIF_MAP: Record<string, string> = {
  "100": "100.gif",
  "💯": "100.gif",
  "❗": "exclamation.gif",
  "❗️": "exclamation.gif",
  "❕": "white-exclamation.gif",
  "❓": "question.gif",
  "❔": "white-question.gif",
  "❌": "x.gif",
  "🚩": "flag.gif",
  "💬": "chat-bubble.gif",
  "💭": "think-bubble.gif",
  "💥": "boom.gif",
  "🔥": "fire.gif",
  "🔐": "lock-key.gif",
  "⚡": "thunder.gif",
  "⚡️": "thunder.gif",
  "⭐": "star.gif",
  "⭐️": "star.gif",
  "✨": "star-twinkl.gif",
  "💢": "beat-up.gif",
  "♨️": "getting-hot.gif",
  "♨": "getting-hot.gif",
  "💤": "sleep-zzz.gif",
  "🫧": "soap-bubbles.gif",
  "🌑": "0-moon.gif",
  "🌒": "1-4-moon.gif",
  "🌓": "1-2-moon.gif",
  "🌔": "3-4-moon.gif",
  "🌕": "full-moon.gif",
  "🌖": "more-moon.gif",
  "🌗": "half-moon.gif",
  "🌘": "1-4-moon-rev.gif",
  "🌚": "black-full-moon-face.gif",
  "🌛": "half-moon-face.gif",
  "🌜": "other-halff-moon-face.gif",
  "🌝": "sun-bald.gif",
  "🌞": "sun-shine.gif",
  "☀️": "sun-shine.gif",
  "☀": "sun-shine.gif",
  "😀": "jumping-laugh.gif",
  "😃": "big-laugh.gif",
  "😄": "bouncing-laugh.gif",
  "😁": "big-smile.gif",
  "😆": "funny-laugh.gif",
  "😅": "stressed-laugh.gif",
  "😂": "tears-with-joy.gif",
  "🤣": "tears-of-joy-laughter.gif",
  "🥲": "tears-with-smile.gif",
  "😊": "smiling-nice.gif",
  "☺️": "nice-guy-smile.gif",
  "☺": "nice-guy-smile.gif",
  "😇": "angel.gif",
  "🙂": "creepy-smile.gif",
  "🙃": "upside-down-creepy-smile.gif",
  "😉": "wink.gif",
  "😌": "relaxed.gif",
  "😍": "heart-eyes.gif",
  "🥰": "feeling-loved.gif",
  "😘": "kiss.gif",
  "😗": "kissing.gif",
  "😋": "cute-tongue-stick-out.gif",
  "😛": "tongue-out.gif",
  "😜": "crazy-tongue-stick-out.gif",
  "🤪": "crazy-eyes-tongue.gif",
  "😝": "eyes-closed-tongue-stick-out.gif",
  "🤑": "money-face.gif",
  "🤗": "hands-nice-guy.gif",
  "🤭": "blush.gif",
  "🤫": "shushh.gif",
  "🤔": "thinking.gif",
  "🤐": "mouth-shut.gif",
  "😐": "not-impressed.gif",
  "😑": "very-annoyed.gif",
  "😶": "speechless.gif",
  "😏": "smirk.gif",
  "😒": "annoyed.gif",
  "🙄": "eye-rolling.gif",
  "😬": "awkward-smile.gif",
  "😔": "sad.gif",
  "😪": "tired.gif",
  "🤤": "drool.gif",
  "😴": "about-to-sleep.gif",
  "😷": "masked.gif",
  "🤒": "sick-thermometer.gif",
  "🤕": "head-bandage.gif",
  "🤢": "about-to-puke.gif",
  "🤮": "puking.gif",
  "🤧": "mouth-sneeze.gif",
  "🥵": "hot.gif",
  "🥶": "cold.gif",
  "🥴": "drunk.gif",
  "🤯": "mind-blown.gif",
  "🤠": "cowboy.gif",
  "🥳": "party.gif",
  "😎": "cool-with-glasses.gif",
  "🤓": "nerd.gif",
  "🧐": "finding-eye-glass.gif",
  "🥸": "detective-make-up.gif",
  "😕": "dissapointed.gif",
  "😟": "very-sad.gif",
  "🙁": "slightly-dissapointed.gif",
  "☹️": "frown.gif",
  "☹": "frown.gif",
  "😮": "whoa.gif",
  "😯": "slightly-shocked.gif",
  "😲": "teeth-shocked.gif",
  "😳": "shocked.gif",
  "🥺": "simp.gif",
  "😦": "mouth-opening.gif",
  "😧": "very-shocked.gif",
  "😨": "stress-shocked.gif",
  "😰": "AnimatedEmojies-512px-250.gif",
  "😢": "tear-drop.gif",
  "😭": "crying.gif",
  "😱": "hands-up-shocked.gif",
  "😖": "sad-broken.gif",
  "😞": "sad-face-down.gif",
  "😓": "AnimatedEmojies-512px-251.gif",
  "😩": "moan.gif",
  "😫": "bad-moan.gif",
  "🥱": "yawn.gif",
  "😤": "angry-nose-bull.gif",
  "😡": "angry-flames.gif",
  "🤬": "swearing.gif",
  "😈": "devil-smirk.gif",
  "👿": "devil-angry.gif",
  "💩": "poop.gif",
  "👻": "snapchat.gif",
  "💀": "skull.gif",
  "☠️": "dead-skull.gif",
  "☠": "dead-skull.gif",
  "🤩": "star-struck.gif",
  "😺": "cat-smiling.gif",
  "😸": "cat-laughing.gif",
  "😹": "cat-tears-of-laughter.gif",
  "😻": "cat-heart-eyes.gif",
  "😼": "cat-smirk.gif",
  "😽": "cat-kissing.gif",
  "🙀": "cat-shocked.gif",
  "😿": "cat-tear-drop.gif",
  "😾": "cat-angry.gif",
  "🙈": "monkey-closed-eyes.gif",
  "🙉": "monkey-face-hide.gif",
  "👋": "wave.gif",
  "👏": "clap.gif",
  "👍": "thumbs-up.gif",
  "👎": "thumbs-down.gif",
  "👊": "punch.gif",
  "✊": "protest.gif",
  "🤛": "left-fist.gif",
  "🤜": "right-fist.gif",
  "🤞": "fingers-crossed.gif",
  "🤟": "rock-on.gif",
  "🤘": "bang-on.gif",
  "🤙": "thumb-up-pinkie-down.gif",
  "👌": "okay-sign.gif",
  "🤌": "loss.gif",
  "🤏": "small-pp.gif",
  "👈": "point-left.gif",
  "👉": "pointing-left.gif",
  "☝️": "point-up.gif",
  "☝": "point-up.gif",
  "👆": "pointing-up.gif",
  "👇": "AnimatedEmojies-512px-220.gif",
  "✋": "right-stop.gif",
  "🤚": "left-stop.gif",
  "🖐️": "right-palm.gif",
  "🖐": "right-palm.gif",
  "👐": "hand-dove.gif",
  "🙌": "hifi.gif",
  "🤲": "hands-together.gif",
  "🙏": "thanks.gif",
  "🤝": "handshake.gif",
  "💪": "bicep-flex.gif",
  "🦾": "robo-arm.gif",
  "🖖": "starwars.gif",
  "✍️": "writing.gif",
  "✍": "writing.gif",
  "❤️": "heart.gif",
  "❤": "heart.gif",
  "🧡": "orange-heart.gif",
  "💛": "yellow-heart.gif",
  "💚": "green-heart.gif",
  "💙": "blue-heart.gif",
  "💜": "purple-heart.gif",
  "🖤": "black-heart.gif",
  "🤍": "silver-heart.gif",
  "🤎": "brown-heart.gif",
  "💔": "heart-broken.gif",
  "❣️": "heart-dot.gif",
  "❣": "heart-dot.gif",
  "💕": "double-heart.gif",
  "💞": "heart-wavering.gif",
  "💓": "heart-wavering.gif",
  "💗": "heart-waves.gif",
  "💖": "heart-twinkle.gif",
  "💘": "heart-cupid.gif",
  "💝": "heart-gift-wrapped.gif",
  "💟": "purple-border-heart.gif",
  "💋": "flyingkiss.gif",
  "💃": "dancing-girl.gif",
  "🕺": "bowie.gif",
  "👵": "grandma.gif",
  "👮‍♀️": "female-cop.gif",
  "👩‍⚕️": "female-doctor.gif",
  "👩‍⚕": "female-doctor.gif",
  "👨‍⚕️": "male-doctor.gif",
  "👨‍⚕": "male-doctor.gif",
  "👩‍💻": "girl-with-laptop.gif",
  "👨‍💻": "guy-with-laptop-1.gif",
  "🧑‍💻": "guy-with-laptop-2.gif",
  "🧑‍🏫": "teacher.gif",
  "🤷‍♀️": "female-shrug.gif",
  "🤷‍♂️": "male-shrug.gif",
  "🤷": "female-shrug.gif",
  "🧛": "old-vampire.gif",
  "🧛‍♀️": "female-vampire.gif",
  "🧛‍♂️": "young-male-vampire.gif",
  "🧟‍♀️": "female-zombie.gif",
  "🧟‍♂️": "male-zombie.gif",
  "🧟": "male-zombie.gif",
  "🦇": "bat.gif",
  "🐥": "chick.gif",
  "🐣": "chicken-hatch.gif",
  "🦉": "owl.gif",
  "🕷️": "spider.gif",
  "🕷": "spider.gif",
  "🕸️": "spider-web.gif",
  "🕸": "spider-web.gif",
  "🌵": "cactus.gif",
  "🎄": "christmas-tree.gif",
  "🌲": "seed-to-tree.gif",
  "🌳": "seed-to-fat-tree.gif",
  "🌱": "seed-to-sapling.gif",
  "🌿": "seed-to-twig.gif",
  "🌷": "flower-expanding.gif",
  "🌺": "hibiscus.gif",
  "🌴": "palm-tree.gif",
  "🏖️": "beach.gif",
  "🏖": "beach.gif",
  "⛄": "snowman-waving.gif",
  "☃️": "snowman.gif",
  "☃": "snowman.gif",
  "🦠": "virus.gif",
  "🍆": "dick.gif",
  "🍑": "ass-tapping.gif",
  "🎂": "birthday-candles.gif",
  "🎈": "baloon.gif",
  "🎉": "party-confetti.gif",
  "🎊": "party-bells.gif",
  "🧮": "abacus.gif",
  "🚑": "ambulance.gif",
  "🚓": "cop-car.gif",
  "🚕": "taxi-cab.gif",
  "⚰️": "coffin.gif",
  "⚰": "coffin.gif",
  "🧭": "compass.gif",
  "👑": "crown.gif",
  "💱": "currency-conversion.gif",
  "💎": "diamond.gif",
  "📁": "folder.gif",
  "📂": "spider-crawl-folder.gif",
  "🗂️": "multiple-folders.gif",
  "🗂": "multiple-folders.gif",
  "🎃": "halloween.gif",
  "⏳": "hour-glass.gif",
  "⌛": "hour-glass.gif",
  "🏠": "house.gif",
  "💡": "idea.gif",
  "💉": "injection.gif",
  "🎮": "joystick.gif",
  "⌨️": "keyboard-typing.gif",
  "⌨": "keyboard-typing.gif",
  "🔍": "magnify-left.gif",
  "🔎": "magnify-right.gif",
  "📬": "mail-box.gif",
  "💌": "mail-love.gif",
  "💸": "money-flying.gif",
  "📝": "pencil-writing.gif",
  "💊": "pill.gif",
  "👛": "purse.gif",
  "🧽": "sponge-cleaning.gif",
  "🧻": "toilet-paper.gif",
  "📢": "trumpet.gif",
  "🥂": "wine-glasses.gif",
  "🗿": "i-am-groot.gif",

};

export const BUNDLED_STATIC_GIFS = new Set([
  "100.gif",
  "about-to-sleep.gif",
  "angry-flames.gif",
  "ass-tapping.gif",
  "baloon.gif",
  "bang-on.gif",
  "bicep-flex.gif",
  "birthday-candles.gif",
  "blush.gif",
  "boom.gif",
  "bouncing-laugh.gif",
  "cat-heart-eyes.gif",
  "cat-laughing.gif",
  "cat-smiling.gif",
  "clap.gif",
  "cold.gif",
  "cool-with-glasses.gif",
  "crazy-eyes-tongue.gif",
  "crown.gif",
  "crying.gif",
  "dead-skull.gif",
  "detective-make-up.gif",
  "devil-smirk.gif",
  "diamond.gif",
  "dick.gif",
  "dissapointed.gif",
  "drool.gif",
  "exclamation.gif",
  "feeling-loved.gif",
  "female-cop.gif",
  "finding-eye-glass.gif",
  "fire.gif",
  "flower-expanding.gif",
  "getting-hot.gif",
  "girl-with-laptop.gif",
  "guy-with-laptop-1.gif",
  "guy-with-laptop-2.gif",
  "hands-together.gif",
  "handshake.gif",
  "heart-broken.gif",
  "heart-eyes.gif",
  "heart-gift-wrapped.gif",
  "heart.gif",
  "hifi.gif",
  "jumping-laugh.gif",
  "keyboard-typing.gif",
  "kiss.gif",
  "lock-key.gif",
  "loss.gif",
  "mind-blown.gif",
  "money-face.gif",
  "monkey-closed-eyes.gif",
  "monkey-face-hide.gif",
  "mouth-shut.gif",
  "okay-sign.gif",
  "party-confetti.gif",
  "party.gif",
  "point-up.gif",
  "pointing-up.gif",
  "poop.gif",
  "question.gif",
  "relaxed.gif",
  "sad-broken.gif",
  "shushh.gif",
  "simp.gif",
  "skull.gif",
  "sleep-zzz.gif",
  "smiling-nice.gif",
  "snapchat.gif",
  "star-twinkl.gif",
  "star.gif",
  "swearing.gif",
  "tears-of-joy-laughter.gif",
  "tears-with-joy.gif",
  "tears-with-smile.gif",
  "thanks.gif",
  "thinking.gif",
  "thumbs-down.gif",
  "thumbs-up.gif",
  "wave.gif",
  "wine-glasses.gif",
  "wink.gif",
  "x.gif",
]);

/**
 * Normalizes an emoji string and returns the API URL for its Telegram animated GIF,
 * or null if no animated version exists.
 * Supports skin tones (👍🏻), variation selectors (⚡️), and gender modifiers (🤷‍♂️).
 */
export function getTelegramEmojiGifUrl(rawEmoji: string): string | null {
  if (!rawEmoji) return null;
  const trimmed = rawEmoji.trim();
  if (!trimmed) return null;

  // 1. Direct lookup
  let filename = TELEGRAM_EMOJI_GIF_MAP[trimmed];
  if (filename) {
    return BUNDLED_STATIC_GIFS.has(filename) ? `/gifs/${filename}` : `/api/emoji-gifs/${filename}`;
  }

  // 2. Strip skin tone modifiers (\u{1F3FB}-\u{1F3FF})
  const withoutSkin = trimmed.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "");
  filename = TELEGRAM_EMOJI_GIF_MAP[withoutSkin];
  if (filename) {
    return BUNDLED_STATIC_GIFS.has(filename) ? `/gifs/${filename}` : `/api/emoji-gifs/${filename}`;
  }

  // 3. Try with / without variation selectors (\uFE0E / \uFE0F)
  const withFe0f = withoutSkin.includes("\uFE0F") ? withoutSkin : withoutSkin + "\uFE0F";
  const withoutFe0f = withoutSkin.replace(/[\uFE0E\uFE0F]/g, "");
  filename = TELEGRAM_EMOJI_GIF_MAP[withFe0f] || TELEGRAM_EMOJI_GIF_MAP[withoutFe0f];
  if (filename) {
    return BUNDLED_STATIC_GIFS.has(filename) ? `/gifs/${filename}` : `/api/emoji-gifs/${filename}`;
  }

  // 4. Strip ZWJ gender sequences (\u200D\u2640 / \u200D\u2642)
  const withoutGender = withoutFe0f.replace(/\u200D[\u2640\u2642]\uFE0F?/gu, "");
  filename = TELEGRAM_EMOJI_GIF_MAP[withoutGender] || TELEGRAM_EMOJI_GIF_MAP[withoutGender + "\uFE0F"];
  if (filename) {
    return BUNDLED_STATIC_GIFS.has(filename) ? `/gifs/${filename}` : `/api/emoji-gifs/${filename}`;
  }

  return null;
}

export function getTelegramEmojiPreviewUrl(emoji: string): string | null {
  const url = getTelegramEmojiGifUrl(emoji);
  if (!url) return null;
  const filename = url.split("/").pop()!;
  const assets = emojiAnimationAssets as Record<string, { preview: string; durationMs: number }>;
  return (inlineEmojiAssets as Record<string, { preview: string }>)[filename]?.preview ?? assets[filename]?.preview ?? null;
}

const prefetchedGifs = new Set<string>();
const loadedGifUrls = new Set<string>();
const preloadQueue: string[] = [];
let activePreloads = 0;
let saveLoadedTimer: ReturnType<typeof setTimeout> | null = null;

// A previous session's list cannot tell whether an image is still decoded now.
export function isEmojiGifLoaded(url: string): boolean { return loadedGifUrls.has(url); }
export function markEmojiGifLoaded(url: string): void {
  loadedGifUrls.delete(url);
  loadedGifUrls.add(url);
  if (loadedGifUrls.size > 400) loadedGifUrls.delete(loadedGifUrls.values().next().value!);
  // Batch synchronous storage writes, instead of serializing hundreds of URLs per image.
  if (typeof window !== "undefined" && !saveLoadedTimer) {
    saveLoadedTimer = setTimeout(() => {
      saveLoadedTimer = null;
      try { sessionStorage.setItem("eclipse_loaded_emoji_gifs", JSON.stringify([...loadedGifUrls])); } catch {}
    }, 500);
  }
}
function drainPreloads() {
  while (activePreloads < 4 && preloadQueue.length && !document.hidden) {
    const url = preloadQueue.shift()!;
    activePreloads += 1;
    const img = new Image();
    let finished = false;
    const timer = setTimeout(() => finish(false), 10_000);
    function finish(success: boolean) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (success) markEmojiGifLoaded(url);
      else prefetchedGifs.delete(url);
      img.removeAttribute("src"); // Do not keep a hidden animated image running after preload.
      activePreloads -= 1;
      drainPreloads();
    }
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  }
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", drainPreloads);
export function prefetchEmojiGif(urlOrEmoji: string) {
  if (typeof window === "undefined") return;
  const url = urlOrEmoji.startsWith("/") || urlOrEmoji.startsWith("http")
    ? urlOrEmoji : getTelegramEmojiGifUrl(urlOrEmoji);
  if (!url || prefetchedGifs.has(url) || preloadQueue.length >= 100) return;
  prefetchedGifs.add(url);
  if (prefetchedGifs.size > 800) prefetchedGifs.delete(prefetchedGifs.values().next().value!);
  preloadQueue.push(url);
  drainPreloads();
}

/**
 * Preloads the most popular emojis in idle time so they render instantly
 */
export function prefetchPopularEmojiGifs() {
  if (typeof window === "undefined") return;
  const top = [
    "❤️", "🔥", "👍", "👎", "😂", "🤣", "🥺", "😭", "😍", "🥰",
    "🎉", "💩", "100", "💯", "🙏", "👏", "✨", "⚡", "😎", "😊",
    "🤔", "🥳", "🤩", "💔", "👀", "😴", "🤝", "🚀", "🙈", "💪",
    "💋", "😱", "✌️", "🤦", "☕", "❄️", "🍷", "📱", "💻",
    "🌹", "😘", "🤭", "😉", "😌", "🤯", "😡", "🤬", "😈", "👌"
  ];
  const runner = () => {
    for (const emoji of top) {
      const preview = getTelegramEmojiPreviewUrl(emoji);
      if (preview) prefetchEmojiGif(preview);
    }
  };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(runner, { timeout: 2500 });
  } else {
    setTimeout(runner, 800);
  }
}

if (typeof window !== "undefined") {
  prefetchPopularEmojiGifs();
}

export interface TelegramEmojiCategory {
  readonly id: string;
  readonly title: string;
  readonly emojis: readonly string[];
}

/**
 * Structured emoji categories organized logically like Telegram messenger:
 * 1. Smileys & Emotions
 * 2. Hands & Gestures
 * 3. People
 * 4. Hearts & Love
 * 5. Animals
 * 6. Nature & Weather
 * 7. Objects & Food
 * 8. Symbols
 */
export const TELEGRAM_EMOJI_CATEGORIES: readonly TelegramEmojiCategory[] = [
  {
    id: "smileys",
    title: "Смайлики и эмоции",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "😊",
      "☺️", "😇", "🥰", "😍", "😘", "😗", "😙", "😚", "😋", "😛",
      "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🙂", "🙃", "😉",
      "😌", "🤔", "🤐", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
      "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧",
      "🥵", "🥶", "🥴", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "👀",
      "🥸", "🤦", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳",
      "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖",
      "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬",
      "😈", "👿", "🤡", "💩", "👻", "💀", "☠️", "🤩",
    ],
  },
  {
    id: "gestures",
    title: "Руки и жесты",
    emojis: [
      "👍", "👎", "👏", "🙌", "👐", "🤲", "🙏", "🤝", "👊", "✊",
      "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "🤙", "👌", "🤌", "🤏",
      "👈", "👉", "☝️", "👆", "👇", "✋", "🤚", "🖐️", "👋", "✍️",
      "💪", "🦾", "🖖",
    ],
  },
  {
    id: "people",
    title: "Люди",
    emojis: [
      "👼", "👵", "💃", "🕺", "👮‍♀️", "👩‍⚕️", "👨‍⚕️", "👩‍💻", "👨‍💻", "🧑‍💻",
      "🧑‍🏫", "🤷‍♀️", "🤷‍♂️", "🧛", "🧛‍♀️", "🧛‍♂️", "🧟‍♀️", "🧟‍♂️",
    ],
  },
  {
    id: "hearts",
    title: "Сердца и любовь",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟",
      "💋", "💌",
    ],
  },
  {
    id: "animals",
    title: "Животные",
    emojis: [
      "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🙈", "🙉",
      "🦇", "🐥", "🐣", "🦉", "🕷️", "🕸️", "🦠",
    ],
  },
  {
    id: "nature",
    title: "Природа и погода",
    emojis: [
      "☀️", "🌞", "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘",
      "🌑", "🌒", "🌓", "🌔", "🌱", "🌿", "🌲", "🌳", "🌴", "🌵",
      "🌷", "🌹", "🌺", "🎄", "🏖️", "⛄", "☃️", "❄️",
    ],
  },
  {
    id: "objects",
    title: "Предметы и еда",
    emojis: [
      "🍑", "🍆", "🎂", "🥂", "🍷", "☕", "🎉", "🎊", "🎈", "🎃",
      "👑", "💎", "💸", "💱", "🚀", "📱", "💻", "🎮", "🕹️", "⌨️",
      "💡", "📝", "📁", "📂", "🗂️", "🧮", "🧭", "⏳", "⌛", "🔐",
      "🔍", "🔎", "📬", "🏠", "🚑", "🚓", "🚕", "⚰️", "💊", "💉",
      "👛", "🧽", "🧻", "📢", "🗿",
    ],
  },
  {
    id: "symbols",
    title: "Символы",
    emojis: [
      "🔥", "💥", "⭐", "✨", "⚡️", "💯", "💢", "♨️", "💤", "🫧",
      "💧", "❗", "‼️", "❕", "❓", "❔", "❌", "🚩", "💬", "💭",
    ],
  },
] as const;

/**
 * Filtered flat list of emojis supported by telegram-emoji-gifs in canonical order.
 * Unsupported emoji stay static rather than borrowing an unrelated animation.
 */
export const TELEGRAM_COMPOSER_EMOJIS: readonly string[] = TELEGRAM_EMOJI_CATEGORIES.flatMap(
  (category) => category.emojis
);
