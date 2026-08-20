import type { IntegrationType, NormalizedCondition, ProviderMode, ProviderStatus, StockStatus } from './enums.js';

/** Provider-dependent sync configuration (connector wiring). */
export interface SystemProviderConfig {
  providerSlug: string;
  integrationType: IntegrationType;
  mode: ProviderMode;
  enabled: boolean;
  defaultEnabled: boolean;
  disabledReason: string | null;
  baseUrl: string;
  /** Rate limits reverse-engineered from the authorization record + robots.txt. */
  rateLimit: { maxRequestsPerMinute: number; maxRequestsPerSecond: number };
  concurrency: number;
  lastSyncAt: string | null;
  apiConfig?: {
    baseUrl: string;
    endpoint?: string;
    useMock?: boolean;
  };
  feedConfig?: {
    feedUrl: string;
    useMock?: boolean;
  };
  authorization?: ProviderAuthorizationRecord;
  /** Where server-side secrets are loaded from (keys never leave the server). */
  credentials?: {
    apiKeyRef?: string;
    usernameRef?: string;
    passwordRef?: string;
    secretRef?: string;
  };
  health: HealthRecord;
  robotsTxtUrl: string | null;
  termsOfServiceUrl: string | null;
  privacyPolicyUrl: string | null;
  updatedAt: string | null;
}

export interface ProviderAuthorizationRecord {
  approved: boolean;
  authorizationType: 'API' | 'FEED' | 'AUTHORIZED_CRAWL' | 'MANUAL_IMPORT';
  permittedDomains: string;
  permittedPaths: string;
  permittedFields: string;
  maxRequestsPerMinute: number;
  termsReviewedAt: string | null;
  robotsReviewedAt: string | null;
  copyrightDataUseReviewed: boolean;
  contactRecorded: boolean;
  authorizationNotes: string | null;
  sourceAttributionRequired: boolean;
  expiresAt: string | null;
}

export interface HealthRecord {
  status: 'healthy' | 'unhealthy' | 'unknown';
  connected: boolean;
  lastCheckAt: string | null;
  errorMessage: string | null;
  recordsSeen: number;
  latencyMs: number;
  statusCounts: Record<StockStatus, number>;
  lastItemAt: string | null;
  auth: { enabled?: boolean; valid?: boolean; expiry?: string | null };
}

/** A raw item as returned by a provider connector (pre-normalization). */
export interface ProviderProduct {
  sourceProductId: string;
  title: string;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  modelNumber?: string | null;
  storageGB?: number | null;
  ramGB?: number | null;
  color?: string | null;
  network?: string | null;
  price: number; // INR integer
  originalPrice?: number | null;
  currency?: string;
  condition?: string | null;
  warrantyMonths?: number;
  returnDays?: number;
  batteryHealth?: number | null;
  stockStatus?: StockStatus;
  url: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  sellerName?: string;
  sellerRating?: number | null;
  availability?: string;
  lastUpdated?: Date | null;
  extra?: Record<string, unknown>;
}

/** A product after canonical normalization + matching against known products. */
export interface NormalizedProduct {
  productId: string;
  slug: string;
  brand: string;
  model: string;
  modelNumber: string | null;
  storageGB: number | null;
  ramGB: number | null;
  color: string | null;
  variant: string | null;
  network: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  specifications: Record<string, unknown>;
  matchingMethod: string;
  matchingConfidence: number;
  matched: boolean;
  relatedListing: Pick<ProviderProduct, 'price' | 'url' | 'title'> & {
    condition: string | null;
    normalizedCondition: NormalizedCondition;
  };
}

export interface ProviderSyncResultItem {
  listingId: string;
  providerListingId: string;
  productId: string;
  slug: string;
  price: number;
  sourceStatus: string;
  normalizedCondition: NormalizedCondition;
  title: string;
}

export interface ProviderSyncResult {
  providerSlug: string;
  providerName: string;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  recordsSeen: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsSkipped: number;
  itemsFailed: number;
  itemsProcessed: number;
  rawSources: string[];
  errorsLogged: boolean;
  hasNextPage?: string;
  nextPageOffset?: number;
  items?: ProviderSyncResultItem[];
}

export interface ProviderValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HealthCheckInput {
  config: SystemProviderConfig | null;
  connector?: {
    name: string;
    parseResponse: (body: unknown) => {
      sourceProductId: string;
      title: string;
      url: string;
      price?: number;
    };
    request?: { url: string; method: 'GET' | 'POST' };
  };
}

export const DEFAULT_RATE_LIMIT = { maxRequestsPerMinute: 60, maxRequestsPerSecond: 1 };