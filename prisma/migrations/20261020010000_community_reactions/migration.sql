ALTER TABLE "Group" ADD COLUMN "reactionMode" TEXT NOT NULL DEFAULT 'all', ADD COLUMN "allowedReactions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Channel" ADD COLUMN "reactionMode" TEXT NOT NULL DEFAULT 'all', ADD COLUMN "allowedReactions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Group" ADD CONSTRAINT "Group_reactionMode_check" CHECK ("reactionMode" IN ('all', 'some', 'none'));
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_reactionMode_check" CHECK ("reactionMode" IN ('all', 'some', 'none'));
