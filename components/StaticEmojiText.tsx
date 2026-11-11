"use client";
import React from "react";
import emojiMap from "@/public/emoji-map.json";
import { splitCustomEmoji } from "@/lib/custom-emoji";
import { useEmojiEntry } from "@/lib/client/pack-items";
const emojiPattern = /[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Extended_Pictographic}]|\u20E3/u;
let segmenter: Intl.Segmenter | undefined;
function renderStaticUnicode(
  text: string,
  options?: { size?: number; className?: string }
): React.ReactNode[] {
  if (!text) return [];
  if (!emojiPattern.test(text)) return [text];
  const size = options?.size;
  const customClass = options?.className;
  const style = size ? { width: size, height: size } : undefined;

  try {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      segmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" });

      const elements: React.ReactNode[] = [];
      let currentText = "";

      let i = 0;
      for (const { segment: seg } of segmenter.segment(text)) {
        i++;
        if (emojiPattern.test(seg)) {
          if (currentText) {
            elements.push(<span key={`txt-${i}`}>{currentText}</span>);
            currentText = "";
          }
          const typedMap = emojiMap as Record<string, string>;
          const filename = typedMap[seg] || typedMap[seg + "\uFE0F"] || typedMap[seg.replace(/\uFE0F/g, "")];
          const src = filename
            ? `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${filename}`
            : `https://emojicdn.elk.sh/${encodeURIComponent(seg)}?style=apple`;

          elements.push(
            <img
              key={`emo-${i}`}
              src={src}
              alt={seg}
              className={
                customClass ||
                (size
                  ? "inline-block object-contain pointer-events-none select-none"
                  : "inline-block h-[1.15em] w-[1.15em] align-[-0.15em] mx-[0.05em] select-all object-contain pointer-events-none")
              }
              style={style}
              loading="lazy"
            />
          );
        } else {
          currentText += seg;
        }
      }

      if (currentText) {
        elements.push(<span key="txt-end">{currentText}</span>);
      }

      return elements;
    }
  } catch {
    // fallback
  }

  return [text];
}

export function renderStaticEmojiText(text: string, options?: {size?:number;className?:string}): React.ReactNode[] {
  return splitCustomEmoji(text).flatMap<React.ReactNode>((part,index) => {
    if (!part.id) return renderStaticUnicode(part.text, options);
    return [<StaticCustomEmoji key={index} id={part.id} {...options} />];
  });
}
function StaticCustomEmoji({ id, size, className }: { id: string; size?: number; className?: string }) {
  const entry = useEmojiEntry(id);
  if (!entry) return <span>❔</span>;
  return <img src={entry.thumbnail} alt={entry.emoji} draggable={false} className={className || "inline-block align-[-0.15em] object-contain"} style={{ width: size ?? "1.15em", height: size ?? "1.15em", filter: entry.adaptive ? "var(--inline-emoji-filter, brightness(0) invert(1))" : undefined }} />;
}
