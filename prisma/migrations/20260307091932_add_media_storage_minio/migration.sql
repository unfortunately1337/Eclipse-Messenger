-- Add MinIO metadata columns
ALTER TABLE "MediaAsset" ADD COLUMN "objectKey" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "bucket" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "etag" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE "MediaAsset" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "MediaAsset_objectKey_idx" ON "MediaAsset"("objectKey");
CREATE UNIQUE INDEX "MediaAsset_bucket_objectKey_key" ON "MediaAsset"("bucket", "objectKey");