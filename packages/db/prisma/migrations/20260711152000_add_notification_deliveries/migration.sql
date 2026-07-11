-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('MORNING_SUMMARY', 'NIGHTLY_STATS', 'TEST');

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "recipient" TEXT NOT NULL,
    "templateSid" TEXT,
    "messageSid" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "bodyPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_createdAt_idx" ON "NotificationDelivery"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_messageSid_idx" ON "NotificationDelivery"("messageSid");
