"use client";

import { useCallback, useSyncExternalStore } from "react";

type Subscription = { ids: readonly string[]; targets: (HTMLElement | null)[]; notify: () => void };
const subscriptions = new Set<Subscription>();
let observer: MutationObserver | null = null;

/** One filtered observer for media slots; message/emoji mutations do not trigger React updates. */
export function watchMediaPortalTargets(ids: readonly string[], notify: () => void) {
  const entry: Subscription = { ids, targets: ids.map(id => document.getElementById(id)), notify };
  subscriptions.add(entry);
  if (!observer) {
    observer = new MutationObserver(records => {
      for (const subscription of subscriptions) {
        const removed = subscription.targets.some(target => target && !target.isConnected);
        const missing = subscription.targets.some(target => !target);
        if (!removed && !missing) continue;
        const selector = subscription.ids.map(id => `[id="${id}"]`).join(",");
        const added = missing && records.some(record => Array.from(record.addedNodes).some(node => {
          if (!(node instanceof Element)) return false;
          return subscription.ids.includes(node.id) || node.querySelector(selector);
        }));
        if (!removed && !added) continue;
        const next = subscription.ids.map(id => document.getElementById(id));
        if (next.every((target, index) => target === subscription.targets[index])) continue;
        subscription.targets = next;
        subscription.notify();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  notify();
  return () => {
    subscriptions.delete(entry);
    if (!subscriptions.size) { observer?.disconnect(); observer = null; }
  };
}

const emptyTarget = () => null;
export function useMediaPortalTarget(id: string, enabled: boolean) {
  const subscribe = useCallback((notify: () => void) => enabled ? watchMediaPortalTargets([id], notify) : () => {}, [id, enabled]);
  const snapshot = useCallback(() => enabled ? document.getElementById(id) : null, [id, enabled]);
  return useSyncExternalStore(subscribe, snapshot, emptyTarget);
}
