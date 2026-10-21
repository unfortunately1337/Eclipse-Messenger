CREATE TABLE "StoryLike" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StoryLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryLike_storyId_userId_key" ON "StoryLike"("storyId", "userId");
CREATE INDEX "StoryLike_userId_createdAt_idx" ON "StoryLike"("userId", "createdAt");

ALTER TABLE "StoryLike"
ADD CONSTRAINT "StoryLike_storyId_fkey"
FOREIGN KEY ("storyId") REFERENCES "Story"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryLike"
ADD CONSTRAINT "StoryLike_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
