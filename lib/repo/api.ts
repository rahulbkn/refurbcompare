// API-backed Repository adapter.
//
// Every method here talks to the RefurbMeter Fastify backend through
// lib/api-client.ts and adapts backend DTOs into the frontend's Repository DTOs
// (lib/repo/types.ts). Pages and components do not change.
//
// Redirects (task: proxy /go to the backend) intentionally go through the
// backend /go route so click tracking happens exactly once, server-side.

import type {
  ListingDto,
  PriceAlertDto,
  PricePointDto,
  ProductDto,
  ProductFilter,
  ProviderSettingDto,
  Repository,
  SyncResult,
  FeedListing,
} from "./types";
import { DEMO_MODE } from "@/lib/validation";
import {
  ApiError,
  fetchDeals,
  fetchPriceHistory,
  fetchProduct,
  fetchProductListings,
  fetchProducts,
  fetchProviders,
  createPriceAlert as apiCreatePriceAlert,
  type ApiListing,
  type ApiProduct,
} from "@/lib/api-client";

const productCache = new Map<string, ProductDto>();
const listingCache = new Map<string, ListingDto>();

function clearCache() {
  productCache.clear();
  listingCache.clear();
}

function titleCase(value: string | null): string | null {
  if (!value) return null;
  const words = value.toLowerCase().replace(/_/g, " ").split(" ");
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const CONDITION_LABELS: Record<string, string | null> = {
  LIKE_NEW: "Like new",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  REFURBISHED: "Refurbished",
  PRE_OWNED: "Pre-owned",
  UNKNOWN: null,
};

function conditionLabel(normalized: string | null): string | null {
  if (!normalized) return null;
  return CONDITION_LABELS[normalized.toUpperCase()] ?? titleCase(normalized);
}

function discountPct(price: number, originalPrice: number | null): number | null {
  if (!originalPrice || originalPrice <= 0 || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 1000) / 10;
}

function emptyProduct(id: string, brand: string, model: string, slug: string): ProductDto {
  return {
    id,
    slug,
    name: model ? `${brand} ${model}`.trim() : brand,
    brand,
    model,
    category: "Refurbished smartphones",
    storage: 0,
    ram: null,
    color: null,
    condition: "Refurbished",
    releaseYear: null,
    imageUrl: null,
    attributes: null,
  };
}

function productFromApi(p: ApiProduct): ProductDto {
  const name = p.model
    ? `${p.brand} ${p.model}`.trim()
    : p.brand;
  const dto: ProductDto = {
    id: p.id,
    slug: p.slug,
    name,
    brand: p.brand,
    model: p.model,
    category: "Refurbished smartphones",
    storage: p.storage ?? 0,
    ram: p.ram ?? null,
    color: p.color ?? null,
    condition: conditionLabel(p.bestCondition) ?? "Refurbished",
    releaseYear: null,
    imageUrl: p.imageUrl ?? null,
    attributes: (p.specifications as ProductDto["attributes"]) ?? null,
  };
  const extended = dto as ProductDto & {
    bestPrice?: number | null;
    bestDiscount?: number | null;
    bestRating?: number | null;
    bestCondition?: string | null;
    listingCount?: number;
  };
  extended.bestPrice = p.bestPrice;
  extended.bestDiscount = p.bestDiscount;
  extended.bestRating = p.bestRating;
  extended.bestCondition = p.bestCondition;
  extended.listingCount = p.listingCount;
  return dto;
}

function productById(id: string): ProductDto | undefined {
  return productCache.get(id);
}

function listingFromApi(l: ApiListing): ListingDto {
  const sellerName = l.provider?.name ?? l.sellerName ?? "Seller";
  const seller = {
    id: l.providerId,
    slug: l.provider?.slug ?? "",
    name: sellerName,
    websiteUrl: null,
    logoUrl: l.provider?.logoUrl ?? null,
    tagline: null,
    rating: l.sellerRating ?? null,
    reviewCount: 0,
    supportsAffiliate: true,
    allowRedirects: true,
  };

  const product = productById(l.productId) ?? emptyProduct(
    l.product?.id ?? l.productId,
    l.product?.brand ?? "Phone",
    l.product?.model ?? "",
    l.product?.slug ?? l.productId,
  );

  const inStock = l.stockStatus === "IN_STOCK";
  const dto: ListingDto = {
    id: l.id,
    productId: l.productId,
    sellerId: l.providerId,
    targetUrl: l.affiliateUrl ?? l.sourceUrl,
    price: l.price,
    originalPrice: l.originalPrice ?? null,
    discountPct: discountPct(l.price, l.originalPrice),
    condition: conditionLabel(l.normalizedCondition),
    storage: product.storage > 0 ? product.storage : null,
    inStock,
    stockStatus: inStock ? "in_stock" : "out",
    sellerRating: l.sellerRating ?? null,
    offerBadge: l.isBestValue ? "Best value" : null,
    // Synthetic/demo listings are flagged by the same gate that drives the
    // banner and robots noindex (NEXT_PUBLIC_DEMO_MODE), so a demo banner and
    // demo-marked listings stay in step. Set DEMO_MODE=false only when the
    // backend serves DATA_MODE=live.
    isDemo: DEMO_MODE,
    fetchedAt: l.lastCheckedAt ?? l.priceUpdatedAt,
    product,
    seller,
  };
  listingCache.set(l.id, dto);
  return dto;
}

function cacheProductFromApi(p: ApiProduct) {
  productCache.set(p.id, productFromApi(p));
}

async function fetchAndCacheProduct(slugOrId: string): Promise<ProductDto> {
  const cached = productCache.get(slugOrId);
  if (cached) return cached;
  const { data } = await fetchProduct(slugOrId);
  cacheProductFromApi(data);
  return productById(data.id) ?? emptyProduct(data.id, data.brand, data.model, data.slug);
}

async function resolveListings(productId: string): Promise<ListingDto[]> {
  const { data } = await fetchProductListings(productId);
  const offers: ListingDto[] = [];
  for (const offer of data.offers) {
    if (offer.product?.id && !productCache.has(offer.product.id)) {
      const { data: full } = await fetchProduct(offer.product.id).then(
        (r) => r,
        () => ({ data: null }),
      );
      if (full) cacheProductFromApi(full);
    }
    offers.push(listingFromApi(offer));
  }
  return offers;
}

function filterQuery(filter?: ProductFilter): Record<string, unknown> {
  return {
    query: filter?.query,
    brand: filter?.brand,
    minPrice: filter?.minPrice,
    maxPrice: filter?.maxPrice,
    sort: filter?.sort,
  };
}

export const apiRepository: Repository = {
  async listProducts(filter) {
    const { data } = await fetchProducts({
      ...filterQuery(filter),
      page: filter?.page ?? 1,
      pageSize: filter?.pageSize ?? filter?.limit ?? 24,
    });
    for (const p of data) cacheProductFromApi(p);
    return data.map((p) => productById(p.id) ?? productFromApi(p));
  },

  async countProducts(filter) {
    const { meta } = await fetchProducts({ ...filterQuery(filter), pageSize: 1 });
    return Number(meta?.total ?? 0);
  },

  async getProductBySlug(slug) {
    try {
      const cached = [...productCache.values()].find((p) => p.slug === slug);
      if (cached) return cached;
      return await fetchAndCacheProduct(slug);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  async listListingsForProduct(productId) {
    return resolveListings(productId);
  },

  async listDeals(limit) {
    const { data } = await fetchDeals(limit ?? 30);
    const deals: ListingDto[] = [];
    for (const offer of data) {
      if (offer.product?.id && !productCache.has(offer.product.id)) {
        try {
          const { data: full } = await fetchProduct(offer.product.id);
          if (full) cacheProductFromApi(full);
        } catch {
          // keep embedded (minimal) product; listingFromApi falls back
        }
      }
      deals.push(listingFromApi(offer));
    }
    return deals;
  },

  async getListingById(id) {
    return listingCache.get(id) ?? null;
  },

  async bestListingForProduct(productId) {
    const listings = await resolveListings(productId);
    const inStock = listings.filter((l) => l.inStock);
    if (inStock.length === 0) return listings[0] ?? null;
    return [...inStock].sort((a, b) => a.price - b.price || (b.sellerRating ?? 0) - (a.sellerRating ?? 0))[0];
  },

  async brandCounts() {
    const { data } = await fetchProducts({ pageSize: 100 });
    const counts = new Map<string, number>();
    for (const p of data) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    return [...counts.entries()].map(([brand, count]) => ({ brand, count }));
  },

  async getPriceHistory(productId, days) {
    const { data } = await fetchPriceHistory(productId, days ?? 90);
    return data.points.map<PricePointDto>((point, index) => ({
      id: `${productId}:${index}`,
      productId,
      sellerId: null,
      price: point.price,
      recordedAt: point.date,
    }));
  },

  async createPriceAlert(input) {
    const { data } = await apiCreatePriceAlert(input);
    return {
      id: data.alert.id,
      productId: data.alert.productId,
      email: data.alert.email,
      targetPrice: data.alert.targetPrice,
      status: data.alert.status.toLowerCase(),
      createdAt: data.alert.createdAt,
    } satisfies PriceAlertDto;
  },

  async listPriceAlerts() {
    // The backend enforces per-product/per-email uniqueness; the app route
    // proxies there directly and no longer lists alerts.
    return [];
  },

  async recordClick() {
    // Click tracking now happens on the backend /go route (proxied by
    // app/go). A separate frontend record would double-count.
    return;
  },

  async getProviderSettings() {
    const { data } = await fetchProviders();
    return data.map<ProviderSettingDto>((p) => ({
      id: p.id,
      provider: p.slug || p.name.toLowerCase(),
      label: p.name,
      sourceType: p.mode === "DISABLED" ? "disabled" : String(p.mode).toLowerCase(),
      enabled: p.integrated,
      lastSyncAt: p.lastSyncAt,
      nextSyncAt: null,
      rowsProcessed: 0,
      disabledReason: p.integrated ? null : p.mode === "DISABLED" ? "Not authorized / not enabled" : null,
    }));
  },

  // Admin/ingest operations moved into the backend API — not reachable from
  // page code. Kept on the interface for compatibility with the shared
  // Repository contract.
  async setProviderEnabled() {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Use the backend admin API to enable providers (PATCH /api/v1/admin/providers/:id).");
  },
  async logSync() {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Sync jobs run in the backend ingestion service.");
  },
  async importListings() {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Feed imports run in the backend ingestion service.");
  },
  async seedDemo() {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Demo seeding runs in the backend (startServices).");
  },
  async isSeeded() {
    return true;
  },
};