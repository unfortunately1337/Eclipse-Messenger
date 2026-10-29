"use client";
import React from "react";
import { splitCustomEmoji } from "@/lib/custom-emoji";
import { InlineEmoji } from "./InlineEmoji";

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]|\u20E3/u;
export function renderEmojiText(text: string, options?: {size?:number;className?:string}): React.ReactNode[] {
  // Most messages contain no emoji. Avoid walking every grapheme in ordinary text.
  if (!text.includes("\uE000") && !emojiPattern.test(text)) return [text];
  const result: React.ReactNode[]=[];
  for(const part of splitCustomEmoji(text)) {
    if(part.id) {result.push(<InlineEmoji key={result.length} id={part.id} {...options}/>);continue;}
    if (!emojiPattern.test(part.text)) {result.push(part.text);continue;}
    let plain="";
    const flush=()=>{if(plain){result.push(<React.Fragment key={result.length}>{plain}</React.Fragment>);plain="";}};
    for(const {segment} of segmenter.segment(part.text)) {
      if(emojiPattern.test(segment)){flush();result.push(<InlineEmoji key={result.length} emoji={segment} {...options}/>);}else plain+=segment;
    }
    flush();
  }
  return result;
}
