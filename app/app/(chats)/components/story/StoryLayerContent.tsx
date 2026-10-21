import React, { memo } from "react";
import type { StoryOverlayTextLayer } from "@/lib/story-overlay";
import { singleStoryEmoji, storyEmojiGraphemes } from "@/lib/story-editor";
import { StoryEmojiGlyph } from "./StoryEmojiGlyph";

export const StoryLayerContent = memo(function StoryLayerContent({ layer }: { layer: StoryOverlayTextLayer }) {
  if (layer.kind !== "emoji") return <>{layer.text}</>;
  const single = singleStoryEmoji(layer.text);
  return <span className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 align-middle">
    {storyEmojiGraphemes(layer.text).map((emoji, index) => <StoryEmojiGlyph key={`${index}:${emoji}`} emoji={emoji} size={layer.size} animated={Boolean(single)} />)}
  </span>;
});
