import { randomUUID } from "crypto";
import { redis } from "@/lib/server/redis";

export type StoredFallbackMessage = {
  id: string;
  senderId: string;
  cipherText?: string;
  iv?: string;
  encryptedKeyForSender?: string;
  encryptedKeyForRecipient?: string;
  plainText?: string;
  createdAt: string;
};

function pairKey(userA: string, userB: string) {
  const [a, b] = [userA, userB].sort();
  return `${a}:${b}`;
}

function messagesKey(userA: string, userB: string) {
  return `chat:dm:${pairKey(userA, userB)}:messages`;
}

function peersKey(userId: string) {
  return `chat:user:${userId}:peers`;
}

export async function appendFallbackMessage(params: {
  senderId: string;
  recipientId: string;
  cipherText?: string;
  iv?: string;
  encryptedKeyForSender?: string;
  encryptedKeyForRecipient?: string;
  plainText?: string;
}) {
  const message: StoredFallbackMessage = {
    id: randomUUID(),
    senderId: params.senderId,
    cipherText: params.cipherText,
    iv: params.iv,
    encryptedKeyForSender: params.encryptedKeyForSender,
    encryptedKeyForRecipient: params.encryptedKeyForRecipient,
    plainText: params.plainText,
    createdAt: new Date().toISOString(),
  };

  const key = messagesKey(params.senderId, params.recipientId);
  await redis.rpush(key, JSON.stringify(message));
  await redis.expire(key, 60 * 60 * 24 * 180);
  await redis.sadd(peersKey(params.senderId), params.recipientId);
  await redis.sadd(peersKey(params.recipientId), params.senderId);

  return message;
}

export async function getFallbackMessages(userA: string, userB: string, limit = 150) {
  const key = messagesKey(userA, userB);
  const raw = await redis.lrange(key, -limit, -1);

  return raw
    .map((item) => {
      try {
        return JSON.parse(item) as StoredFallbackMessage;
      } catch {
        return null;
      }
    })
    .filter((item): item is StoredFallbackMessage => item !== null);
}

export async function getFallbackPeerIds(userId: string) {
  return redis.smembers(peersKey(userId));
}

export async function getFallbackLastMessage(userA: string, userB: string) {
  const raw = await redis.lindex(messagesKey(userA, userB), -1);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredFallbackMessage;
  } catch {
    return null;
  }
}

export async function deleteFallbackMessage(params: {
  userA: string;
  userB: string;
  messageId: string;
  senderId: string;
}) {
  const key = messagesKey(params.userA, params.userB);
  const raw = await redis.lrange(key, 0, -1);
  if (!raw.length) {
    return false;
  }

  let removed = false;
  const keep: string[] = [];

  for (const item of raw) {
    try {
      const parsed = JSON.parse(item) as StoredFallbackMessage;
      if (!removed && parsed.id === params.messageId && parsed.senderId === params.senderId) {
        removed = true;
        continue;
      }
    } catch {
      // keep malformed records as-is to avoid accidental data loss
    }
    keep.push(item);
  }

  if (!removed) {
    return false;
  }

  const ttl = await redis.ttl(key);
  await redis.del(key);
  if (keep.length > 0) {
    await redis.rpush(key, ...keep);
    if (ttl > 0) {
      await redis.expire(key, ttl);
    }
  }

  return true;
}
