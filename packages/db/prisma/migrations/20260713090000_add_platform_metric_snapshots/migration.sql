-- CreateTable
CREATE TABLE "PlatformMetricSnapshot" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicationId" TEXT NOT NULL,

    CONSTRAINT "PlatformMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformMetricSnapshot_platform_capturedAt_idx" ON "PlatformMetricSnapshot"("platform", "capturedAt");

-- CreateIndex
CREATE INDEX "PlatformMetricSnapshot_publicationId_capturedAt_idx" ON "PlatformMetricSnapshot"("publicationId", "capturedAt");

-- CreateIndex
CREATE INDEX "PlatformMetricSnapshot_metricName_capturedAt_idx" ON "PlatformMetricSnapshot"("metricName", "capturedAt");

-- AddForeignKey
ALTER TABLE "PlatformMetricSnapshot" ADD CONSTRAINT "PlatformMetricSnapshot_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "PlatformPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
