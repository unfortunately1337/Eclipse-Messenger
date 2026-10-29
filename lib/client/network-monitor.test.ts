import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNetworkMonitor } from "./network-monitor";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); });
afterEach(() => vi.useRealTimers());

describe("confirmed connection notifications", () => {
  it("ignores browser offline hints when the origin is reachable", async () => {
    const changed = vi.fn(), monitor = createNetworkMonitor(async () => true, changed, () => true);
    for (let i = 0; i < 5; i++) await monitor.verify();
    expect(changed).not.toHaveBeenCalled(); monitor.stop();
  });
  it("does not announce isolated timeouts or an unannounced recovery", async () => {
    const changed = vi.fn(), probe = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const monitor = createNetworkMonitor(probe, changed, () => true);
    await monitor.verify(); await vi.advanceTimersByTimeAsync(6000);
    expect(changed).not.toHaveBeenCalled(); monitor.stop();
  });
  it("announces a sustained failure once and confirms recovery with two successful probes", async () => {
    const changed = vi.fn(), probe = vi.fn().mockResolvedValue(false);
    const monitor = createNetworkMonitor(probe, changed, () => true);
    await monitor.verify(); await vi.advanceTimersByTimeAsync(4500);
    expect(changed.mock.calls).toEqual([[true]]);
    await vi.advanceTimersByTimeAsync(10000);
    expect(changed).toHaveBeenCalledTimes(1);
    probe.mockResolvedValue(true);
    await monitor.verify(); expect(changed).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(changed.mock.calls).toEqual([[true], [false]]);
    await monitor.verify(); expect(changed).toHaveBeenCalledTimes(2); monitor.stop();
  });
  it("does not report an older failure after a newer online check was requested", async () => {
    let finish!: (reachable: boolean) => void;
    const probe = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValue(true);
    const changed = vi.fn(), monitor = createNetworkMonitor(probe, changed, () => true);
    const pending = monitor.verify(); await monitor.verify(); finish(false); await pending;
    await vi.advanceTimersByTimeAsync(5000);
    expect(changed).not.toHaveBeenCalled(); monitor.stop();
  });
  it("cancels pending retries and in-flight results after unmount", async () => {
    const changed = vi.fn(), probe = vi.fn().mockResolvedValue(false);
    const monitor = createNetworkMonitor(probe, changed, () => true);
    await monitor.verify(); monitor.stop(); await vi.advanceTimersByTimeAsync(20000);
    expect(probe).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled();
    let finish!: (reachable: boolean) => void;
    const other = createNetworkMonitor(() => new Promise(resolve => { finish = resolve; }), changed, () => true);
    const result = other.verify(); other.stop(); finish(false); await result;
    expect(changed).not.toHaveBeenCalled();
  });
  it("does not count suspended/background checks as network failures", async () => {
    const changed = vi.fn(); let visible = true;
    const monitor = createNetworkMonitor(async () => false, changed, () => visible);
    await monitor.verify(); await vi.advanceTimersByTimeAsync(1500);
    visible = false; await monitor.verify(); await vi.advanceTimersByTimeAsync(60000);
    visible = true; await monitor.verify(); expect(changed).not.toHaveBeenCalled();
    monitor.stop();
  });
});
