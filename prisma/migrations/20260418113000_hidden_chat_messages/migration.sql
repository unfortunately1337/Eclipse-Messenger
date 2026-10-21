CREATE TABLE "HiddenChatMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chatType" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HiddenChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HiddenChatMessage_userId_chatType_messageId_key"
ON "HiddenChatMessage"("userId", "chatType", "messageId");

CREATE INDEX "HiddenChatMessage_userId_chatType_createdAt_idx"
ON "HiddenChatMessage"("userId", "chatType", "createdAt");

CREATE INDEX "HiddenChatMessage_messageId_idx"
ON "HiddenChatMessage"("messageId");

ALTER TABLE "HiddenChatMessage"
ADD CONSTRAINT "HiddenChatMessage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
