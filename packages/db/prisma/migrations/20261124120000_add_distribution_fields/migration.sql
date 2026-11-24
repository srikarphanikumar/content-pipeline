-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "devToTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "linkedInFormat" TEXT;
