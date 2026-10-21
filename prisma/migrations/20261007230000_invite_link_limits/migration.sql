ALTER TABLE "InviteLink" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "name" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "usageLimit" INTEGER,
ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "type", "groupId", "channelId" ORDER BY "createdAt" DESC, "id") AS position
  FROM "InviteLink" WHERE "revokedAt" IS NULL
) UPDATE "InviteLink" SET "isPrimary" = true FROM ranked WHERE "InviteLink"."id" = ranked."id" AND ranked.position = 1;
CREATE UNIQUE INDEX "InviteLink_active_primary_group" ON "InviteLink" ("groupId") WHERE "isPrimary" AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX "InviteLink_active_primary_channel" ON "InviteLink" ("channelId") WHERE "isPrimary" AND "revokedAt" IS NULL;
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_limits_check" CHECK (("usageLimit" IS NULL OR "usageLimit" > 0) AND "usageCount" >= 0);
