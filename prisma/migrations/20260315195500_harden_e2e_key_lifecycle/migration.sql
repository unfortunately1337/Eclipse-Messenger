-- Harden key lifecycle metadata for E2E entities.
-- Source of truth remains PostgreSQL; Redis is cache-only.

ALTER TABLE "UserE2EKey"
  ADD COLUMN IF NOT EXISTS "version" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "algorithm" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

UPDATE "UserE2EKey"
SET "algorithm" = COALESCE("algorithm", 'rsa-oaep-2048-sha256+a256gcm'),
    "status" = COALESCE("status", CASE WHEN COALESCE("isActive", false) THEN 'active' ELSE 'rotated' END);

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "UserE2EKey"
)
UPDATE "UserE2EKey" u
SET "version" = ranked.rn
FROM ranked
WHERE u."id" = ranked."id"
  AND (u."version" IS NULL OR u."version" <= 0);

ALTER TABLE "UserE2EKey"
  ALTER COLUMN "version" SET DEFAULT 1,
  ALTER COLUMN "version" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "algorithm" SET DEFAULT 'rsa-oaep-2048-sha256+a256gcm',
  ALTER COLUMN "algorithm" SET NOT NULL;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "senderKeyId" TEXT,
  ADD COLUMN IF NOT EXISTS "senderKeyVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "recipientKeyId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientKeyVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "encryptionScheme" TEXT;

UPDATE "Message"
SET "encryptionScheme" = COALESCE("encryptionScheme", 'rsa-oaep-2048-sha256+a256gcm');

ALTER TABLE "Message"
  ALTER COLUMN "encryptionScheme" SET DEFAULT 'rsa-oaep-2048-sha256+a256gcm';

ALTER TABLE "GroupE2EKey"
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "algorithm" TEXT,
  ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

UPDATE "GroupE2EKey"
SET "algorithm" = COALESCE("algorithm", 'aes-256-gcm+wrapped-group-key'),
    "status" = COALESCE("status", 'active');

ALTER TABLE "GroupE2EKey"
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "algorithm" SET DEFAULT 'aes-256-gcm+wrapped-group-key',
  ALTER COLUMN "algorithm" SET NOT NULL;

ALTER TABLE "GroupMessage"
  ADD COLUMN IF NOT EXISTS "encryptionScheme" TEXT;

UPDATE "GroupMessage"
SET "encryptionScheme" = COALESCE("encryptionScheme", 'aes-256-gcm+wrapped-group-key');

ALTER TABLE "GroupMessage"
  ALTER COLUMN "encryptionScheme" SET DEFAULT 'aes-256-gcm+wrapped-group-key';

ALTER TABLE "ChannelE2EKey"
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "algorithm" TEXT,
  ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

UPDATE "ChannelE2EKey"
SET "algorithm" = COALESCE("algorithm", 'aes-256-gcm+wrapped-channel-key'),
    "status" = COALESCE("status", 'active');

ALTER TABLE "ChannelE2EKey"
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "algorithm" SET DEFAULT 'aes-256-gcm+wrapped-channel-key',
  ALTER COLUMN "algorithm" SET NOT NULL;

ALTER TABLE "ChannelPost"
  ADD COLUMN IF NOT EXISTS "encryptionScheme" TEXT;

UPDATE "ChannelPost"
SET "encryptionScheme" = COALESCE("encryptionScheme", 'aes-256-gcm+wrapped-channel-key');

ALTER TABLE "ChannelPost"
  ALTER COLUMN "encryptionScheme" SET DEFAULT 'aes-256-gcm+wrapped-channel-key';

CREATE UNIQUE INDEX IF NOT EXISTS "UserE2EKey_userId_version_key" ON "UserE2EKey"("userId", "version");
CREATE INDEX IF NOT EXISTS "UserE2EKey_userId_status_idx" ON "UserE2EKey"("userId", "status");
CREATE INDEX IF NOT EXISTS "GroupE2EKey_groupId_status_idx" ON "GroupE2EKey"("groupId", "status");
CREATE INDEX IF NOT EXISTS "ChannelE2EKey_channelId_status_idx" ON "ChannelE2EKey"("channelId", "status");
