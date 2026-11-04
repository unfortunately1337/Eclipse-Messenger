import type { Variants } from "framer-motion";
import { deferAnimationMounts } from "./animation-mount-queue";

export const PANEL_EASE = [0.25, 1, 0.5, 1] as const;
export const PANEL_TRANSITION = { duration: 0.18, ease: PANEL_EASE };
export const PANEL_EXIT_TRANSITION = { duration: 0.12, ease: PANEL_EASE };
// Navigation needs more than a few frames, without the overshoot of a spring.
export const NAVIGATION_TRANSITION = { duration: 0.22, ease: [0.2, 0.72, 0.25, 1] as const };
export const NAVIGATION_EXIT_TRANSITION = { ...NAVIGATION_TRANSITION, duration: 0.18 };
export const deferNavigationMedia = () => deferAnimationMounts(NAVIGATION_TRANSITION.duration * 1000 + 32);
export function menuPopoverMotion(reduced: boolean | null) {
  return {
    initial: { opacity: 0, y: reduced ? 0 : -5, scale: reduced ? 1 : 0.96 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { ...PANEL_TRANSITION, duration: reduced ? 0 : PANEL_TRANSITION.duration } },
    exit: { opacity: 0, y: reduced ? 0 : -4, scale: reduced ? 1 : 0.98, transition: { ...PANEL_EXIT_TRANSITION, duration: reduced ? 0 : PANEL_EXIT_TRANSITION.duration } },
  };
}
export const PANEL_SUBVIEW_VARIANTS: Variants = {
  initial: (direction = "forward") => ({ x: direction === "backward" ? "-24%" : "100%", opacity: 1 }),
  animate: { x: 0, opacity: 1, transition: NAVIGATION_TRANSITION },
  exit: (direction = "forward") => ({ x: direction === "backward" ? "100%" : "-24%", opacity: 1, transition: NAVIGATION_EXIT_TRANSITION }),
};

export function panelOverlayMotion(reduced: boolean | null, side: "right" | "left" | "bottom" = "right") {
  const offset = side === "left" ? -1 : 1;
  const position = (distance: number | string) => side === "bottom" ? { y: distance } : { x: distance };
  return {
    initial: { ...position(reduced ? 0 : offset < 0 ? "-100%" : "100%"), opacity: 1 },
    onAnimationStart: reduced ? undefined : deferNavigationMedia,
    animate: { ...position(0), opacity: 1, transition: { ...NAVIGATION_TRANSITION, duration: reduced ? 0 : NAVIGATION_TRANSITION.duration } },
    exit: { ...position(reduced ? 0 : offset < 0 ? "-100%" : "100%"), opacity: 1, transition: { ...NAVIGATION_EXIT_TRANSITION, duration: reduced ? 0 : NAVIGATION_EXIT_TRANSITION.duration } },
  };
}
