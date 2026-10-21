ALTER TABLE "GroupMember"
  ADD COLUMN IF NOT EXISTS "roleLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "canChangeAvatar" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canChangeName" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canDeleteForeignMessages" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canAddMembers" BOOLEAN NOT NULL DEFAULT false;

UPDATE "GroupMember"
SET
  "canChangeAvatar" = true,
  "canChangeName" = true,
  "canDeleteForeignMessages" = true,
  "canAddMembers" = true
WHERE "role" IN ('owner', 'admin');
