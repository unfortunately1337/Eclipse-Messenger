import { redis } from "./redis";

const VIEW_TTL_SECONDS = 20;
const indexKey = (userId: string) => `notifications:views:v1:${userId}`;
const slotKey = (userId: string, slot: string) => `notifications:view:v1:${userId}:${slot}`;

/** Private delivery state, independent of public online status and read receipts. */
export async function setNotificationView(userId: string, sessionId: string, tabId: string, chatId: string | null) {
  const slot = `${sessionId}:${tabId}`;
  const key = slotKey(userId, slot);
  const chat = chatId?.trim().toLowerCase();
  if (!chat) {
    await redis.del(key);
    await redis.srem(indexKey(userId), slot);
    return;
  }
  await redis.set(key, chat, "EX", VIEW_TTL_SECONDS);
  await redis.sadd(indexKey(userId), slot);
  await redis.expire(indexKey(userId), VIEW_TTL_SECONDS * 3);
}

export async function isNotificationChatVisible(userId: string, chatId: string): Promise<boolean> {
  const slots = await redis.smembers(indexKey(userId));
  if (!slots.length) return false;
  const chats = await redis.mget(...slots.map(slot => slotKey(userId, slot)));
  const expired = slots.filter((_, index) => !chats[index]);
  if (expired.length) await redis.srem(indexKey(userId), ...expired);
  return chats.includes(chatId.trim().toLowerCase());
}
