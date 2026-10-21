CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelSubscriber" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelPost" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelPostView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelPostView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Channel_link_key" ON "Channel"("link");
CREATE INDEX "Channel_ownerId_idx" ON "Channel"("ownerId");

CREATE UNIQUE INDEX "ChannelSubscriber_channelId_userId_key" ON "ChannelSubscriber"("channelId", "userId");
CREATE INDEX "ChannelSubscriber_channelId_idx" ON "ChannelSubscriber"("channelId");
CREATE INDEX "ChannelSubscriber_userId_idx" ON "ChannelSubscriber"("userId");

CREATE INDEX "ChannelPost_channelId_createdAt_idx" ON "ChannelPost"("channelId", "createdAt");
CREATE INDEX "ChannelPost_authorId_idx" ON "ChannelPost"("authorId");

CREATE UNIQUE INDEX "ChannelPostView_postId_userId_key" ON "ChannelPostView"("postId", "userId");
CREATE INDEX "ChannelPostView_postId_idx" ON "ChannelPostView"("postId");
CREATE INDEX "ChannelPostView_userId_idx" ON "ChannelPostView"("userId");

ALTER TABLE "Channel"
ADD CONSTRAINT "Channel_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelSubscriber"
ADD CONSTRAINT "ChannelSubscriber_channelId_fkey"
FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelSubscriber"
ADD CONSTRAINT "ChannelSubscriber_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelPost"
ADD CONSTRAINT "ChannelPost_channelId_fkey"
FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelPost"
ADD CONSTRAINT "ChannelPost_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelPostView"
ADD CONSTRAINT "ChannelPostView_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "ChannelPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelPostView"
ADD CONSTRAINT "ChannelPostView_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
