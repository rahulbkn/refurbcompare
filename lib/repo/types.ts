// Repository DTOs. These are the plain data shapes the rest of the app
// consumes. Both the sqlite driver (dev sandbox) and the Prisma driver
// (production Postgres) adapt their rows into these shapes.

export type ProductDto = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  storage: number;
  ram: number | null;
  color: string | null;
  condition: string;
  releaseYear: number | null;
  imageUrl: string | null;
  attributes: Record<string, string | number | boolean> | null;
};

export type SellerDto = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  tagline: string | null;
  rating: number | null;
  reviewCount: number;
  supportsAffiliate: boolean;
  allowRedirects: boolean;
};

export type ListingDto = {
  id: string;
  productId: string;
  sellerId: string;
  targetUrl: string;
  price: number;
  originalPrice: number | null;
  discountPct: number | null;
  condition: string | null;
  storage: number | null;
  inStock: boolean;
  stockStatus: "in_stock" | "low" | "out";
  sellerRating: number | null;
  offerBadge: string | null;
  isDemo: boolean;
  fetchedAt: string;
  product?: ProductDto;
  seller?: SellerDto;
};

export type PricePointDto = {
  id: string;
  productId: string;
  sellerId: string | null;
  price: number;
  recordedAt: string;
  sellerName?: string;
};

export type PriceAlertDto = {
  id: string;
  productId: string;
  email: string;
  targetPrice: number;
  status: string;
  createdAt: string;
};

export type ProviderSettingDto = {
  id: string;
  provider: string;
  label: string;
  sourceType: string;
  enabled: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  rowsProcessed: number;
  disabledReason: string | null;
};

export type SyncResult = {
  provider: string;
  status: "succeeded" | "failed";
  rowsAdded: number;
  rowsUpdated: number;
  errorMessage?: string | null;
};

/** A single offer coming from a provider feed (mock or future affiliate feed). */
export type FeedListing = {
  sellerSlug: string;
  productSlug: string;
  targetUrl: string;
  price: number;
  originalPrice: number | null;
  discountPct: number | null;
  condition: string | null;
  storage: number | null;
  inStock: boolean;
  stockStatus: "in_stock" | "low" | "out";
  offerBadge: string | null;
};

export type ProductFilter = {
  query?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "discount_desc" | "rating_desc" | "newest";
  limit?: number;
};

export type Repository = {
  listProducts(filter?: ProductFilter): Promise<ProductDto[]>;
  countProducts(filter?: ProductFilter): Promise<number>;
  getProductBySlug(slug: string): Promise<ProductDto | null>;
  listListingsForProduct(productId: string): Promise<ListingDto[]>;
  listDeals(limit?: number): Promise<ListingDto[]>;
  getListingById(id: string): Promise<ListingDto | null>;
  bestListingForProduct(productId: string): Promise<ListingDto | null>;
  brandCounts(): Promise<Array<{ brand: string; count: number }>>;
  getPriceHistory(
    productId: string,
    days?: number,
  ): Promise<PricePointDto[]>;
  createPriceAlert(data: {
    productId: string;
    email: string;
    targetPrice: number;
  }): Promise<PriceAlertDto>;
  listPriceAlerts(email?: string): Promise<PriceAlertDto[]>;
  recordClick(data: {
    listingId: string;
    userAgent: string | null;
    referer: string | null;
  }): Promise<void>;
  getProviderSettings(): Promise<ProviderSettingDto[]>;
  setProviderEnabled(provider: string, enabled: boolean): Promise<void>;
  logSync(result: SyncResult): Promise<void>;
  importListings(
    listings: FeedListing[],
  ): Promise<{ added: number; updated: number }>;
  // demo bootstrap
  seedDemo(): Promise<void>;
  isSeeded(): Promise<boolean>;
};

export const DEMO_ATTRIBUTES: Record<
  string,
  Record<string, string | number | boolean>
> = {};