ALTER TABLE "ManagedBot" ADD COLUMN "chatSettings" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Conversation" ADD COLUMN "botChatSettings" JSONB;
