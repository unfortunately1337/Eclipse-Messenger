-- Replace legacy login with Mussk external id.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "musskId" TEXT;

-- Preserve existing values to avoid breaking already linked Mussk accounts.
UPDATE "User"
SET "musskId" = "login"
WHERE "musskId" IS NULL
  AND "login" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'User_musskId_key'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX "User_musskId_key" ON "User"("musskId");
  END IF;
END $$;

DROP INDEX IF EXISTS "User_login_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "login";
