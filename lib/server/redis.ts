import Redis from "ioredis";
import { createRemoteRedis } from "./redis-adapter";

const globalForRedis = globalThis as unknown as { redis?: Redis };
const globalForMemoryRedis = globalThis as unknown as { __memoryRedisStore?: Map<string, string> };

export type RedisLike = {
  get: (key: string) => Promise<string | null>;
  mget: (...keys: string[]) => Promise<Array<string | null>>;
  set: (key: string, value: string, ...args: Array<string | number>) => Promise<"OK">;
  incr: (key: string) => Promise<number>;
  incrementWithExpiry: (key: string, seconds: number) => Promise<number>;
  consumeRollingLimit: (key: string, limit: number, seconds: number, now: number) => Promise<number>;
  setIfExists: (key: string, value: string, seconds: number) => Promise<boolean>;
  compareAndSet: (key: string, expected: string, value: string, seconds: number) => Promise<boolean>;
  setIfAbsent: (key: string, value: string, seconds: number) => Promise<boolean>;
  compareAndDelete: (key: string, expected: string) => Promise<boolean>;
  del: (...keys: string[]) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  rpush: (key: string, ...values: string[]) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  lindex: (key: string, index: number) => Promise<string | null>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  srem: (key: string, ...members: string[]) => Promise<number>;
  ttl: (key: string) => Promise<number>;
};

function createMemoryRedis(): RedisLike {
  const store = globalForMemoryRedis.__memoryRedisStore ?? new Map<string, string>();
  globalForMemoryRedis.__memoryRedisStore = store;

  const globalForExpirations = globalThis as unknown as { __memoryRedisExpirations?: Map<string, number> };
  const expirations = globalForExpirations.__memoryRedisExpirations ?? new Map<string, number>();
  globalForExpirations.__memoryRedisExpirations = expirations;

  const cleanup = (key: string) => {
    const expiry = expirations.get(key);
    if (typeof expiry === "number" && Date.now() >= expiry) {
      store.delete(key);
      expirations.delete(key);
    }
  };

  const parseList = (raw: string | undefined) => {
    if (!raw) return [] as string[];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  const parseSet = (raw: string | undefined) => {
    if (!raw) return new Set<string>();
    try {
      const parsed = JSON.parse(raw) as unknown;
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set<string>();
    }
  };

  return {
    async setIfAbsent(key, value, seconds) {
      cleanup(key);
      if (store.has(key)) return false;
      store.set(key, value);
      expirations.set(key, Date.now() + seconds * 1000);
      return true;
    },
    async compareAndDelete(key, expected) {
      cleanup(key);
      if (store.get(key) !== expected) return false;
      store.delete(key);
      expirations.delete(key);
      return true;
    },
    async consumeRollingLimit(key, limit, seconds, now) {
      cleanup(key);
      const cutoff = now - seconds * 1000;
      const entries = parseList(store.get(key)).map(Number).filter(time => time > cutoff);
      if (entries.length >= limit) return Math.max(1, Math.ceil((Math.min(...entries) + seconds * 1000 - now) / 1000));
      entries.push(now);
      store.set(key, JSON.stringify(entries));
      expirations.set(key, now + seconds * 1000);
      return 0;
    },
    async compareAndSet(key, expected, value, seconds) {
      cleanup(key);
      if (store.get(key) !== expected) return false;
      store.set(key, value);
      expirations.set(key, Date.now() + seconds * 1000);
      return true;
    },
    async get(key) {
      cleanup(key);
      return store.get(key) ?? null;
    },
    async mget(...keys) {
      return keys.map((key) => {
        cleanup(key);
        return store.get(key) ?? null;
      });
    },
    async set(key, value, ...args) {
      store.set(key, value);
      const exIndex = args.findIndex((arg) => String(arg).toUpperCase() === "EX");
      if (exIndex >= 0) {
        const ttlSec = Number(args[exIndex + 1]);
        if (Number.isFinite(ttlSec) && ttlSec > 0) {
          expirations.set(key, Date.now() + ttlSec * 1000);
        }
      }
      return "OK";
    },
    async incr(key) {
      cleanup(key);
      const current = Number.parseInt(store.get(key) ?? "0", 10);
      const next = Number.isFinite(current) ? current + 1 : 1;
      store.set(key, String(next));
      return next;
    },
    async incrementWithExpiry(key, seconds) {
      cleanup(key);
      const next = Number(store.get(key) ?? "0") + 1;
      store.set(key, String(next));
      if (next === 1) expirations.set(key, Date.now() + seconds * 1000);
      return next;
    },
    async setIfExists(key, value, seconds) {
      cleanup(key);
      if (!store.has(key)) return false;
      store.set(key, value);
      expirations.set(key, Date.now() + seconds * 1000);
      return true;
    },
    async del(...keys) {
      let count = 0;
      for (const key of keys) {
        cleanup(key);
        if (store.delete(key)) count += 1;
        expirations.delete(key);
      }
      return count;
    },
    async expire(key, seconds) {
      cleanup(key);
      if (!store.has(key)) return 0;
      expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    },
    async rpush(key, ...values) {
      cleanup(key);
      const list = parseList(store.get(key));
      list.push(...values);
      store.set(key, JSON.stringify(list));
      return list.length;
    },
    async lrange(key, start, stop) {
      cleanup(key);
      const list = parseList(store.get(key));
      const normalizedStart = start < 0 ? Math.max(0, list.length + start) : start;
      const normalizedStop = stop < 0 ? list.length + stop : stop;
      return list.slice(normalizedStart, normalizedStop + 1);
    },
    async lindex(key, index) {
      cleanup(key);
      const list = parseList(store.get(key));
      const normalized = index < 0 ? list.length + index : index;
      if (normalized < 0 || normalized >= list.length) return null;
      return list[normalized] ?? null;
    },
    async sadd(key, ...members) {
      cleanup(key);
      const set = parseSet(store.get(key));
      const before = set.size;
      members.forEach((m) => set.add(m));
      store.set(key, JSON.stringify(Array.from(set)));
      return set.size - before;
    },
    async smembers(key) {
      cleanup(key);
      return Array.from(parseSet(store.get(key)));
    },
    async srem(key, ...members) {
      cleanup(key);
      const set = parseSet(store.get(key));
      const before = set.size;
      members.forEach((member) => set.delete(member));
      store.set(key, JSON.stringify(Array.from(set)));
      return before - set.size;
    },
    async ttl(key) {
      cleanup(key);
      if (!store.has(key)) return -2;
      const expiry = expirations.get(key);
      if (!expiry) return -1;
      return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    },
  };
}

const redisUrl = process.env.REDIS_URL?.trim();
if (!redisUrl && process.env.NODE_ENV === "production") {
  throw new Error("REDIS_URL must be configured in production; in-memory sessions are only supported in development");
}

const realRedis =
  redisUrl
    ? globalForRedis.redis ??
      new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        commandTimeout: 2000,
        enableReadyCheck: false,
        enableAutoPipelining: true,
        retryStrategy(times) {
          return Math.min(times * 150, 1500);
        },
      })
    : null;

export const redis: RedisLike =
  realRedis
    ? createRemoteRedis(realRedis)
    : createMemoryRedis();

if (realRedis && process.env.NODE_ENV !== "production") {
  globalForRedis.redis = realRedis;
}

if (realRedis) {
  realRedis.on("error", () => {
    // prevent unhandled redis error events from crashing the process
  });
}
