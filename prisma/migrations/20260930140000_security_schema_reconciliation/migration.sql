-- Additive reconciliation for installations previously using db push.
-- AlterTable
ALTER TABLE "ChannelSubscriber" ADD COLUMN IF NOT EXISTS     "canAddMembers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canChangeAvatar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canChangeName" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canDeleteForeignMessages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canEditForeignMessages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canGenerateInviteLink" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canManageAdmins" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canPostMessages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "role" TEXT NOT NULL DEFAULT 'member',
ADD COLUMN IF NOT EXISTS     "roleLabel" TEXT;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN IF NOT EXISTS     "wallpaperPosY" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS     "wallpaperUrl" TEXT;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN IF NOT EXISTS     "canGenerateInviteLink" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canManageAdmins" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "canPostMessages" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS     "clientEncrypted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "scopeId" TEXT,
ADD COLUMN IF NOT EXISTS     "scopeType" TEXT NOT NULL DEFAULT 'legacy';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PollVote" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIdx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SecretChat" (
    "id" TEXT NOT NULL,
    "title" TEXT DEFAULT 'Секретный чат',
    "codeword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lifetimeSeconds" INTEGER NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SecretChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SecretChatParticipant" (
    "id" TEXT NOT NULL,
    "secretChatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acceptedSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretChatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SecretChatMessage" (
    "id" TEXT NOT NULL,
    "secretChatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "textEnc" TEXT NOT NULL,
    "fileUrlEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PollVote_messageId_idx" ON "PollVote"("messageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PollVote_userId_idx" ON "PollVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_messageId_userId_key" ON "PollVote"("messageId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecretChat_expiresAt_idx" ON "SecretChat"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecretChatParticipant_userId_idx" ON "SecretChatParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SecretChatParticipant_secretChatId_userId_key" ON "SecretChatParticipant"("secretChatId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecretChatMessage_secretChatId_idx" ON "SecretChatMessage"("secretChatId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecretChatMessage_createdAt_idx" ON "SecretChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaAsset_scopeType_scopeId_idx" ON "MediaAsset"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaAsset_expiresAt_idx" ON "MediaAsset"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Story_authorId_expiresAt_idx" ON "Story"("authorId", "expiresAt");

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecretChatParticipant_secretChatId_fkey' AND conrelid = '"SecretChatParticipant"'::regclass) THEN
 ALTER TABLE "SecretChatParticipant" ADD CONSTRAINT "SecretChatParticipant_secretChatId_fkey" FOREIGN KEY ("secretChatId") REFERENCES "SecretChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecretChatParticipant_userId_fkey' AND conrelid = '"SecretChatParticipant"'::regclass) THEN
 ALTER TABLE "SecretChatParticipant" ADD CONSTRAINT "SecretChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecretChatMessage_secretChatId_fkey' AND conrelid = '"SecretChatMessage"'::regclass) THEN
 ALTER TABLE "SecretChatMessage" ADD CONSTRAINT "SecretChatMessage_secretChatId_fkey" FOREIGN KEY ("secretChatId") REFERENCES "SecretChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecretChatMessage_senderId_fkey' AND conrelid = '"SecretChatMessage"'::regclass) THEN
 ALTER TABLE "SecretChatMessage" ADD CONSTRAINT "SecretChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
 END IF;
END $$;
