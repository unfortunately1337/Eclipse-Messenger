import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { describe, expect, it } from "vitest";
import { createRemoteRedis } from "./redis-adapter";

// Explicit opt-in: never connect to the application's Redis or erase its keys.
describe.skipIf(!process.env.SECURITY_TEST_REDIS_URL)("real Redis security state", () => {
  it("shares revocation, prevents resurrection and counts concurrent requests with a TTL", async () => {
    const first = new Redis(process.env.SECURITY_TEST_REDIS_URL!, { maxRetriesPerRequest: 1 });
    const second = new Redis(process.env.SECURITY_TEST_REDIS_URL!, { maxRetriesPerRequest: 1 });
    const a = createRemoteRedis(first), b = createRemoteRedis(second);
    const prefix = `eclipse-security-test:${randomUUID()}`;
    const session = `${prefix}:session`, counter = `${prefix}:counter`, rolling = `${prefix}:rolling`;
    try {
      await a.set(session, "valid", "EX", 60);
      expect(await b.get(session)).toBe("valid");
      await a.del(session);
      expect(await b.get(session)).toBeNull();
      expect(await b.setIfExists(session, "stale", 60)).toBe(false);
      expect(await a.get(session)).toBeNull();
      const counts = await Promise.all(Array.from({ length: 100 }, (_, n) =>
        (n % 2 ? a : b).incrementWithExpiry(counter, 60)));
      expect(new Set(counts).size).toBe(100);
      expect(Math.max(...counts)).toBe(100);
      expect(await a.ttl(counter)).toBeGreaterThan(0);
      expect(await b.get(counter)).toBe("100");
      const now = Date.now();
      const reservations = await Promise.all(Array.from({ length: 20 }, (_, n) =>
        (n % 2 ? a : b).consumeRollingLimit(rolling, 6, 172800, now)));
      expect(reservations.filter(value => value === 0)).toHaveLength(6);
      // A quota filled just before a fixed-window boundary must not reset.
      expect(await a.consumeRollingLimit(rolling, 6, 172800, now + 172799000)).toBe(1);
      expect(await b.consumeRollingLimit(rolling, 6, 172800, now + 172800000)).toBe(0);
    } finally {
      await first.del(session, counter, rolling);
      await Promise.all([first.quit(), second.quit()]);
    }
  });
});
