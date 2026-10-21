CREATE TABLE "UserE2EKey" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "privateKeyBackupEnc" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserE2EKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserE2EKey_userId_publicKey_key" ON "UserE2EKey"("userId", "publicKey");
CREATE INDEX "UserE2EKey_userId_idx" ON "UserE2EKey"("userId");
CREATE INDEX "UserE2EKey_createdAt_idx" ON "UserE2EKey"("createdAt");

ALTER TABLE "UserE2EKey" ADD CONSTRAINT "UserE2EKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
