-- Replace SoundCloud profile music with uploaded audio file
ALTER TABLE "User" DROP COLUMN IF EXISTS "soundcloudUrl";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "musicUrl" TEXT;
