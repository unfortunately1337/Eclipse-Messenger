export type MessageSizeSubscription = { disconnect: () => void };
const callbacks = new Map<Element, (height: number) => void>();
let observer: ResizeObserver | undefined;

/** One observer batches size changes for every mounted message in a frame. */
export function observeMessageSize(node: HTMLElement, onHeight: (height: number) => void): MessageSizeSubscription {
  if (typeof ResizeObserver === "undefined") {
    onHeight(node.offsetHeight);
    return { disconnect() {} };
  }
  observer ??= new ResizeObserver(entries => {
    for (const entry of entries) {
      const notify = callbacks.get(entry.target);
      if (notify) notify(entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight);
    }
  });
  callbacks.set(node, onHeight);
  observer.observe(node, { box: "border-box" });
  return {
    disconnect() {
      if (callbacks.get(node) !== onHeight) return;
      callbacks.delete(node);
      observer?.unobserve(node);
      if (!callbacks.size) { observer?.disconnect(); observer = undefined; }
    },
  };
}
