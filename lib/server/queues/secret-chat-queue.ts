import { Queue } from "bullmq";
import "../workers/secret-chat-worker";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const globalForQueue = globalThis as unknown as {
  secretChatQueue?: Queue;
};

export const secretChatQueue =
  globalForQueue.secretChatQueue ??
  new Queue("secret-chats-cleanup", {
    connection: {
      url: redisUrl,
    },
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForQueue.secretChatQueue = secretChatQueue;
}
