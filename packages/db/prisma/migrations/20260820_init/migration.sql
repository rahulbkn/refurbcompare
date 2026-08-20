-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProviderMode" AS ENUM ('MOCK', 'API', 'FEED', 'AUTHORIZED_CRAWL', 'MANUAL_IMPORT', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('CONNECTED', 'ERROR', 'DISABLED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NormalizedCondition" AS ENUM ('LIKE_NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'REFURBISHED', 'PRE_OWNED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchingMethod" AS ENUM ('EXACT_MODEL_NUMBER', 'BRAND_MODEL_STORAGE', 'BRAND_MODEL_STORAGE_VARIANT', 'FUZZY', 'MANUAL', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'DISABLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "logoUrl" TEXT,
    "mode" "ProviderMode" NOT NULL DEFAULT 'DISABLED',
    "status" "ProviderStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "disabledReason" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAuthorization" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "authorizationType" TEXT NOT NULL,
    "permittedDomains" TEXT NOT NULL DEFAULT '',
    "permittedPaths" TEXT NOT NULL DEFAULT '',
    "permittedFields" TEXT NOT NULL DEFAULT '',
    "maxRequestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "termsReviewedAt" TIMESTAMP(3),
    "robotsReviewedAt" TIMESTAMP(3),
    "copyrightDataUseReviewed" BOOLEAN NOT NULL DEFAULT false,
    "contactRecorded" BOOLEAN NOT NULL DEFAULT false,
    "authorizationNotes" TEXT,
    "sourceAttributionRequired" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelNumber" TEXT,
    "variant" TEXT,
    "storage" INTEGER,
    "ram" INTEGER,
    "color" TEXT,
    "network" TEXT,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "matchingConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchingMethod" "MatchingMethod" NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "price" INTEGER NOT NULL,
    "originalPrice" INTEGER,
    "discount" INTEGER,
    "normalizedCondition" "NormalizedCondition" NOT NULL DEFAULT 'UNKNOWN',
    "sourceCondition" TEXT,
    "conditionScore" INTEGER NOT NULL DEFAULT 40,
    "conditionDescription" TEXT,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "returnDays" INTEGER NOT NULL DEFAULT 0,
    "batteryHealth" INTEGER,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "deliveryEstimate" TEXT,
    "sellerName" TEXT NOT NULL DEFAULT '',
    "sellerRating" DOUBLE PRECISION,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consecutiveSyncFailures" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistoryPoint" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistoryPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" TEXT NOT NULL,
    "clickId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "referrer" TEXT,
    "deviceType" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "targetPrice" INTEGER NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredAt" TIMESTAMP(3),

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "ProviderMode" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "itemsSeen" INTEGER NOT NULL DEFAULT 0,
    "itemsAdded" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "providerId" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE INDEX "Provider_active_idx" ON "Provider"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthorization_providerId_key" ON "ProviderAuthorization"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_model_idx" ON "Product"("model");

-- CreateIndex
CREATE INDEX "Product_brand_model_idx" ON "Product"("brand", "model");

-- CreateIndex
CREATE INDEX "Listing_sourceProductId_idx" ON "Listing"("sourceProductId");

-- CreateIndex
CREATE INDEX "Listing_stockStatus_idx" ON "Listing"("stockStatus");

-- CreateIndex
CREATE INDEX "Listing_productId_stockStatus_idx" ON "Listing"("productId", "stockStatus");

-- CreateIndex
CREATE INDEX "Listing_providerId_sourceProductId_idx" ON "Listing"("providerId", "sourceProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_providerId_sourceProductId_key" ON "Listing"("providerId", "sourceProductId");

-- CreateIndex
CREATE INDEX "PriceHistoryPoint_listingId_recordedAt_idx" ON "PriceHistoryPoint"("listingId", "recordedAt");

-- CreateIndex
CREATE INDEX "PriceHistoryPoint_recordedAt_idx" ON "PriceHistoryPoint"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClickEvent_clickId_key" ON "ClickEvent"("clickId");

-- CreateIndex
CREATE INDEX "ClickEvent_createdAt_idx" ON "ClickEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ClickEvent_providerId_createdAt_idx" ON "ClickEvent"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceAlert_email_idx" ON "PriceAlert"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_productId_email_key" ON "PriceAlert"("productId", "email");

-- CreateIndex
CREATE INDEX "SyncJob_providerId_createdAt_idx" ON "SyncJob"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncError_providerId_createdAt_idx" ON "SyncError"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchQuery_query_idx" ON "SearchQuery"("query");

-- CreateIndex
CREATE INDEX "SearchQuery_createdAt_idx" ON "SearchQuery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ProviderAuthorization" ADD CONSTRAINT "ProviderAuthorization_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistoryPoint" ADD CONSTRAINT "PriceHistoryPoint_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncError" ADD CONSTRAINT "SyncError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncError" ADD CONSTRAINT "SyncError_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

