"use client";
import { Fragment } from "react";
import { renderEmojiText } from "@/components/EmojiText";
import { emojiPlainText, splitCustomEmoji } from "@/lib/custom-emoji";
import { messageSearchNeedle, messageSearchRanges } from "@/lib/client/message-search";

export function SearchHighlightedText({ text, query, emojis = false }: { text: string; query: string; emojis?: boolean }) {
  const render = (value: string) => emojis ? renderEmojiText(value) : value;
  const mark = "rounded-[4px] bg-yellow-300/90 text-zinc-950 box-decoration-clone";
  if (!messageSearchNeedle(query)) return <>{render(text)}</>;
  return <>{splitCustomEmoji(text).map((part, index) => {
    if (part.id) return <Fragment key={index}>{messageSearchRanges(emojiPlainText(part.text), query).length ? <mark className={mark}>{render(part.text)}</mark> : render(part.text)}</Fragment>;
    const ranges = messageSearchRanges(part.text, query);
    let offset = 0;
    return <Fragment key={index}>{ranges.map((range, match) => {
      const before = part.text.slice(offset, range.start); offset = range.end;
      return <Fragment key={match}>{render(before)}<mark className={mark}>{render(part.text.slice(range.start, range.end))}</mark></Fragment>;
    })}{render(part.text.slice(offset))}</Fragment>;
  })}</>;
}
