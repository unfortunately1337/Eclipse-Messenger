"use client";

import { useEffect, useState, type RefObject } from "react";

type WatchedElement = { intersects: boolean; visible: boolean; notify: (visible: boolean) => void };
const watched = new Map<Element, WatchedElement>();
let observer: IntersectionObserver | null = null;
const scrollEnds = new Map<Node, ReturnType<typeof setTimeout>>();
function isScrolling(element: Element) {
  for (const container of scrollEnds.keys()) if (container.contains(element)) return true;
  return false;
}
function refreshContainer(container: Node) {
  for (const [element, entry] of watched) {
    if (container.contains(element)) updateEntry(entry, entry.intersects && !document.hidden && !isScrolling(element));
  }
}
function onScroll(event: Event) {
  const container = event.target;
  if (!(container instanceof Node)) return;
  const previous = scrollEnds.get(container);
  if (previous !== undefined) clearTimeout(previous);
  scrollEnds.set(container, setTimeout(() => {
    scrollEnds.delete(container);
    // A portal or responsive layout may have moved a watched element meanwhile.
    notifyVisibility();
  }, 140));
  if (previous === undefined) refreshContainer(container);
}
function notifyVisibility() {
  for (const [element, entry] of watched) updateEntry(entry, entry.intersects && !document.hidden && !isScrolling(element));
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
          updateEntry(current, change.isIntersecting && !document.hidden && !isScrolling(change.target));
        }
      }, { rootMargin: "60px" });
      observer.observe(element);
    } else {
      updateEntry(entry, !document.hidden && !isScrolling(element));
    }
    return () => {
      observer?.unobserve(element);
      watched.delete(element);
      if (!watched.size) {
        document.removeEventListener("visibilitychange", notifyVisibility);
        document.removeEventListener("scroll", onScroll, true);
        for (const timer of scrollEnds.values()) clearTimeout(timer);
        scrollEnds.clear();
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
