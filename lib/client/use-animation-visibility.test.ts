import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchAnimationVisibility } from "./use-animation-visibility";

class TestNode {
  constructor(public parent: TestNode | null = null) {}
  contains(other: TestNode): boolean { return other === this || Boolean(other.parent && this.contains(other.parent)); }
}
const listeners = new Map<string, (event: Event) => void>();
const cleanup: Array<() => void> = [];
let hidden = false;
function watch(node: TestNode) {
  const changed = vi.fn();
  cleanup.push(watchAnimationVisibility(node as unknown as Element, changed));
  return changed;
}
function scroll(node: TestNode) { listeners.get("scroll")?.({ target: node } as unknown as Event); }
beforeEach(() => {
  vi.useFakeTimers(); hidden = false;
  vi.stubGlobal("Node", TestNode);
  vi.stubGlobal("document", {
    get hidden() { return hidden; },
    addEventListener: (name: string, listener: (event: Event) => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private changed: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void) {}
    observe(target: Element) { this.changed([{ target, isIntersecting: true }]); }
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { for (const stop of cleanup.splice(0)) stop(); listeners.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("independent animation panes", () => {
  it("only pauses media inside the pane being scrolled", () => {
    const chat = new TestNode(), profile = new TestNode();
    const chatMedia = watch(new TestNode(chat)), profileMedia = watch(new TestNode(profile));
    scroll(chat);
    expect(chatMedia.mock.calls).toEqual([[true], [false]]);
    expect(profileMedia.mock.calls).toEqual([[true]]);
    vi.advanceTimersByTime(140);
    expect(chatMedia.mock.calls).toEqual([[true], [false], [true]]);
    expect(profileMedia).toHaveBeenCalledOnce();
  });
  it("waits for both nested scroll containers to settle", () => {
    const outer = new TestNode(), inner = new TestNode(outer), changed = watch(new TestNode(inner));
    scroll(inner); vi.advanceTimersByTime(70); scroll(outer); vi.advanceTimersByTime(70);
    expect(changed.mock.calls).toEqual([[true], [false]]);
    vi.advanceTimersByTime(70);
    expect(changed.mock.calls).toEqual([[true], [false], [true]]);
  });
  it("does not briefly start newly mounted media during an ongoing scroll", () => {
    const pane = new TestNode(); watch(new TestNode(pane)); scroll(pane);
    const mounted = watch(new TestNode(pane)); expect(mounted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(140); expect(mounted.mock.calls).toEqual([[true]]);
  });
  it("resumes a watched element moved to a different pane while scrolling", () => {
    const a = new TestNode(), b = new TestNode(), element = new TestNode(a), changed = watch(element);
    scroll(a); element.parent = b; vi.advanceTimersByTime(140);
    expect(changed.mock.calls).toEqual([[true], [false], [true]]);
  });
  it("still stops every pane when the page is hidden and releases pending work on cleanup", () => {
    const a = new TestNode(), b = new TestNode(), first = watch(a), second = watch(b);
    hidden = true; listeners.get("visibilitychange")?.(new Event("visibilitychange"));
    expect(first.mock.calls).toEqual([[true], [false]]); expect(second.mock.calls).toEqual([[true], [false]]);
    scroll(a);
    for (const stop of cleanup.splice(0)) stop();
    expect(vi.getTimerCount()).toBe(0); expect(listeners.size).toBe(0);
  });
});
