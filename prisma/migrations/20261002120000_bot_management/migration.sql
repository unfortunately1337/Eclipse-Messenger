CREATE TABLE "ManagedBot" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "tokenHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManagedBot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ManagedBot_profileId_key" ON "ManagedBot"("profileId");
CREATE UNIQUE INDEX "ManagedBot_tokenHash_key" ON "ManagedBot"("tokenHash");
CREATE INDEX "ManagedBot_ownerId_createdAt_idx" ON "ManagedBot"("ownerId", "createdAt");
ALTER TABLE "ManagedBot" ADD CONSTRAINT "ManagedBot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedBot" ADD CONSTRAINT "ManagedBot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BotManagementSession" (
  "ownerId" TEXT NOT NULL,
  "step" TEXT NOT NULL DEFAULT 'root',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "displayName" TEXT,
  "username" TEXT,
  "selectedBotId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotManagementSession_pkey" PRIMARY KEY ("ownerId")
);
ALTER TABLE "BotManagementSession" ADD CONSTRAINT "BotManagementSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BotManagementRequest" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "responseEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotManagementRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BotManagementRequest_ownerId_createdAt_idx" ON "BotManagementRequest"("ownerId", "createdAt");
ALTER TABLE "BotManagementRequest" ADD CONSTRAINT "BotManagementRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
