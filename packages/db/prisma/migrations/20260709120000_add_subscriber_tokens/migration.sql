ALTER TABLE "Subscriber"
ADD COLUMN "confirmationToken" TEXT,
ADD COLUMN "unsubscribeToken" TEXT,
ADD COLUMN "lastEmailSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Subscriber_confirmationToken_key" ON "Subscriber"("confirmationToken");
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");
