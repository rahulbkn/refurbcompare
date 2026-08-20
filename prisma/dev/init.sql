-- RefurbCompare dev database DDL for the node:sqlite driver (Android/Termux sandbox).
-- Mirrors prisma/schema.prisma. Executed by scripts/bootstrap-dev-db.mjs.
-- All money stored as INTEGER INR (whole rupees). JSON columns stored as TEXT.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Product" (
  "id"          TEXT PRIMARY KEY,
  "slug"        TEXT NOT NULL UNIQUE,
  "name"        TEXT NOT NULL,
  "brand"       TEXT NOT NULL,
  "model"       TEXT NOT NULL,
  "category"    TEXT NOT NULL DEFAULT 'smartphone',
  "storage"     INTEGER NOT NULL,
  "ram"         INTEGER,
  "color"       TEXT,
  "condition"   TEXT NOT NULL,
  "releaseYear" INTEGER,
  "imageUrl"    TEXT,
  "attributes"  TEXT,
  "createdAt"   TEXT NOT NULL,
  "updatedAt"   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Product_brand_idx" ON "Product"("brand");
CREATE INDEX IF NOT EXISTS "Product_brand_storage_idx" ON "Product"("brand", "storage");

CREATE TABLE IF NOT EXISTS "Seller" (
  "id"                TEXT PRIMARY KEY,
  "slug"              TEXT NOT NULL UNIQUE,
  "name"              TEXT NOT NULL,
  "websiteUrl"        TEXT NOT NULL,
  "logoUrl"           TEXT,
  "tagline"           TEXT,
  "rating"            REAL,
  "reviewCount"       INTEGER NOT NULL DEFAULT 0,
  "supportsAffiliate" INTEGER NOT NULL DEFAULT 0,
  "allowRedirects"    INTEGER NOT NULL DEFAULT 1,
  "createdAt"         TEXT NOT NULL,
  "updatedAt"         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "ProviderSetting" (
  "id"             TEXT PRIMARY KEY,
  "provider"       TEXT NOT NULL UNIQUE,
  "label"          TEXT NOT NULL,
  "sourceType"     TEXT NOT NULL DEFAULT 'mock',
  "enabled"        INTEGER NOT NULL DEFAULT 0,
  "config"         TEXT,
  "lastSyncAt"     TEXT,
  "nextSyncAt"     TEXT,
  "rowsProcessed"  INTEGER NOT NULL DEFAULT 0,
  "disabledReason" TEXT,
  "createdAt"      TEXT NOT NULL,
  "updatedAt"      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Listing" (
  "id"            TEXT PRIMARY KEY,
  "productId"     TEXT NOT NULL,
  "sellerId"      TEXT NOT NULL,
  "targetUrl"     TEXT NOT NULL,
  "price"         INTEGER NOT NULL,
  "originalPrice" INTEGER,
  "discountPct"   REAL,
  "condition"     TEXT,
  "storage"       INTEGER,
  "inStock"       INTEGER NOT NULL DEFAULT 1,
  "stockStatus"   TEXT NOT NULL DEFAULT 'in_stock',
  "sellerRating"  REAL,
  "offerBadge"    TEXT,
  "isDemo"        INTEGER NOT NULL DEFAULT 0,
  "fetchedAt"     TEXT NOT NULL,
  "createdAt"     TEXT NOT NULL,
  "updatedAt"     TEXT NOT NULL,
  UNIQUE("productId", "sellerId"),
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Listing_productId_idx" ON "Listing"("productId");
CREATE INDEX IF NOT EXISTS "Listing_sellerId_idx" ON "Listing"("sellerId");
CREATE INDEX IF NOT EXISTS "Listing_price_idx" ON "Listing"("price");

CREATE TABLE IF NOT EXISTS "PriceHistoryPoint" (
  "id"         TEXT PRIMARY KEY,
  "productId"  TEXT NOT NULL,
  "sellerId"   TEXT NOT NULL,
  "listingId"  TEXT,
  "price"      INTEGER NOT NULL,
  "recordedAt" TEXT NOT NULL,
  "source"     TEXT NOT NULL DEFAULT 'seed',
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE,
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "PriceHistoryPoint_productId_recordedAt_idx" ON "PriceHistoryPoint"("productId", "recordedAt");
CREATE INDEX IF NOT EXISTS "PriceHistoryPoint_productId_sellerId_idx" ON "PriceHistoryPoint"("productId", "sellerId");

CREATE TABLE IF NOT EXISTS "PriceAlert" (
  "id"          TEXT PRIMARY KEY,
  "productId"   TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "targetPrice" INTEGER NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'active',
  "createdAt"   TEXT NOT NULL,
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "PriceAlert_productId_idx" ON "PriceAlert"("productId");
CREATE INDEX IF NOT EXISTS "PriceAlert_email_idx" ON "PriceAlert"("email");

CREATE TABLE IF NOT EXISTS "Click" (
  "id"        TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL,
  "userAgent" TEXT,
  "referer"   TEXT,
  "createdAt" TEXT NOT NULL,
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Click_listingId_idx" ON "Click"("listingId");
CREATE INDEX IF NOT EXISTS "Click_createdAt_idx" ON "Click"("createdAt");

CREATE TABLE IF NOT EXISTS "SyncLog" (
  "id"           TEXT PRIMARY KEY,
  "provider"     TEXT NOT NULL,
  "status"       TEXT NOT NULL,
  "startedAt"    TEXT NOT NULL,
  "finishedAt"   TEXT,
  "errorMessage" TEXT,
  "rowsAdded"    INTEGER NOT NULL DEFAULT 0,
  "rowsUpdated"  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "SyncLog_provider_startedAt_idx" ON "SyncLog"("provider", "startedAt");