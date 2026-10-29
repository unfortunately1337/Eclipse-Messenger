import { afterEach, describe, expect, it, vi } from "vitest";
import { schedulePanelIdle } from "./panel-work";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("optional panel work", () => {
  it("waits until after the entrance, then uses idle time", () => {
    vi.useFakeTimers();
    const idle = vi.fn();
    vi.stubGlobal("window", { setTimeout, clearTimeout, requestIdleCallback: idle, cancelIdleCallback: vi.fn() });
    const task = vi.fn();
    schedulePanelIdle(task);
    vi.advanceTimersByTime(219);
    expect(idle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(task).not.toHaveBeenCalled();
    idle.mock.calls[0][0]();
    expect(task).toHaveBeenCalledOnce();
  });
  it("does not run work for a closed panel even if an idle callback was already queued", () => {
    vi.useFakeTimers();
    const idle = vi.fn<(callback: () => void) => number>().mockReturnValue(7), cancel = vi.fn(), task = vi.fn();
    vi.stubGlobal("window", { setTimeout, clearTimeout, requestIdleCallback: idle, cancelIdleCallback: cancel });
    const stop = schedulePanelIdle(task);
    vi.advanceTimersByTime(220);
    stop();
    idle.mock.calls[0][0]();
    expect(task).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith(7);
  });
  it("supports browsers without idle callbacks and cancels before the delay", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const task = vi.fn(), cancel = schedulePanelIdle(task);
    cancel(); vi.runAllTimers(); expect(task).not.toHaveBeenCalled();
    schedulePanelIdle(task); vi.advanceTimersByTime(220); expect(task).toHaveBeenCalledOnce();
  });
});
