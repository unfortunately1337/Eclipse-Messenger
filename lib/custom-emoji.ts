import { getEmojiStatus } from "./emoji-status";

// A stable ID is serialized inside message text; never trust URLs from messages.
export const customEmojiToken = (id: string) => getEmojiStatus(id) ? `\uE000${id}\uE001` : "";
const tokenPattern = /\uE000(tg-[a-f0-9]{24})\uE001/g;
let textSegmenter: Intl.Segmenter | undefined;
export type EmojiTextPart = { text: string; id?: string };
export function splitCustomEmoji(text: string): EmojiTextPart[] {
  const parts: EmojiTextPart[] = [];
  let start = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (match.index! > start) parts.push({ text: text.slice(start, match.index) });
    // Unknown IDs can belong to a shared pack; the renderer resolves them lazily.
    parts.push({ text: match[0], id: match[1] });
    start = match.index! + match[0].length;
  }
  if (start < text.length) parts.push({ text: text.slice(start) });
  return parts;
}
export function emojiPlainText(text: string) {
  return splitCustomEmoji(text).map(part => part.id ? getEmojiStatus(part.id)?.emoji ?? "❔" : part.text).join("");
}

/** Truncate visible characters without cutting a serialized emoji or grapheme in half. */
export function truncateEmojiText(text: string, limit: number): string {
  textSegmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" });
  let result = "", count = 0;
  for (const part of splitCustomEmoji(text)) {
    if (part.id) {
      if (count >= limit) return `${result}...`;
      result += part.text; count++;
      continue;
    }
    for (const { segment: character } of textSegmenter.segment(part.text)) {
      if (count >= limit) return `${result}...`;
      result += character;
      count++;
    }
  }
  return result;
}
