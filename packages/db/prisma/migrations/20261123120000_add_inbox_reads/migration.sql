-- CreateTable
CREATE TABLE "InboxRead" (
    "key" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxRead_pkey" PRIMARY KEY ("key")
);
