/**
 * SQLite DDL mirroring packages/db/prisma/schema.prisma (production Postgres).
 * Used only for local development (DATABASE_DRIVER=sqlite).
 * Dates are stored as ISO-8601 strings; booleans as 0/1; Json as TEXT.
 */
export const SQLITE_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Provider (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website TEXT NOT NULL,
  logoUrl TEXT,
  mode TEXT NOT NULL DEFAULT 'DISABLED',
  status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  active INTEGER NOT NULL DEFAULT 0,
  trustScore INTEGER NOT NULL DEFAULT 50,
  isDemo INTEGER NOT NULL DEFAULT 0,
  defaultEnabled INTEGER NOT NULL DEFAULT 0,
  disabledReason TEXT,
  lastSyncAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ProviderAuthorization (
  id TEXT PRIMARY KEY,
  providerId TEXT NOT NULL UNIQUE REFERENCES Provider(id) ON DELETE CASCADE,
  approved INTEGER NOT NULL DEFAULT 0,
  authorizationType TEXT NOT NULL DEFAULT 'MANUAL_IMPORT',
  permittedDomains TEXT NOT NULL DEFAULT '',
  permittedPaths TEXT NOT NULL DEFAULT '',
  permittedFields TEXT NOT NULL DEFAULT '',
  maxRequestsPerMinute INTEGER NOT NULL DEFAULT 60,
  termsReviewedAt TEXT,
  robotsReviewedAt TEXT,
  copyrightDataUseReviewed INTEGER NOT NULL DEFAULT 0,
  contactRecorded INTEGER NOT NULL DEFAULT 0,
  authorizationNotes TEXT,
  sourceAttributionRequired INTEGER NOT NULL DEFAULT 1,
  expiresAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Product (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  modelNumber TEXT,
  variant TEXT,
  storage INTEGER,
  ram INTEGER,
  color TEXT,
  network TEXT,
  slug TEXT NOT NULL UNIQUE,
  imageUrl TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  specifications TEXT NOT NULL DEFAULT '{}',
  matchingConfidence REAL NOT NULL DEFAULT 0,
  matchingMethod TEXT NOT NULL DEFAULT 'UNMATCHED',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Listing (
  id TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  providerId TEXT NOT NULL REFERENCES Provider(id) ON DELETE CASCADE,
  sourceProductId TEXT NOT NULL,
  sourceUrl TEXT NOT NULL,
  affiliateUrl TEXT,
  price INTEGER NOT NULL,
  originalPrice INTEGER,
  discount INTEGER,
  normalizedCondition TEXT NOT NULL DEFAULT 'UNKNOWN',
  sourceCondition TEXT,
  conditionScore INTEGER NOT NULL DEFAULT 40,
  conditionDescription TEXT,
  warrantyMonths INTEGER NOT NULL DEFAULT 0,
  returnDays INTEGER NOT NULL DEFAULT 0,
  batteryHealth INTEGER,
  stockStatus TEXT NOT NULL DEFAULT 'UNKNOWN',
  deliveryEstimate TEXT,
  sellerName TEXT NOT NULL DEFAULT '',
  sellerRating REAL,
  lastCheckedAt TEXT NOT NULL,
  priceUpdatedAt TEXT NOT NULL,
  consecutiveSyncFailures INTEGER NOT NULL DEFAULT 0,
  archivedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_product_stock ON Listing(productId, stockStatus);
CREATE INDEX IF NOT EXISTS idx_listing_provider_source ON Listing(providerId, sourceProductId);
CREATE INDEX IF NOT EXISTS idx_listing_stock ON Listing(stockStatus);

CREATE TABLE IF NOT EXISTS PriceHistoryPoint (
  id TEXT PRIMARY KEY,
  listingId TEXT NOT NULL REFERENCES Listing(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  recordedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_php_listing_time ON PriceHistoryPoint(listingId, recordedAt);

CREATE TABLE IF NOT EXISTS ClickEvent (
  id TEXT PRIMARY KEY,
  clickId TEXT NOT NULL UNIQUE,
  listingId TEXT NOT NULL REFERENCES Listing(id) ON DELETE CASCADE,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  providerId TEXT NOT NULL REFERENCES Provider(id) ON DELETE CASCADE,
  referrer TEXT,
  deviceType TEXT,
  userAgentHash TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_click_provider_time ON ClickEvent(providerId, createdAt);

CREATE TABLE IF NOT EXISTS PriceAlert (
  id TEXT PRIMARY KEY,
  productId TEXT NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  targetPrice INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT NOT NULL,
  triggeredAt TEXT,
  UNIQUE (productId, email)
);

CREATE TABLE IF NOT EXISTS SyncJob (
  id TEXT PRIMARY KEY,
  providerId TEXT NOT NULL REFERENCES Provider(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  mode TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  startedAt TEXT,
  finishedAt TEXT,
  itemsSeen INTEGER NOT NULL DEFAULT 0,
  itemsAdded INTEGER NOT NULL DEFAULT 0,
  itemsUpdated INTEGER NOT NULL DEFAULT 0,
  itemsSkipped INTEGER NOT NULL DEFAULT 0,
  itemsFailed INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_syncjob_provider_time ON SyncJob(providerId, createdAt);

CREATE TABLE IF NOT EXISTS SyncError (
  id TEXT PRIMARY KEY,
  jobId TEXT REFERENCES SyncJob(id) ON DELETE SET NULL,
  providerId TEXT NOT NULL REFERENCES Provider(id) ON DELETE CASCADE,
  errorCode TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_syncerror_provider_time ON SyncError(providerId, createdAt);

CREATE TABLE IF NOT EXISTS SearchQuery (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  resultCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_searchquery_time ON SearchQuery(createdAt);

CREATE TABLE IF NOT EXISTS AdminUser (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  adminUserId TEXT REFERENCES AdminUser(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  details TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auditlog_time ON AuditLog(createdAt);
`;

/** Returns the directory portion of a file: URI database url. */
export function databaseUrlToPath(url: string): string {
  const clean = url.replace(/^file:/, '');
  return clean;
}