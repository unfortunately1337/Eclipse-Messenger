CREATE TABLE "MediaAssetAccess" (
  "mediaAssetId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  CONSTRAINT "MediaAssetAccess_pkey" PRIMARY KEY ("mediaAssetId", "scopeType", "scopeId"),
  CONSTRAINT "MediaAssetAccess_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MediaAssetAccess_scopeType_scopeId_idx" ON "MediaAssetAccess"("scopeType", "scopeId");
