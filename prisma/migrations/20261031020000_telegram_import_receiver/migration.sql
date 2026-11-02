ALTER TABLE "PackImporterState" ADD COLUMN "telegramAccount" TEXT, ADD COLUMN "telegramLinkedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "PackImporterState_telegramAccount_key" ON "PackImporterState"("telegramAccount");
CREATE TABLE "TelegramImportTicket" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedUpdateId" TEXT,
  CONSTRAINT "TelegramImportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TelegramImportTicket_userId_idx" ON "TelegramImportTicket"("userId");
CREATE INDEX "TelegramImportTicket_expiresAt_idx" ON "TelegramImportTicket"("expiresAt");
CREATE TABLE "TelegramImportUpdate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "payloadEnc" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseId" TEXT,
  "leasedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TelegramImportUpdate_status_leasedUntil_createdAt_idx" ON "TelegramImportUpdate"("status", "leasedUntil", "createdAt");
