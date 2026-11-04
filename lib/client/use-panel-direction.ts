"use client";

import { useState } from "react";

/** Resolve direction before committing the new screen, rather than correcting it in an effect. */
export function usePanelDirection(depth: number, screen?: string | null) {
  const [navigation, setNavigation] = useState<{ depth: number; screen?: string | null; direction: "forward" | "backward" }>({ depth, screen, direction: "forward" });
  if (navigation.depth !== depth || navigation.screen !== screen) {
    const next = { depth, screen, direction: depth < navigation.depth ? "backward" as const : "forward" as const };
    setNavigation(next);
    return next.direction;
  }
  return navigation.direction;
}
