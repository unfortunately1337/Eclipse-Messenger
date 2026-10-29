import { describe, expect, it, vi } from "vitest";
import { createCallRenderScheduler } from "./call-render-scheduler";

describe("call SDK rendering", () => {
  it("renders an entire burst of connection and track events only once", () => {
    let flush!: FrameRequestCallback;
    const render = vi.fn(), request = vi.fn((callback: FrameRequestCallback) => { flush = callback; return 1; });
    const scheduler = createCallRenderScheduler(render, request, vi.fn());
    for (let i = 0; i < 100; i++) scheduler.update();
    expect(request).toHaveBeenCalledOnce(); expect(render).not.toHaveBeenCalled();
    flush(0); expect(render).toHaveBeenCalledOnce();
    scheduler.update(); expect(request).toHaveBeenCalledTimes(2);
  });
  it("cancels pending work and ignores late SDK events after disconnect", () => {
    let flush!: FrameRequestCallback;
    const render = vi.fn(), cancel = vi.fn();
    const scheduler = createCallRenderScheduler(render, callback => { flush = callback; return 7; }, cancel);
    scheduler.update(); scheduler.dispose(); scheduler.update(); flush(0);
    expect(cancel).toHaveBeenCalledWith(7); expect(render).not.toHaveBeenCalled();
  });
});
