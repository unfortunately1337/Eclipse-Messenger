"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PANEL_TRANSITION } from "@/lib/client/panel-motion";

function subscribe(notify: () => void) {
  const desktop = window.matchMedia("(min-width: 768px)");
  const wide = window.matchMedia("(min-width: 1024px)");
  desktop.addEventListener("change", notify);
  wide.addEventListener("change", notify);
  return () => { desktop.removeEventListener("change", notify); wide.removeEventListener("change", notify); };
}
const screenSize = () => window.matchMedia("(min-width: 1024px)").matches ? 2 : window.matchMedia("(min-width: 768px)").matches ? 1 : 0;
const serverSize = () => -1;

/** Motion owns the width transition; animation frames do not update React state. */
export function AnimatedChatLayout({ detailsOpen, children }: { detailsOpen: boolean; children: ReactNode }) {
  const size = useSyncExternalStore(subscribe, screenSize, serverSize);
  const reduced = useReducedMotion();
  const columns = size < 1 ? "minmax(0, 1fr)" : `${size === 2 ? 370 : 350}px minmax(0, 1fr) ${detailsOpen ? size === 2 ? 360 : 340 : 0}px`;
  return <motion.div data-chat-layout className="relative grid h-full min-h-0 md:grid-cols-[350px_minmax(0,1fr)_0px] lg:grid-cols-[370px_minmax(0,1fr)_0px]" initial={false}
    animate={size < 0 ? undefined : { gridTemplateColumns: columns }} transition={{ ...PANEL_TRANSITION, duration: reduced ? 0 : 0.24 }}>
    {children}
  </motion.div>;
}
