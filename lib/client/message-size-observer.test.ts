import { afterEach, expect, it, vi } from "vitest";
import { observeMessageSize } from "./message-size-observer";
afterEach(() => { vi.unstubAllGlobals(); });
function setup() {
  let report!: ResizeObserverCallback;
  const observer = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
  const create = vi.fn(function (callback: ResizeObserverCallback) { report = callback; return observer; });
  vi.stubGlobal("ResizeObserver", create);
  return { observer, create, report: (entries: unknown[]) => report(entries as ResizeObserverEntry[], observer as unknown as ResizeObserver) };
}
it("batches mounted messages in one observer and uses completed layout without forced height reads", () => {
  const state = setup(), first = vi.fn(), second = vi.fn();
  const a = { get offsetHeight(): number { throw new Error("forced layout"); } } as unknown as HTMLElement, b = {} as HTMLElement;
  const one = observeMessageSize(a, first), two = observeMessageSize(b, second);
  expect(state.create).toHaveBeenCalledOnce();
  expect(first).not.toHaveBeenCalled();
  state.report([{ target: a, borderBoxSize: [{ blockSize: 51.5 }] }, { target: b, borderBoxSize: [{ blockSize: 80 }] }]);
  expect(first).toHaveBeenCalledWith(51.5); expect(second).toHaveBeenCalledWith(80);
  one.disconnect(); expect(state.observer.disconnect).not.toHaveBeenCalled();
  state.report([{ target: a, borderBoxSize: [{ blockSize: 99 }] }]);
  expect(first).toHaveBeenCalledOnce();
  two.disconnect(); expect(state.observer.disconnect).toHaveBeenCalledOnce();
});
it("a stale cleanup cannot detach the replacement callback for the same message element", () => {
  const state = setup(), node = {} as HTMLElement, next = vi.fn();
  const previous = observeMessageSize(node, vi.fn()), replacement = observeMessageSize(node, next);
  previous.disconnect();
  state.report([{ target: node, borderBoxSize: [{ blockSize: 60 }] }]);
  expect(next).toHaveBeenCalledWith(60);
  replacement.disconnect();
});
it("still measures a message when ResizeObserver is unavailable", () => {
  vi.stubGlobal("ResizeObserver", undefined);
  const height = vi.fn(), subscription = observeMessageSize({ offsetHeight: 70 } as HTMLElement, height);
  expect(height).toHaveBeenCalledWith(70); subscription.disconnect();
});
