ALTER TABLE "Message" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "GroupMessage" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "ChannelPost" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "SecretChatMessage" ADD COLUMN "pinnedAt" TIMESTAMP(3);
CREATE INDEX "Message_conversationId_pinnedAt_idx" ON "Message"("conversationId", "pinnedAt");
CREATE INDEX "GroupMessage_groupId_pinnedAt_idx" ON "GroupMessage"("groupId", "pinnedAt");
CREATE INDEX "ChannelPost_channelId_pinnedAt_idx" ON "ChannelPost"("channelId", "pinnedAt");
CREATE INDEX "SecretChatMessage_secretChatId_pinnedAt_idx" ON "SecretChatMessage"("secretChatId", "pinnedAt");
