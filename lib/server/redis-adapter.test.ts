import { describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";
import { createRemoteRedis } from "./redis-adapter";

describe("shared Redis security state", () => {
  it("reserves call slots atomically and only releases a reservation still owned by the same call", async () => {
    const real = { set: vi.fn().mockResolvedValueOnce("OK").mockResolvedValueOnce(null), eval: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1) } as unknown as Redis;
    const client = createRemoteRedis(real);
    expect(await client.setIfAbsent("slot", "call-one", 60)).toBe(true);
    expect(await client.setIfAbsent("slot", "call-two", 60)).toBe(false);
    expect(real.set).toHaveBeenCalledWith("slot", "call-one", "EX", 60, "NX");
    expect(await client.compareAndDelete("slot", "call-two")).toBe(false);
    expect(await client.compareAndDelete("slot", "call-one")).toBe(true);
    expect(real.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('DEL'"), 1, "slot", "call-one");
  });
  it("claims a QR token with an atomic compare-and-set instead of overwriting another approval", async () => {
    const real = { eval: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) } as unknown as Redis;
    const client = createRemoteRedis(real);
    expect(await client.compareAndSet("qr", "pending", "claimed", 60)).toBe(true);
    expect(await client.compareAndSet("qr", "pending", "claimed-again", 60)).toBe(false);
    expect(real.eval).toHaveBeenCalledWith(expect.stringContaining("ARGV[1]"), 1, "qr", "pending", "claimed", 60);
  });
  it("sees revocation across independent server adapters without a local cache", async () => {
    const store = new Map<string, string>();
    const connection = () => ({
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => { store.set(key, value); return "OK"; }),
      del: vi.fn(async (key: string) => Number(store.delete(key))),
    }) as unknown as Redis;
    const workerOne = createRemoteRedis(connection());
    const workerTwo = createRemoteRedis(connection());
    await workerOne.set("session:alice", "valid", "EX", 60);
    expect(await workerTwo.get("session:alice")).toBe("valid");
    await workerOne.del("session:alice");
    expect(await workerTwo.get("session:alice")).toBeNull();
  });
  it("never acknowledges a failed write or returns stale authentication after an outage", async () => {
    const real = { set: vi.fn().mockRejectedValue(new Error("offline")), get: vi.fn().mockRejectedValue(new Error("offline")) } as unknown as Redis;
    const client = createRemoteRedis(real);
    await expect(client.set("session", "data")).rejects.toThrow("offline");
    await expect(client.get("session")).rejects.toThrow("offline");
  });
  it("updates a session only if it still exists and counts requests atomically", async () => {
    const real = { set: vi.fn().mockResolvedValue(null), eval: vi.fn().mockResolvedValue(8) } as unknown as Redis;
    const client = createRemoteRedis(real);
    expect(await client.setIfExists("revoked", "stale", 60)).toBe(false);
    expect(real.set).toHaveBeenCalledWith("revoked", "stale", "EX", 60, "XX");
    expect(await client.incrementWithExpiry("limit", 30)).toBe(8);
    expect(real.eval).toHaveBeenCalledWith(expect.stringContaining("EXPIRE"), 1, "limit", 30);
  });
});
