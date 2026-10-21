"use client";

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, useIsPresent, useReducedMotion } from "framer-motion";

function NavigationScreen({ element }: { element: ReactElement<{ inert?: boolean; "aria-hidden"?: boolean }> }) {
  const present = useIsPresent();
  return cloneElement(element, { inert: !present, "aria-hidden": !present });
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
          ? <NavigationScreen key={child.key ?? index} element={child as ReactElement<{ inert?: boolean; "aria-hidden"?: boolean }>} />
          : child)}
      </AnimatePresence>}
    </MotionConfig>
  </div>;
}
