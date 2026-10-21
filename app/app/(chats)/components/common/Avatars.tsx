import React, { CSSProperties } from "react";
import { Bookmark } from "lucide-react";
import { GiNestedEclipses } from "react-icons/gi";
import { cn } from "@/lib/utils";

const SAVED_MESSAGES_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#ff845e", "#d45246"],
  ["#8e85ee", "#5f62d6"],
  ["#5fb2ff", "#3b82f6"],
  ["#67d67c", "#34c759"],
  ["#f7c04a", "#f59e0b"],
  ["#ef6fa8", "#db2777"],
  ["#57c7d4", "#0891b2"],
];

function pickSavedMessagesPalette(displayName?: string | null, link?: string | null) {
  const seedSource = `${(displayName ?? "").trim().toLowerCase()}::${(link ?? "").trim().toLowerCase()}`;
  let hash = 0;
  for (let index = 0; index < seedSource.length; index += 1) {
    hash = (hash * 31 + seedSource.charCodeAt(index)) >>> 0;
  }
  return SAVED_MESSAGES_PALETTE[hash % SAVED_MESSAGES_PALETTE.length] ?? SAVED_MESSAGES_PALETTE[1];
}

export function SavedMessagesAvatar({
  className = "w-10 h-10",
  seedDisplayName,
  seedLink,
}: {
  className?: string;
  seedDisplayName?: string | null;
  seedLink?: string | null;
}) {
  const [startColor, endColor] = pickSavedMessagesPalette(seedDisplayName, seedLink);
  const gradientStyle = {
    backgroundImage: `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`,
  } satisfies CSSProperties;

  return (
    <div
      className={cn(
        "grid place-items-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
        className,
      )}
      style={gradientStyle}
    >
      <Bookmark className="w-[52%] h-[52%] fill-current" strokeWidth={2.1} />
    </div>
  );
}

export function EclipseBotAvatar({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full bg-black text-white overflow-hidden shrink-0",
        className,
      )}
    >
      <GiNestedEclipses className="w-[70%] h-[70%] text-white" aria-hidden />
    </div>
  );
}

export { EclipseBotAvatar as EcliBotAvatar };
