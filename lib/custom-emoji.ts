import { getEmojiStatus } from "./emoji-status";

// A stable ID is serialized inside message text; never trust URLs from messages.
export const customEmojiToken = (id: string) => getEmojiStatus(id) ? `\uE000${id}\uE001` : "";
const tokenPattern = /\uE000(tg-[a-f0-9]{24})\uE001/g;
export type EmojiTextPart = { text: string; id?: string };
export function splitCustomEmoji(text: string): EmojiTextPart[] {
  const parts: EmojiTextPart[] = [];
  let start = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (!getEmojiStatus(match[1])) continue;
    if (match.index! > start) parts.push({ text: text.slice(start, match.index) });
    parts.push({ text: match[0], id: match[1] });
    start = match.index! + match[0].length;
  }
  if (start < text.length) parts.push({ text: text.slice(start) });
  return parts;
}
export function emojiPlainText(text: string) {
  return splitCustomEmoji(text).map(part => part.id ? getEmojiStatus(part.id)?.emoji ?? "" : part.text).join("");
}

/** Truncate visible characters without cutting a serialized emoji or grapheme in half. */
export function truncateEmojiText(text: string, limit: number): string {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  let result = "", count = 0;
  for (const part of splitCustomEmoji(text)) {
    const characters = part.id ? [part.text] : Array.from(segmenter.segment(part.text), item => item.segment);
    for (const character of characters) {
      if (count >= limit) return `${result}...`;
      result += character;
      count++;
    }
  }
  return result;
}
