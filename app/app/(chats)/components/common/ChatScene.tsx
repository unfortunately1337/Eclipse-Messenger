"use client";

import { memo, useLayoutEffect, useState, type ReactNode } from "react";
import { motion, useAnimate, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { NAVIGATION_TRANSITION, NAVIGATION_EXIT_TRANSITION, deferNavigationMedia } from "@/lib/client/panel-motion";
import { RetainedContent } from "./RetainedContent";

function ConversationContent({ children, desktop, sceneKey, reduced }: { children: ReactNode; desktop: boolean; sceneKey?: string | null; reduced: boolean | null }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  useLayoutEffect(() => {
    if (!scope.current) return;
    const animation = animate(scope.current, { opacity: desktop && !reduced ? [0.78, 1] : 1 },
      { duration: desktop && !reduced ? 0.18 : 0, ease: NAVIGATION_TRANSITION.ease });
    return () => animation.stop();
  }, [desktop, sceneKey, reduced, animate, scope]);
  return <div ref={scope} className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
}

type Props = Omit<HTMLMotionProps<"section">, "children"> & { children: ReactNode; open: boolean; desktop: boolean; expiring?: boolean; sceneKey?: string | null };

export const ChatScene = memo(function ChatScene({ open, desktop, sceneKey, expiring = false, children, className = "", ...props }: Props) {
  const reduced = useReducedMotion();
  const [retained, setRetained] = useState(open);
  if (open && !retained) setRetained(true);
  if ((desktop || reduced) && !open && retained) setRetained(false);
  const [lastOpenHeight, setLastOpenHeight] = useState(props.style?.height);
  if (open && lastOpenHeight !== props.style?.height) setLastOpenHeight(props.style?.height);
  const exiting = !desktop && !reduced && !open && retained;
  const visible = desktop || open || exiting;
  return <motion.section {...props} data-chat-scene data-chat-open={open || undefined}
    layout={desktop ? "size" : false}
    initial={false}
    animate={expiring ? { opacity: 0, scale: 0.95, x: 0 }
      : { x: desktop || open || reduced ? 0 : "100%", opacity: desktop || open || exiting ? 1 : 0, scale: 1 }}
    transition={{ ...NAVIGATION_TRANSITION, duration: reduced ? 0 : open || desktop ? NAVIGATION_TRANSITION.duration : NAVIGATION_EXIT_TRANSITION.duration,
      layout: { ...NAVIGATION_TRANSITION, duration: reduced ? 0 : NAVIGATION_TRANSITION.duration } }}
    onAnimationComplete={() => { if (!open) setRetained(false); }}
    onAnimationStart={reduced ? undefined : deferNavigationMedia}
    onLayoutAnimationStart={reduced ? undefined : deferNavigationMedia}
    inert={!desktop && !open}
    aria-hidden={!desktop && !open}
    className={`${visible ? "flex" : "hidden"} ${desktop ? "relative" : "absolute inset-0 z-20"} min-h-0 min-w-0 flex-col overflow-hidden bg-transparent ${className}`}
    style={{ ...props.style,
      ...(exiting && !desktop && lastOpenHeight !== undefined ? { height: lastOpenHeight, maxHeight: lastOpenHeight } : {}),
      transformOrigin: "0% 50%" }}>
    <RetainedContent frozen={exiting}>
      <motion.div layout="position" data-chat-scene-content className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <ConversationContent desktop={desktop} sceneKey={sceneKey} reduced={reduced}>{children}</ConversationContent>
      </motion.div>
    </RetainedContent>
  </motion.section>;
});
