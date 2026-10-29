import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("./redis", () => ({ redis: {
  get: async (key: string) => state.values.get(key) ?? null,
  set: async (key: string, value: string) => { state.values.set(key, value); return "OK"; },
  setIfAbsent: async (key: string, value: string) => { if (state.values.has(key)) return false; state.values.set(key, value); return true; },
  compareAndDelete: async (key: string, value: string) => { if (state.values.get(key) === value) return state.values.delete(key); return false; },
} }));
import { deliverCallOnce } from "./call-delivery";
beforeEach(() => state.values.clear());
it("never marks a failed delivery sent and releases its lease for retry", async () => {
  const publish = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  await expect(deliverCallOnce("call", publish)).rejects.toThrow("offline");
  expect(state.values.get("call")).toBeUndefined(); expect(state.values.get("call:lock")).toBeUndefined();
  await expect(deliverCallOnce("call", publish)).resolves.toBe(true);
  await expect(deliverCallOnce("call", publish)).resolves.toBe(true);
  expect(publish).toHaveBeenCalledTimes(2);
});
it("keeps an in-flight job pending and permits recovery after the crashed process lease expires", async () => {
  state.values.set("call:lock", "old-process");
  const publish = vi.fn().mockResolvedValue(undefined);
  await expect(deliverCallOnce("call", publish)).resolves.toBe(false);
  expect(publish).not.toHaveBeenCalled();
  state.values.delete("call:lock"); // Redis expires the 15-second lease.
  await expect(deliverCallOnce("call", publish)).resolves.toBe(true);
  expect(publish).toHaveBeenCalledTimes(1);
});
