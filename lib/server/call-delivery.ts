import { randomUUID } from "node:crypto";
import { redis } from "./redis";
// A short lease permits recovery after a process dies mid-publish. Only a
// completed publish is retained as delivered. Receiver-side IDs handle retries
// after an ambiguous network failure (provider accepted, response was lost).
export async function deliverCallOnce(key: string, publish: () => Promise<void>): Promise<boolean> {
  if (await redis.get(key) === "1") return true;
  const token = randomUUID(), lock = `${key}:lock`;
  if (!await redis.setIfAbsent(lock, token, 15)) return false;
  try {
    if (await redis.get(key) !== "1") {
      await publish();
      await redis.set(key, "1", "EX", 86400);
    }
    return true;
  } finally { await redis.compareAndDelete(lock, token); }
}
