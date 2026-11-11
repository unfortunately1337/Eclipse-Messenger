import { beforeEach, describe, expect, it, vi } from "vitest";

const { data, redis } = vi.hoisted(() => {
  const data = new Map<string, string>();
  return { data, redis: {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    setIfAbsent: vi.fn(async (key: string, value: string) => { if (data.has(key)) return false; data.set(key, value); return true; }),
    compareAndSet: vi.fn(async (key: string, expected: string, value: string) => { if (data.get(key) !== expected) return false; data.set(key, value); return true; }),
  } };
});
vi.mock("./redis", () => ({ redis }));
import { enforceMessageRateLimit } from "./message-rate-limit";

describe("shared outgoing message quotas", () => {
  beforeEach(() => { data.clear(); vi.clearAllMocks(); });
  it("reserves exactly eight sends under concurrent requests, regardless of payload type", async () => {
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => enforceMessageRateLimit("alice", "direct:bob", 60_000)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(8);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ status: 429, details: { code: "MESSAGE_RATE_LIMIT", scope: "chat", retryAfterSeconds: 5 } });
  });
  it("does not extend the cooldown when rejected messages are retried", async () => {
    for (let i = 0; i < 8; i++) await enforceMessageRateLimit("alice", "direct:bob", 60_000);
    const saved = data.get("rate:message:v2:alice");
    await expect(enforceMessageRateLimit("alice", "direct:bob", 64_001)).rejects.toMatchObject({ status: 429, details: { retryAfterSeconds: 1 } });
    expect(data.get("rate:message:v2:alice")).toBe(saved);
    await expect(enforceMessageRateLimit("alice", "direct:bob", 65_000)).resolves.toBeUndefined();
  });
  it("also limits sustained sending within one chat", async () => {
    for (let i = 0; i < 30; i++) await enforceMessageRateLimit("alice", "group:one", 60_000 + Math.floor(i / 8) * 5_000);
    await expect(enforceMessageRateLimit("alice", "group:one", 80_000)).rejects.toMatchObject({ status: 429, details: { retryAfterSeconds: 10 } });
    await expect(enforceMessageRateLimit("alice", "group:two", 80_000)).resolves.toBeUndefined();
  });
  it("shares the account quota across chats and allows another account independently", async () => {
    for (let i = 0; i < 90; i++) await enforceMessageRateLimit("alice", `direct:peer${i}`, 60_000);
    await expect(enforceMessageRateLimit("alice", "channel:new", 60_000)).rejects.toMatchObject({ status: 429, details: { scope: "account", retryAfterSeconds: 60 } });
    await expect(enforceMessageRateLimit("bob", "channel:new", 60_000)).resolves.toBeUndefined();
    await expect(enforceMessageRateLimit("alice", "channel:new", 120_000)).resolves.toBeUndefined();
  });
  it("calculates retry time even when concurrent reservations have out of order timestamps", async () => {
    data.set("rate:message:v2:alice", JSON.stringify([64_000, 60_000, 61_000, 62_000, 63_000, 60_500, 61_500, 62_500].map(at => ({ at, target: "direct:bob" }))));
    await expect(enforceMessageRateLimit("alice", "direct:bob", 64_100)).rejects.toMatchObject({ details: { retryAfterSeconds: 1 } });
  });
  it("fails closed when shared storage is unavailable", async () => {
    redis.get.mockRejectedValueOnce(new Error("offline"));
    await expect(enforceMessageRateLimit("alice", "direct:bob", 60_000)).rejects.toMatchObject({ status: 503 });
  });
});
