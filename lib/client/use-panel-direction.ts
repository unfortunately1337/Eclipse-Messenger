"use client";

import { useState } from "react";

/** Resolve direction before committing the new screen, rather than correcting it in an effect. */
export function usePanelDirection(depth: number) {
  const [navigation, setNavigation] = useState<{ depth: number; direction: "forward" | "backward" }>({ depth, direction: "forward" });
  if (navigation.depth !== depth) {
    const next = { depth, direction: depth > navigation.depth ? "forward" as const : "backward" as const };
    setNavigation(next);
    return next.direction;
  }
  return navigation.direction;
}
