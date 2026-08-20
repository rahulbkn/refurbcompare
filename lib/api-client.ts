// Typed HTTP client for the RefurbMeter backend API (Fastify).
//
// Only used on the server (Server Components + route handlers). Pages consume
// data through the Repository adapter (lib/repo/api.ts); this module keeps the
// raw fetch + URL building in one place.
//
// Since the Mode A migration (see lib/api-gateway.ts) all requests go through
// the server-side gateway: base URL resolution, timeouts, error envelopes and
// the internal token live there. This file re-exports the client surface so
// existing callers keep working unchanged.

import {
  ApiError,
  API_BASE,
  gatewayGet,
  gatewayPost,
  gatewayRequest,
} from "./api-gateway";

export { ApiError, API_BASE };

export type ApiProduct = {
  id: string;
  brand: string;
  model: string;
  modelNumber?: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  network: string | null;
  slug: string;
  imageUrl: string | null;
  specifications?: Record<string, unknown> | null;
  bestPrice: number | null;
  bestDiscount: number | null;
  bestRating: number | null;
  bestCondition: string | null;
  listingCount: number;
};

/** Backend listing/offer shape (the raw Listing model + computed fields). */
export type ApiListing = {
  id: string;
  productId: string;
  providerId: string;
  sourceUrl: string;
  affiliateUrl: string | null;
  price: number;
  originalPrice: number | null;
  discount?: number | null;
  normalizedCondition: string;
  sellerName: string;
  sellerRating: number | null;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN" | "ARCHIVED" | string;
  lastCheckedAt: string;
  priceUpdatedAt: string;
  archivedAt: string | null;
  product?: {
    id: string;
    brand: string;
    model: string;
    slug: string;
  } | null;
  provider?: {
    id: string;
    name: string;
    slug?: string;
    logoUrl?: string | null;
  } | null;
  isBestValue?: boolean;
};

export type ApiProvider = {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoUrl: string | null;
  mode: string;
  trustScore: number;
  lastSyncAt: string | null;
  integrated: boolean;
};

export type ApiPricePoint = {
  date: string;
  price: number;
};

export type ApiPriceAlert = {
  id: string;
  productId: string;
  email: string;
  targetPrice: number;
  status: string;
  createdAt: string;
};

export function apiGet<T>(path: string, query?: Record<string, unknown>) {
  return gatewayGet<T>(path, query);
}

export function apiPost<T>(path: string, payload: unknown) {
  return gatewayPost<T>(path, payload);
}

export function fetchProducts(query?: Record<string, unknown>) {
  return apiGet<ApiProduct[]>("/api/v1/products", {
    page: 1,
    pageSize: 100,
    ...query,
  });
}

export function fetchProduct(slugOrId: string) {
  return apiGet<ApiProduct>(`/api/v1/products/${encodeURIComponent(slugOrId)}`);
}

export function fetchProductListings(slugOrId: string) {
  return apiGet<{ offers: ApiListing[] }>(
    `/api/v1/products/${encodeURIComponent(slugOrId)}/listings`,
  );
}

export function fetchDeals(pageSize = 30) {
  return apiGet<ApiListing[]>("/api/v1/deals", { pageSize });
}

export function fetchPriceHistory(productId: string, days: number) {
  return apiGet<{
    points: ApiPricePoint[];
    currentBestPrice: number | null;
  }>(`/api/v1/price-history/${encodeURIComponent(productId)}`, { days });
}

export function createPriceAlert(payload: {
  productId: string;
  email: string;
  targetPrice: number;
}) {
  return apiPost<{ alert: ApiPriceAlert; existing: boolean }>(
    "/api/v1/price-alerts",
    payload,
  );
}

export function fetchProviders() {
  return apiGet<ApiProvider[]>("/api/v1/providers");
}

/**
 * Follow an outbound redirect on the backend without following the Location
 * header. Returns the backend decision so the Next.js /go route can proxy it.
 */
export async function proxyGo(
  listingId: string,
  query?: Record<string, string>,
): Promise<{
  status: number;
  location: string | null;
  body: unknown;
  demo: string | null;
}> {
  const result = await gatewayRequest(`/go/${encodeURIComponent(listingId)}`, {
    query,
    redirect: "manual",
  });

  const location = result.headers.get("location");
  if (location) {
    return {
      status: result.status || 302,
      location,
      body: null,
      demo: result.headers.get("x-refurbcompare-demo"),
    };
  }

  let body: unknown = null;
  try {
    body = result.body ? JSON.parse(result.body) : null;
  } catch {
    body = result.body;
  }
  return { status: result.status || 502, location: null, body, demo: null };
}