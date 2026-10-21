ALTER TABLE "GroupMember" ADD COLUMN "canChangeReactions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChannelSubscriber" ADD COLUMN "canChangeReactions" BOOLEAN NOT NULL DEFAULT false;

-- Preserve access for administrators who could manage reactions before it became a separate permission.
UPDATE "GroupMember" SET "canChangeReactions" = true WHERE "role" = 'admin' AND "canChangeName" = true;
UPDATE "ChannelSubscriber" SET "canChangeReactions" = true WHERE "role" = 'admin' AND "canChangeName" = true;
