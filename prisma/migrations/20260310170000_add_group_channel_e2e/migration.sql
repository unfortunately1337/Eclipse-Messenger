ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "text" TEXT;
ALTER TABLE "GroupMessage" ALTER COLUMN "text" DROP NOT NULL;
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "cipherText" TEXT;
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "iv" TEXT;
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "keyVersion" INTEGER;

ALTER TABLE "ChannelPost" ADD COLUMN IF NOT EXISTS "text" TEXT;
ALTER TABLE "ChannelPost" ALTER COLUMN "text" DROP NOT NULL;
ALTER TABLE "ChannelPost" ADD COLUMN IF NOT EXISTS "cipherText" TEXT;
ALTER TABLE "ChannelPost" ADD COLUMN IF NOT EXISTS "iv" TEXT;
ALTER TABLE "ChannelPost" ADD COLUMN IF NOT EXISTS "keyVersion" INTEGER;

CREATE TABLE "GroupE2EKey" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupE2EKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupE2EKeyMember" (
  "id" TEXT NOT NULL,
  "groupKeyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupE2EKeyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelE2EKey" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelE2EKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelE2EKeyMember" (
  "id" TEXT NOT NULL,
  "channelKeyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelE2EKeyMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupE2EKey_groupId_version_key" ON "GroupE2EKey"("groupId", "version");
CREATE INDEX "GroupE2EKey_groupId_idx" ON "GroupE2EKey"("groupId");

CREATE UNIQUE INDEX "GroupE2EKeyMember_groupKeyId_userId_key" ON "GroupE2EKeyMember"("groupKeyId", "userId");
CREATE INDEX "GroupE2EKeyMember_groupKeyId_idx" ON "GroupE2EKeyMember"("groupKeyId");
CREATE INDEX "GroupE2EKeyMember_userId_idx" ON "GroupE2EKeyMember"("userId");

CREATE UNIQUE INDEX "ChannelE2EKey_channelId_version_key" ON "ChannelE2EKey"("channelId", "version");
CREATE INDEX "ChannelE2EKey_channelId_idx" ON "ChannelE2EKey"("channelId");

CREATE UNIQUE INDEX "ChannelE2EKeyMember_channelKeyId_userId_key" ON "ChannelE2EKeyMember"("channelKeyId", "userId");
CREATE INDEX "ChannelE2EKeyMember_channelKeyId_idx" ON "ChannelE2EKeyMember"("channelKeyId");
CREATE INDEX "ChannelE2EKeyMember_userId_idx" ON "ChannelE2EKeyMember"("userId");

ALTER TABLE "GroupE2EKey" ADD CONSTRAINT "GroupE2EKey_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupE2EKey" ADD CONSTRAINT "GroupE2EKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupE2EKeyMember" ADD CONSTRAINT "GroupE2EKeyMember_groupKeyId_fkey" FOREIGN KEY ("groupKeyId") REFERENCES "GroupE2EKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupE2EKeyMember" ADD CONSTRAINT "GroupE2EKeyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelE2EKey" ADD CONSTRAINT "ChannelE2EKey_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelE2EKey" ADD CONSTRAINT "ChannelE2EKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelE2EKeyMember" ADD CONSTRAINT "ChannelE2EKeyMember_channelKeyId_fkey" FOREIGN KEY ("channelKeyId") REFERENCES "ChannelE2EKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelE2EKeyMember" ADD CONSTRAINT "ChannelE2EKeyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
