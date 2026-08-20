import type {
  AdminUser,
  AuditLogEntry,
  ClickEvent,
  Listing,
  ListingWithRelations,
  PriceAlert,
  PriceHistoryPoint,
  Product,
  ProductWithBest,
  Provider,
  ProviderAuthorization,
  ProviderWithAuthorization,
  SearchQueryRecord,
  SyncError,
  SyncJob,
} from '../types/models.js';
import type {
  MatchingMethod,
  NormalizedCondition,
  ProviderMode,
  StockStatus,
  SyncStatus,
} from '../types/enums.js';

export interface ProductFilter {
  query?: string;
  brand?: string;
  model?: string;
  condition?: NormalizedCondition;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'discount_desc' | 'rating_desc' | 'newest';
  inStock?: boolean;
  /** When true, only listings that may surface in DATA_MODE=live are aggregated
   * (non-demo sourceProductId from an active, non-demo provider). */
  liveVisibleOnly?: boolean;
  page: number;
  pageSize: number;
}

export interface UpsertProviderSettingsInput {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoUrl?: string | null;
  trustScore: number;
  lastSyncAt?: Date | null;
}

export interface UpsertProductInput {
  id: string;
  brand: string;
  model: string;
  modelNumber?: string | null;
  variant?: string | null;
  storage?: number | null;
  ram?: number | null;
  color?: string | null;
  network?: string | null;
  slug: string;
  imageUrl?: string | null;
  images?: string[];
  specifications?: Record<string, unknown>;
  matchingConfidence: number;
  matchingMethod: MatchingMethod;
}

export interface UpsertListingInput {
  id: string;
  productId: string;
  providerId: string;
  sourceProductId: string;
  sourceUrl: string;
  affiliateUrl?: string | null;
  price: number;
  originalPrice?: number | null;
  discount?: number | null;
  normalizedCondition: NormalizedCondition;
  sourceCondition?: string | null;
  conditionScore: number;
  conditionDescription?: string | null;
  warrantyMonths: number;
  returnDays: number;
  batteryHealth?: number | null;
  stockStatus: StockStatus;
  deliveryEstimate?: string | null;
  sellerName?: string;
  sellerRating?: number | null;
  lastCheckedAt: Date;
  priceUpdatedAt: Date;
}

export type UpsertListingResult = {
  status: 'added' | 'updated' | 'skipped';
  listing: Listing;
  priceChanged: boolean;
  wasOutOfStock: boolean;
};

export interface ClickFilter {
  providerId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface ClickRow extends ClickEvent {
  productSlug: string;
  providerName: string;
  listingPrice: number | null;
}

export interface StaleListing {
  id: string;
  providerId: string;
  sourceProductId: string;
  consecutiveSyncFailures: number;
}

export interface Repository {
  readonly driver: 'prisma' | 'sqlite';

  init(): Promise<void>;

  // --- products ---
  listProducts(filter: ProductFilter): Promise<{ items: ProductWithBest[]; total: number }>;
  getProductBySlug(slug: string, opts?: { liveVisibleOnly?: boolean }): Promise<ProductWithBest | null>;
  getProductById(id: string, opts?: { liveVisibleOnly?: boolean }): Promise<ProductWithBest | null>;
  listProductsForSync(): Promise<Pick<Product, 'id' | 'brand' | 'model' | 'modelNumber' | 'storage' | 'ram' | 'color' | 'variant'>[]>;
  upsertProduct(input: UpsertProductInput): Promise<Product>;
  updateProduct(id: string, patch: Partial<UpsertProductInput>): Promise<Product | null>;
  brandCounts(): Promise<Array<{ brand: string; count: number }>>;

  // --- listings ---
  listListingsForProduct(productId: string, includeArchived?: boolean): Promise<ListingWithRelations[]>;
  listActiveListings(): Promise<ListingWithRelations[]>;
  getListingById(id: string): Promise<ListingWithRelations | null>;
  upsertListing(input: UpsertListingInput): Promise<UpsertListingResult>;
  updateListing(
    id: string,
    patch: Partial<Omit<UpsertListingInput, 'id'>>,
  ): Promise<Listing | null>;
  archiveListing(id: string): Promise<Listing | null>;
  markStaleListings(opts: { maxFailures: number; limit: number }): Promise<StaleListing[]>;
  archiveDemoListings(): Promise<number>;

  // --- price history ---
  getPriceHistory(productId: string, days: number): Promise<Array<{ date: string; price: number }>>;
  recordPricePoint(listingId: string, price: number, at?: Date): Promise<PriceHistoryPoint>;
  purgeOldPriceHistory(before: Date): Promise<number>;

  // --- providers ---
  listProviders(): Promise<ProviderWithAuthorization[]>;
  getProviderBySlug(slug: string): Promise<ProviderWithAuthorization | null>;
  getProviderById(id: string): Promise<ProviderWithAuthorization | null>;
  getProviderAuthorization(providerId: string): Promise<ProviderAuthorization | null>;
  upsertProviderSettings(input: UpsertProviderSettingsInput): Promise<Provider>;
  updateProviderSettings(id: string, patch: Partial<UpsertProviderSettingsInput>): Promise<Provider | null>;
  setProviderEnabled(
    id: string,
    opts: { enabled: boolean; disabledReason?: string | null; mode?: Provider['mode'] },
  ): Promise<Provider>;
  upsertProviderAuthorization(input: Partial<ProviderAuthorization> & { providerId: string }): Promise<ProviderAuthorization>;

  // --- alerts ---
  createPriceAlert(input: { productId: string; email: string; targetPrice: number }): Promise<PriceAlert>;
  getPriceAlertByProductAndEmail(productId: string, email: string): Promise<PriceAlert | null>;
  listActiveAlerts(): Promise<PriceAlert[]>;
  setAlertStatus(id: string, status: PriceAlert['status']): Promise<PriceAlert | null>;

  // --- analytics / clicks ---
  recordClick(input: {
    clickId: string;
    listingId: string;
    productId: string;
    providerId: string;
    referrer?: string | null;
    deviceType?: string | null;
    userAgentHash?: string | null;
  }): Promise<void>;
  listClicks(filter: ClickFilter): Promise<{ items: ClickRow[]; total: number }>;
  countClicksByProvider(opts: { from: Date; to: Date }): Promise<Array<{ providerId: string; count: number }>>;

  // --- sync jobs ---
  createSyncJob(input: {
    providerId: string;
    mode: ProviderMode;
    source: string;
  }): Promise<SyncJob>;
  updateSyncJob(
    id: string,
    patch: Partial<Pick<SyncJob, 'status' | 'finishedAt' | 'itemsSeen' | 'itemsAdded' | 'itemsUpdated' | 'itemsSkipped' | 'itemsFailed' | 'errorMessage'>>,
  ): Promise<SyncJob | null>;
  getSyncJob(id: string): Promise<SyncJob | null>;
  listRecentSyncJobs(limit: number): Promise<SyncJob[]>;
  logSyncError(input: { jobId: string | null; providerId: string; errorCode: string; message: string; context?: string | null }): Promise<SyncError>;
  listSyncErrors(opts: { providerId?: string; limit: number }): Promise<SyncError[]>;

  // --- search capture ---
  recordSearchQuery(query: string, resultCount: number): Promise<SearchQueryRecord>;

  // --- admin/ops ---
  createAdminUser(input: { email: string; passwordHash: string; role: AdminUser['role'] }): Promise<AdminUser>;
  getAdminUserByEmail(email: string): Promise<AdminUser | null>;
  logAudit(input: { adminUserId: string | null; action: string; entityType: string; entityId: string; details?: string | null }): Promise<AuditLogEntry>;
}

export const isUniqueViolation = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('unique') ||
    msg.includes('duplicate') ||
    msg.includes('constraint failed') ||
    msg.includes('23505')
  );
};