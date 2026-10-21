ALTER TABLE "GroupMember" ADD COLUMN "canPinMessages" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChannelSubscriber" ADD COLUMN "canPinMessages" BOOLEAN NOT NULL DEFAULT false;

-- Existing administrators retain pin access; newly assigned roles require an explicit grant.
UPDATE "GroupMember" SET "canPinMessages" = true WHERE "role" = 'admin';
UPDATE "ChannelSubscriber" SET "canPinMessages" = true WHERE "role" = 'admin';
