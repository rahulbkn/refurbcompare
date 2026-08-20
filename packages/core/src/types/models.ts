import type {
  AlertStatus,
  MatchingMethod,
  NormalizedCondition,
  ProviderMode,
  ProviderStatus,
  StockStatus,
  SyncStatus,
} from './enums.js';

export interface Provider {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoUrl: string | null;
  mode: ProviderMode;
  status: ProviderStatus;
  active: boolean;
  trustScore: number;
  isDemo: boolean;
  defaultEnabled: boolean;
  disabledReason: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderAuthorization {
  id: string;
  providerId: string;
  approved: boolean;
  authorizationType: string;
  permittedDomains: string;
  permittedPaths: string;
  permittedFields: string;
  maxRequestsPerMinute: number;
  termsReviewedAt: Date | null;
  robotsReviewedAt: Date | null;
  copyrightDataUseReviewed: boolean;
  contactRecorded: boolean;
  authorizationNotes: string | null;
  sourceAttributionRequired: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  brand: string;
  model: string;
  modelNumber: string | null;
  variant: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  network: string | null;
  slug: string;
  imageUrl: string | null;
  images: string[];
  specifications: Record<string, unknown>;
  matchingConfidence: number;
  matchingMethod: MatchingMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface Listing {
  id: string;
  productId: string;
  providerId: string;
  sourceProductId: string;
  sourceUrl: string;
  affiliateUrl: string | null;
  price: number;
  originalPrice: number | null;
  discount: number | null;
  normalizedCondition: NormalizedCondition;
  sourceCondition: string | null;
  conditionScore: number;
  conditionDescription: string | null;
  warrantyMonths: number;
  returnDays: number;
  batteryHealth: number | null;
  stockStatus: StockStatus;
  deliveryEstimate: string | null;
  sellerName: string;
  sellerRating: number | null;
  lastCheckedAt: Date;
  priceUpdatedAt: Date;
  consecutiveSyncFailures: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceHistoryPoint {
  id: string;
  listingId: string;
  price: number;
  recordedAt: Date;
}

export interface ClickEvent {
  id: string;
  clickId: string;
  listingId: string;
  productId: string;
  providerId: string;
  referrer: string | null;
  deviceType: string | null;
  userAgentHash: string | null;
  createdAt: Date;
}

export interface PriceAlert {
  id: string;
  productId: string;
  email: string;
  targetPrice: number;
  status: AlertStatus;
  createdAt: Date;
  triggeredAt: Date | null;
}

export interface SyncJob {
  id: string;
  providerId: string;
  status: SyncStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  itemsSeen: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsSkipped: number;
  itemsFailed: number;
  mode: ProviderMode;
  source: string;
  errorMessage: string | null;
  createdAt: Date;
}

export interface SyncError {
  id: string;
  jobId: string | null;
  providerId: string;
  errorCode: string;
  message: string;
  context: string | null;
  createdAt: Date;
}

export interface SearchQueryRecord {
  id: string;
  query: string;
  resultCount: number;
  createdAt: Date;
}

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: string;
  adminUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAt: Date;
}

export interface ProviderWithAuthorization extends Provider {
  authorization?: ProviderAuthorization | null;
}

export interface ProductWithBest extends Product {
  bestPrice: number | null;
  bestDiscount: number | null;
  bestRating: number | null;
  bestCondition: NormalizedCondition | null;
  listingCount: number;
}

export interface ListingWithRelations extends Listing {
  product?: Product | null;
  provider?: Provider | null;
}
