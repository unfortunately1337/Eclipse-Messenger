import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { callElapsedSeconds, formatCallElapsed, observeCallElapsed } from "./call-elapsed";

let hidden = false;
let visibility: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(10_250); hidden = false;
  vi.stubGlobal("document", {
    get hidden() { return hidden; },
    addEventListener: vi.fn((_event, callback) => { visibility = callback; }),
    removeEventListener: vi.fn((_event, callback) => { if (visibility === callback) visibility = undefined; }),
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("aligns UI ticks with the call's second boundary instead of drifting after mount", () => {
  const update = vi.fn(), stop = observeCallElapsed(1000, update);
  expect(update).toHaveBeenLastCalledWith(9);
  vi.advanceTimersByTime(749); expect(update).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1); expect(update).toHaveBeenLastCalledWith(10);
  vi.advanceTimersByTime(1000); expect(update).toHaveBeenLastCalledWith(11);
  stop(); expect(vi.getTimerCount()).toBe(0);
});

it("pauses hidden-tab work and immediately catches up on return without accumulating ticks", () => {
  const update = vi.fn(), stop = observeCallElapsed(1000, update);
  hidden = true; visibility?.();
  expect(vi.getTimerCount()).toBe(0);
  const calls = update.mock.calls.length;
  vi.advanceTimersByTime(90_000); expect(update).toHaveBeenCalledTimes(calls);
  hidden = false; visibility?.(); expect(update).toHaveBeenLastCalledWith(99);
  expect(vi.getTimerCount()).toBe(1);
  stop(); expect(visibility).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
});

it("uses wall-clock elapsed time after delayed execution and clamps future starts", () => {
  expect(callElapsedSeconds(20_000, 10_000)).toBe(0);
  expect(callElapsedSeconds(1000, 5_618_000)).toBe(5617);
  expect(formatCallElapsed(5617)).toBe("93:37");
});
