import { afterEach, expect, it, vi } from "vitest";
import { scheduleAnimationMount, deferAnimationMounts } from "./animation-mount-queue";
afterEach(() => vi.unstubAllGlobals());
it("keeps new emoji construction out of an ongoing or interrupted panel transition", () => {
  const frames = new Map<number, FrameRequestCallback>(); let next = 0, now = 0;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { frames.set(++next, fn); return next; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("performance", { now: () => now });
  const mounted = vi.fn();
  deferAnimationMounts(300); scheduleAnimationMount(mounted);
  function frame() { const [id, run] = [...frames][0]; frames.delete(id); run(now); }
  now = 100; frame(); expect(mounted).not.toHaveBeenCalled();
  deferAnimationMounts(300);
  now = 310; frame(); expect(mounted).not.toHaveBeenCalled();
  now = 401; frame(); expect(mounted).toHaveBeenCalledOnce(); expect(frames.size).toBe(0);
});
it("spreads expensive mounts across frames and cancels renderers that left the viewport", () => {
  const frames = new Map<number, FrameRequestCallback>(); let next = 0, now = 1000;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { frames.set(++next, fn); return next; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("performance", { now: () => now });
  const mounted: number[] = [];
  for (let i = 0; i < 12; i++) {
    const cancel = scheduleAnimationMount(() => { mounted.push(i); now += 5; });
    if (i % 2) cancel();
  }
  expect(frames.size).toBe(1);
  let rounds = 0;
  while (frames.size) { const [id, fn] = [...frames][0]; frames.delete(id); fn(now); rounds++; }
  expect(rounds).toBe(6); expect(mounted).toEqual([0, 2, 4, 6, 8, 10]);
  const cancel = scheduleAnimationMount(() => mounted.push(99)); cancel();
  expect(frames.size).toBe(0);
});
