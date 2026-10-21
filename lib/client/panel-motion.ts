import type { Variants } from "framer-motion";

export const PANEL_EASE = [0.25, 1, 0.5, 1] as const;
export const PANEL_TRANSITION = { duration: 0.18, ease: PANEL_EASE };
export const PANEL_EXIT_TRANSITION = { duration: 0.12, ease: PANEL_EASE };
export const PANEL_SUBVIEW_VARIANTS: Variants = {
  initial: (direction = "forward") => ({ x: direction === "backward" ? "-100%" : "100%", opacity: 1 }),
  animate: { x: 0, opacity: 1, transition: PANEL_TRANSITION },
  exit: (direction = "forward") => ({ x: direction === "backward" ? "100%" : "-100%", opacity: 1, transition: PANEL_TRANSITION }),
};

export function panelOverlayMotion(reduced: boolean | null, side: "right" | "left" | "bottom" = "right") {
  const offset = side === "left" ? -1 : 1;
  const position = (distance: number | string) => side === "bottom" ? { y: distance } : { x: distance };
  return {
    initial: { ...position(reduced ? 0 : offset < 0 ? "-100%" : "100%"), opacity: 1 },
    animate: { ...position(0), opacity: 1, transition: { ...PANEL_TRANSITION, duration: reduced ? 0 : PANEL_TRANSITION.duration } },
    exit: { ...position(reduced ? 0 : offset < 0 ? "-100%" : "100%"), opacity: 1, transition: { ...PANEL_EXIT_TRANSITION, duration: reduced ? 0 : PANEL_EXIT_TRANSITION.duration } },
  };
}
