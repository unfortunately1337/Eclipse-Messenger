import { afterEach, expect, it, vi } from "vitest";
import { observeViewportGeometry } from "./observe-viewport-geometry";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("coalesces profile width animation but responds immediately to keyboard height changes", () => {
  vi.useFakeTimers(); let resize: () => void = () => {};
  vi.stubGlobal("ResizeObserver", class { constructor(fn: () => void) { resize = fn; } observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  const element = { clientWidth: 900, clientHeight: 600 }, update = vi.fn();
  const stop = observeViewportGeometry(element as HTMLElement, update);
  for (let i = 0; i < 12; i++) { element.clientWidth -= 20; resize(); vi.advanceTimersByTime(16); }
  expect(update).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(100); expect(update).toHaveBeenCalledTimes(2);
  element.clientHeight = 300; resize(); vi.advanceTimersByTime(16);
  expect(update).toHaveBeenCalledTimes(3);
  element.clientWidth = 500; resize(); stop(); vi.advanceTimersByTime(100);
  expect(update).toHaveBeenCalledTimes(3);
});
