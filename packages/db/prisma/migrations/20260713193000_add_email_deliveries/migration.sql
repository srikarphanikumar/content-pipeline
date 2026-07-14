-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('NEWSLETTER_POST', 'TEST');

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "recipient" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "bodyPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postId" TEXT,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDelivery_kind_createdAt_idx" ON "EmailDelivery"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_postId_kind_idx" ON "EmailDelivery"("postId", "kind");

-- CreateIndex
CREATE INDEX "EmailDelivery_providerMessageId_idx" ON "EmailDelivery"("providerMessageId");

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
