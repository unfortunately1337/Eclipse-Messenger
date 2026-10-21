-- Existing chats retain their account-key protocol. New clients opt into v2.
ALTER TABLE "SecretChat" ADD COLUMN IF NOT EXISTS "cryptoVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SecretChatParticipant" ADD COLUMN IF NOT EXISTS "deviceKeyId" TEXT;
ALTER TABLE "SecretChatParticipant" ADD COLUMN IF NOT EXISTS "devicePublicKey" TEXT;
ALTER TABLE "SecretChat" ADD CONSTRAINT "SecretChat_cryptoVersion_check" CHECK ("cryptoVersion" IN (1, 2));
ALTER TABLE "SecretChatParticipant" ADD CONSTRAINT "SecretChatParticipant_deviceKey_check" CHECK (
  ("deviceKeyId" IS NULL AND "devicePublicKey" IS NULL) OR
  ("deviceKeyId" IS NOT NULL AND "devicePublicKey" IS NOT NULL AND "acceptedSessionId" IS NOT NULL)
);
