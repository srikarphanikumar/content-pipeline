CREATE TABLE "PlatformConnection" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "providerAccountId" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformConnection_platform_key" ON "PlatformConnection"("platform");
