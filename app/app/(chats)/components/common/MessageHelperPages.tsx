"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function MessageHelperPages({ showingReaders, readers, actions }: { showingReaders: boolean; readers: ReactNode; actions: ReactNode }) {
  const reduced = useReducedMotion();
  const direction = showingReaders ? 1 : -1;
  const page = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!page.current) return;
    const element = page.current;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [showingReaders]);
  return <motion.div animate={{ height: height ?? "auto" }} className="relative min-h-0 w-full overflow-hidden" transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}>
    <AnimatePresence initial={false} mode="popLayout" custom={direction}>
      <motion.div ref={page} key={showingReaders ? "readers" : "actions"} custom={direction}
        variants={{ enter: (value: number) => ({ x: reduced ? 0 : value * 32, opacity: 0 }), visible: { x: 0, opacity: 1 }, leave: (value: number) => ({ x: reduced ? 0 : value * -32, opacity: 0, pointerEvents: "none" as const }) }}
        initial="enter" animate="visible" exit="leave" transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full min-w-0 flex-col gap-0.5 [&>button]:shrink-0">
        {showingReaders ? readers : actions}
      </motion.div>
    </AnimatePresence>
  </motion.div>;
}
