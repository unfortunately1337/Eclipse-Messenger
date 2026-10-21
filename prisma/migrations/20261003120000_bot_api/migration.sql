ALTER TABLE "ManagedBot" ADD COLUMN "nextUpdateId" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "commands" JSONB NOT NULL DEFAULT '[]',
 ADD COLUMN "webhookUrlEnc" TEXT, ADD COLUMN "webhookSecretEnc" TEXT,
 ADD COLUMN "webhookVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "legacyUpdatesImported" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "botContentEnc" TEXT;
CREATE TABLE "BotUpdate" (
 "id" TEXT NOT NULL PRIMARY KEY, "botId" TEXT NOT NULL,
 "updateId" INTEGER NOT NULL, "dedupKey" TEXT NOT NULL, "payloadEnc" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "acknowledgedAt" TIMESTAMP(3),
 "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedUntil" TIMESTAMP(3), "lastError" TEXT,
 CONSTRAINT "BotUpdate_botId_fkey" FOREIGN KEY ("botId") REFERENCES "ManagedBot"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BotUpdate_botId_updateId_key" ON "BotUpdate"("botId", "updateId");
CREATE UNIQUE INDEX "BotUpdate_botId_dedupKey_key" ON "BotUpdate"("botId", "dedupKey");
CREATE INDEX "BotUpdate_botId_acknowledgedAt_updateId_idx" ON "BotUpdate"("botId", "acknowledgedAt", "updateId");
CREATE INDEX "BotUpdate_expiresAt_idx" ON "BotUpdate"("expiresAt");
