-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;
