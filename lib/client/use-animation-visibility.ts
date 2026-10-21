"use client";

import { useEffect, useState, type RefObject } from "react";

type WatchedElement = { intersects: boolean; visible: boolean; notify: (visible: boolean) => void };
const watched = new Map<Element, WatchedElement>();
let observer: IntersectionObserver | null = null;
let scrolling = false;
let scrollEnd: ReturnType<typeof setTimeout> | undefined;
function onScroll() {
  if (!scrolling) { scrolling = true; notifyVisibility(); }
  clearTimeout(scrollEnd);
  scrollEnd = setTimeout(() => { scrolling = false; notifyVisibility(); }, 140);
}
function notifyVisibility() {
  for (const entry of watched.values()) updateEntry(entry, entry.intersects && !document.hidden && !scrolling);
}
function updateEntry(entry: WatchedElement, visible: boolean) {
  if (entry.visible === visible) return;
  entry.visible = visible;
  entry.notify(visible);
}

/** One observer and one page-visibility listener for all animated media. */
export function watchAnimationVisibility(element: Element, notify: (visible: boolean) => void) {
    if (watched.size === 0) {
      document.addEventListener("visibilitychange", notifyVisibility);
      document.addEventListener("scroll", onScroll, {capture:true, passive:true});
    }
    const entry = { intersects: typeof IntersectionObserver === "undefined", visible: false, notify };
    watched.set(element, entry);
    if (typeof IntersectionObserver !== "undefined") {
      observer ??= new IntersectionObserver(entries => {
        for (const change of entries) {
          const current = watched.get(change.target);
          if (!current) continue;
          current.intersects = change.isIntersecting;
          updateEntry(current, change.isIntersecting && !document.hidden && !scrolling);
        }
      }, { rootMargin: "60px" });
      observer.observe(element);
    } else {
      updateEntry(entry, !document.hidden);
    }
    return () => {
      observer?.unobserve(element);
      watched.delete(element);
      if (!watched.size) {
        document.removeEventListener("visibilitychange", notifyVisibility);
        document.removeEventListener("scroll", onScroll, true);
        clearTimeout(scrollEnd); scrolling = false;
        observer?.disconnect();
        observer = null;
      }
    };
}
export function useAnimationVisibility<T extends HTMLElement>(ref: RefObject<T | null>, enabled = true) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    return watchAnimationVisibility(element, setVisible);
  }, [ref, enabled]);
  return !enabled || visible;
}
