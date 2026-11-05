import React, { memo, useEffect, useState } from "react";
import type { StoryOverlayTextLayer } from "@/lib/story-overlay";
import { storyEmojiGraphemes } from "@/lib/story-editor";
import { splitCustomEmoji } from "@/lib/custom-emoji";
import { InlineEmoji } from "@/components/InlineEmoji";
import { PackMedia } from "@/components/PackMedia";
import { resolvePackItem, type ResolvedPackItem } from "@/lib/client/pack-items";
import { StoryEmojiGlyph } from "./StoryEmojiGlyph";

function StorySticker({ id, size }: { id: string; size: number }) {
  const [item, setItem] = useState<ResolvedPackItem | null>(null);
  useEffect(() => {
    let active = true;
    void resolvePackItem(id).then(result => { if (active) setItem(result); });
    return () => { active = false; };
  }, [id]);
  return <span className="pointer-events-none grid max-w-full place-items-center overflow-hidden leading-none" style={{ width: size, aspectRatio: "1 / 1" }}>
    {item?.id === id && <PackMedia item={item} vector />}
  </span>;
}

export const StoryLayerContent = memo(function StoryLayerContent({ layer }: { layer: StoryOverlayTextLayer }) {
  if (layer.kind === "sticker") return <StorySticker id={layer.text} size={layer.size} />;
  if (layer.kind !== "emoji") return <>{layer.text}</>;
  return <span className="pointer-events-none inline-flex max-w-full flex-wrap items-center justify-center gap-1 align-middle">
    {splitCustomEmoji(layer.text).flatMap((part, index) => part.id
      ? [<InlineEmoji key={index} id={part.id} size={layer.size} vector />]
      : storyEmojiGraphemes(part.text).map((emoji, offset) => <StoryEmojiGlyph key={`${index}:${offset}`} emoji={emoji} size={layer.size} animated />))}
  </span>;
});
