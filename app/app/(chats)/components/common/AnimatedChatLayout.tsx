"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

function subscribe(notify: () => void) {
  const desktop = window.matchMedia("(min-width: 768px)");
  const wide = window.matchMedia("(min-width: 1024px)");
  desktop.addEventListener("change", notify);
  wide.addEventListener("change", notify);
  return () => { desktop.removeEventListener("change", notify); wide.removeEventListener("change", notify); };
}
const screenSize = () => window.matchMedia("(min-width: 1024px)").matches ? 2 : window.matchMedia("(min-width: 768px)").matches ? 1 : 0;
const serverSize = () => -1;

/** Resolve the final columns once. Child panels animate their visual bounds
 * with Motion projection, rather than reflowing every message on every frame. */
export function AnimatedChatLayout({ detailsOpen, children }: { detailsOpen: boolean; children: ReactNode }) {
  const size = useSyncExternalStore(subscribe, screenSize, serverSize);
  // Keep the third grid column alive just long enough for the details panel's
  // own exit transition. Without this, CSS grid collapses it before Motion can
  // slide the panel back to the right.
  const [holdDetailsColumn, setHoldDetailsColumn] = useState(detailsOpen);
  useEffect(() => {
    if (detailsOpen) { setHoldDetailsColumn(true); return; }
    const timer = window.setTimeout(() => setHoldDetailsColumn(false), 210);
    return () => window.clearTimeout(timer);
  }, [detailsOpen]);
  const columns = size < 1 ? "minmax(0, 1fr)" : `${size === 2 ? 370 : 350}px minmax(0, 1fr) ${(detailsOpen || holdDetailsColumn) ? size === 2 ? 360 : 340 : 0}px`;
  return <div data-chat-layout className="relative grid h-full min-h-0 md:grid-cols-[350px_minmax(0,1fr)_0px] lg:grid-cols-[370px_minmax(0,1fr)_0px]"
    style={size < 0 ? undefined : { gridTemplateColumns: columns }}>
    {children}
  </div>;
}
