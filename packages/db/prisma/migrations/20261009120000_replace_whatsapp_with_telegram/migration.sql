-- WhatsApp/Twilio notifications are replaced by the Telegram bot. The old rows are Twilio
-- send logs only, so they are dropped along with the WHATSAPP channel.
DELETE FROM "NotificationDelivery" WHERE "channel" = 'WHATSAPP';

-- AlterEnum
ALTER TYPE "NotificationChannel" RENAME TO "NotificationChannel_old";
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM');
ALTER TABLE "NotificationDelivery" ALTER COLUMN "channel" TYPE "NotificationChannel" USING ("channel"::text::"NotificationChannel");
DROP TYPE "NotificationChannel_old";

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'APPROVAL_REQUEST';
ALTER TYPE "NotificationKind" ADD VALUE 'TOPIC_OFFER';
ALTER TYPE "NotificationKind" ADD VALUE 'IMPROVE_PROMPT';
ALTER TYPE "NotificationKind" ADD VALUE 'BOT_REPLY';

-- DropIndex
DROP INDEX "NotificationDelivery_messageSid_idx";

-- AlterTable
ALTER TABLE "NotificationDelivery" DROP COLUMN "templateSid";
ALTER TABLE "NotificationDelivery" RENAME COLUMN "messageSid" TO "messageId";
ALTER TABLE "NotificationDelivery" ADD COLUMN "postId" TEXT,
ADD COLUMN "topicId" TEXT;

-- CreateIndex
CREATE INDEX "NotificationDelivery_recipient_messageId_idx" ON "NotificationDelivery"("recipient", "messageId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_postId_idx" ON "NotificationDelivery"("postId");
