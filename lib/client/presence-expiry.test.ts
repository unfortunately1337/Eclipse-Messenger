import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchPresenceExpiry } from "./presence-expiry";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });
it("does no periodic work before the first deadline and expires peers at their server deadlines", () => {
  const expired = vi.fn(), map = new Map([["a", 12000], ["b", 18000], ["c", 18000]]);
  const cancel = watchPresenceExpiry(map, expired);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(11999); expect(expired).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(expired).toHaveBeenLastCalledWith(["a"]);
  vi.advanceTimersByTime(6000); expect(expired).toHaveBeenLastCalledWith(["b", "c"]);
  expect(map.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  cancel();
});
it("cancels old deadlines when a new presence response extends a peer's lease", () => {
  const expired = vi.fn(), map = new Map([["peer", 1000]]);
  watchPresenceExpiry(map, expired)();
  map.set("peer", 5000);
  const cancel = watchPresenceExpiry(map, expired);
  vi.advanceTimersByTime(1000); expect(expired).not.toHaveBeenCalled();
  vi.advanceTimersByTime(4000); expect(expired).toHaveBeenCalledWith(["peer"]);
  cancel();
});
it("keeps an empty presence snapshot idle and stops callbacks on disposal", () => {
  const expired = vi.fn();
  watchPresenceExpiry(new Map(), expired)();
  expect(vi.getTimerCount()).toBe(0);
  const cancel = watchPresenceExpiry(new Map([["peer", 1000]]), expired);
  cancel(); vi.advanceTimersByTime(5000);
  expect(expired).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
