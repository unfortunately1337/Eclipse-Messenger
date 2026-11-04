"use client";

import { Children, Fragment, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, useIsPresent, usePresenceData, useReducedMotion } from "framer-motion";
import { deferNavigationMedia } from "@/lib/client/panel-motion";

function NavigationScreen({ element, direction }: { element: ReactElement<{ children?: ReactNode; inert?: boolean; "aria-hidden"?: boolean; style?: CSSProperties; onAnimationStart?: (definition: unknown) => void }>; direction: "forward" | "backward" }) {
  const present = useIsPresent();
  const navigationDirection = usePresenceData() ?? direction;
  return cloneElement(element, { inert: !present, "aria-hidden": !present,
    onAnimationStart: definition => { deferNavigationMedia(); element.props.onAnimationStart?.(definition); },
    style: { ...element.props.style, position: "relative", zIndex: navigationDirection === "backward" ? present ? 0 : 1 : present ? 1 : 0 } },
    // Only the screen moves during navigation. Nested avatar/menu animations
    // must not inherit its exit and stretch removal beyond the screen's timing.
    <AnimatePresence initial={false}>
      <Fragment key="screen-content">{element.props.children}</Fragment>
    </AnimatePresence>);
}

/** Both screens share one grid cell and move together, without a second glass surface. */
export function PanelNavigation({ children, direction = "forward", className = "" }: {
  children: ReactNode;
  direction?: "forward" | "backward";
  className?: string;
}) {
  const reduced = useReducedMotion();
  return <div data-panel-navigation className={`relative grid min-w-0 grid-cols-1 ${className}`}>
    <MotionConfig reducedMotion="user">
      {reduced ? children : <AnimatePresence mode="sync" custom={direction} initial={false}>
        {Children.map(children, (child, index) => isValidElement(child)
          ? <NavigationScreen key={child.key ?? index} direction={direction} element={child as ReactElement<{ inert?: boolean; "aria-hidden"?: boolean }>} />
          : child)}
      </AnimatePresence>}
    </MotionConfig>
  </div>;
}
