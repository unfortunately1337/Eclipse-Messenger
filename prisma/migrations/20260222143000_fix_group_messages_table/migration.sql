-- Repair migration for environments where 20260222130000_add_group_messages
-- was marked as applied but not executed.

CREATE TABLE IF NOT EXISTS "GroupMessage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx"
ON "GroupMessage"("groupId", "createdAt");

CREATE INDEX IF NOT EXISTS "GroupMessage_senderId_idx"
ON "GroupMessage"("senderId");
