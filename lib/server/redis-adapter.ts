import type Redis from "ioredis";
import type { RedisLike } from "./redis";

// Security state has one authority across processes. Never authorize using
// a cached session after Redis has deleted it or become unavailable.
export function createRemoteRedis(real: Redis): RedisLike {
  return {
    async consumeRollingLimit(key, limit, seconds, now) {
      // All workers reserve quota atomically. Deleting a story does not erase
      // its timestamp, and the window does not reset at a fixed boundary.
      const result = await real.eval(`
        local cutoff = tonumber(ARGV[3]) - tonumber(ARGV[2]) * 1000
        local recent = {}
        local oldest = tonumber(ARGV[3])
        for _, value in ipairs(redis.call('LRANGE', KEYS[1], 0, -1)) do
          local time = tonumber(value)
          if time > cutoff then table.insert(recent, value); oldest = math.min(oldest, time) end
        end
        if #recent >= tonumber(ARGV[1]) then
          return math.max(1, math.ceil((oldest + tonumber(ARGV[2]) * 1000 - tonumber(ARGV[3])) / 1000))
        end
        redis.call('DEL', KEYS[1])
        for _, value in ipairs(recent) do redis.call('RPUSH', KEYS[1], value) end
        redis.call('RPUSH', KEYS[1], ARGV[3])
        redis.call('EXPIRE', KEYS[1], ARGV[2])
        return 0`, 1, key, limit, seconds, now);
      if (typeof result !== "number") throw new Error("Invalid rolling quota result");
      return result;
    },
    async compareAndSet(key, expected, value, seconds) {
      return (await real.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1; end; return 0", 1, key, expected, value, seconds)) === 1;
    },
    get: key => real.get(key),
    mget: (...keys) => real.mget(...keys),
    async set(key, value, ...args) {
      const set = real.set.bind(real) as unknown as (key: string, value: string, ...args: Array<string | number>) => Promise<string | null>;
      const result = await set(key, value, ...args);
      if (result !== "OK") throw new Error("Redis write was not committed");
      return "OK";
    },
    async setIfExists(key, value, seconds) {
      return (await real.set(key, value, "EX", seconds, "XX")) === "OK";
    },
    incr: key => real.incr(key),
    async incrementWithExpiry(key, seconds) {
      const count = await real.eval(
        "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
        1, key, seconds,
      );
      if (typeof count !== "number") throw new Error("Invalid Redis counter result");
      return count;
    },
    del: (...keys) => real.del(...keys),
    expire: (key, seconds) => real.expire(key, seconds),
    rpush: (key, ...values) => real.rpush(key, ...values),
    lrange: (key, start, stop) => real.lrange(key, start, stop),
    lindex: (key, index) => real.lindex(key, index),
    sadd: (key, ...members) => real.sadd(key, ...members),
    smembers: key => real.smembers(key),
    srem: (key, ...members) => real.srem(key, ...members),
    ttl: key => real.ttl(key),
  };
}
