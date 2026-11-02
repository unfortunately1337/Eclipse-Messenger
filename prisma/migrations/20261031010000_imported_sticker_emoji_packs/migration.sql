CREATE TABLE "ImportedPack" (
  "id" TEXT NOT NULL, "sourceName" TEXT NOT NULL, "title" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "count" INTEGER NOT NULL, "ready" BOOLEAN NOT NULL DEFAULT false, "sourceSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportedPack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImportedPack_sourceName_key" ON "ImportedPack"("sourceName");
CREATE TABLE "ImportedPackItem" (
  "id" TEXT NOT NULL, "packId" TEXT NOT NULL, "sourceUniqueId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL,
  "emoji" TEXT NOT NULL, "format" TEXT NOT NULL, "adaptive" BOOLEAN NOT NULL DEFAULT false, "bucket" TEXT NOT NULL, "objectKey" TEXT NOT NULL, "thumbnailKey" TEXT NOT NULL,
  CONSTRAINT "ImportedPackItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportedPackItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ImportedPack"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImportedPackItem_packId_sourceUniqueId_key" ON "ImportedPackItem"("packId", "sourceUniqueId");
CREATE INDEX "ImportedPackItem_packId_ordinal_idx" ON "ImportedPackItem"("packId", "ordinal");
CREATE TABLE "UserImportedPack" (
  "userId" TEXT NOT NULL, "packId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserImportedPack_pkey" PRIMARY KEY ("userId", "packId"),
  CONSTRAINT "UserImportedPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserImportedPack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ImportedPack"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserImportedPack_userId_createdAt_idx" ON "UserImportedPack"("userId", "createdAt");
CREATE TABLE "PackImportJob" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "packId" TEXT NOT NULL, "messageId" TEXT NOT NULL, "conversationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued', "completed" INTEGER NOT NULL DEFAULT 0, "leaseId" TEXT, "leasedUntil" TIMESTAMP(3), "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackImportJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PackImportJob_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ImportedPack"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PackImportJob_messageId_key" ON "PackImportJob"("messageId");
CREATE INDEX "PackImportJob_status_leasedUntil_createdAt_idx" ON "PackImportJob"("status", "leasedUntil", "createdAt");
CREATE INDEX "PackImportJob_userId_packId_idx" ON "PackImportJob"("userId", "packId");
CREATE TABLE "PackImporterState" (
  "userId" TEXT NOT NULL, "kind" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackImporterState_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "PackImporterState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
