ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Conversation"
SET "type" = 'direct'
WHERE "type" IS NULL OR "type" = '';

CREATE INDEX IF NOT EXISTS "Conversation_type_idx" ON "Conversation"("type");
CREATE INDEX IF NOT EXISTS "Conversation_ownerUserId_idx" ON "Conversation"("ownerUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_ownerUserId_type_key" ON "Conversation"("ownerUserId", "type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Conversation_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "Conversation"
      ADD CONSTRAINT "Conversation_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
