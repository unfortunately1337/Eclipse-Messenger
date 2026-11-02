ALTER TABLE "ImportedPackItem" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PackImportJob" ADD COLUMN "sourceSnapshot" JSONB;

-- Existing completed artwork stays visible. Interrupted imports remain staged.
UPDATE "ImportedPackItem" AS item
SET "published" = true
FROM "ImportedPack" AS pack
WHERE item."packId" = pack."id" AND pack."ready" = true;
