"use client";
import React from "react";
import { splitCustomEmoji } from "@/lib/custom-emoji";
import { useEmojiEntry } from "@/lib/client/pack-items";
function renderStaticUnicode(
  text: string,
  options?: { size?: number; className?: string }
): React.ReactNode[] {
  if (!text) return [];
  const size = options?.size;
  const customClass = options?.className;
  const style = size ? { width: size, height: size } : undefined;

  try {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      const segments = Array.from(segmenter.segment(text));

      const elements: React.ReactNode[] = [];
      let currentText = "";

      const isEmojiRegex = /[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Extended_Pictographic}]/u;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i].segment;

        const isBasicAscii = /^[a-zA-Z0-9\s.,!?;:"'()\-+=_@#$*%^&|<>{}[\]~`\\/]+$/.test(seg);
        const isEmoji = !isBasicAscii || seg.includes("\uFE0F") || seg.includes("\u20E3");

        if (isEmoji && isEmojiRegex.test(seg)) {
          if (currentText) {
            elements.push(<span key={`txt-${i}`}>{currentText}</span>);
            currentText = "";
          }
          elements.push(
            <span
              key={`emo-${i}`}
              role="img"
              aria-label={seg}
              className={
                customClass ||
                (size
                  ? "inline-block object-contain pointer-events-none select-none"
                  : "inline-block h-[1.15em] w-[1.15em] align-[-0.15em] mx-[0.05em] select-all object-contain pointer-events-none")
              }
              style={{...style, fontSize:size, lineHeight:1.15}}
            >{seg}</span>
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
  } catch (e) {
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
