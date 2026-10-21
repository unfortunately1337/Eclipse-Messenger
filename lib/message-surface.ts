import type { CSSProperties } from "react";

/** Outgoing themes use vertical gradients; the tail meets their bottom stop. */
export function getMessageTailColor(surface?: CSSProperties): string {
  if (!surface) return "#ffffff";
  if (surface.backgroundColor) return String(surface.backgroundColor);
  const background = String(surface.backgroundImage || surface.background || "");
  if (background.includes("gradient(")) {
    const colors = background.match(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi);
    if (colors?.length) return colors[colors.length - 1]!;
  }
  return String((surface as CSSProperties & { "--tail-color"?: string })["--tail-color"] || surface.background || "currentColor");
}
