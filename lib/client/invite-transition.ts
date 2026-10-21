"use client";

import { useLayoutEffect, useRef } from "react";

const STORAGE_KEY = "eclipse:invite:transition:v1";
export const INVITE_TRANSITION = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

export function prepareInviteArrival(link: string, type: "group" | "channel") {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ link, type, createdAt: Date.now() })); }
  catch { /* Navigation still works when storage is unavailable. */ }
}

export function useInviteArrival(ready: boolean, link: string, type: string) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ready || !root.current) return;
    let matches = false;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const entry = JSON.parse(raw);
      const age = Date.now() - entry.createdAt;
      const destination = new URLSearchParams(window.location.search);
      const valid = Number.isFinite(age) && age >= 0 && age < 30_000 && destination.get("chat") === entry.link && destination.get("chatType") === entry.type;
      // Wait for this conversation's data, rather than animating a cached chat.
      if (valid && (entry.link !== link || entry.type !== type)) return;
      matches = valid;
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { return; }
    if (!matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current.animate) return;
    const animation = root.current.animate([
      { opacity: 0, transform: "translateY(10px) scale(0.985)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ], { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    return () => animation.cancel();
  }, [ready, link, type]);
  return root;
}
