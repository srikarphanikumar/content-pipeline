CREATE TYPE "PromotionAssetType" AS ENUM ('LINKEDIN_POST', 'LINKEDIN_FIRST_COMMENT', 'BLUESKY_POST');

CREATE TABLE "PromotionAsset" (
    "id" TEXT NOT NULL,
    "type" "PromotionAssetType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "PromotionAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionAsset_postId_type_key" ON "PromotionAsset"("postId", "type");

ALTER TABLE "PromotionAsset" ADD CONSTRAINT "PromotionAsset_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
