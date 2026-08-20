import type { NormalizedCondition, ProviderProduct, StockStatus } from '@refurbcompare/core';

export interface DemoProductSpec {
  brand: string;
  model: string;
  modelNumber: string | null;
  variant: string | null;
  storage: number;
  ram: number;
  color: string;
  network: string;
}

/** Canonical demo catalog matching the spec's 10 products. */
export const DEMO_PRODUCTS: DemoProductSpec[] = [
  { brand: 'Apple', model: 'iPhone 13', modelNumber: 'A2633', variant: null, storage: 128, ram: 4, color: 'Midnight', network: '5G' },
  { brand: 'Apple', model: 'iPhone 13', modelNumber: 'A2633', variant: null, storage: 256, ram: 4, color: 'Starlight', network: '5G' },
  { brand: 'Apple', model: 'iPhone 12', modelNumber: 'A2403', variant: null, storage: 128, ram: 4, color: 'Blue', network: '5G' },
  { brand: 'Apple', model: 'iPhone 14', modelNumber: 'A2649', variant: null, storage: 128, ram: 6, color: 'Starlight', network: '5G' },
  { brand: 'Samsung', model: 'Galaxy S22 5G', modelNumber: 'SM-S901E', variant: null, storage: 128, ram: 8, color: 'Phantom Black', network: '5G' },
  { brand: 'Samsung', model: 'Galaxy S23 5G', modelNumber: 'SM-S911B', variant: null, storage: 128, ram: 8, color: 'Phantom Black', network: '5G' },
  { brand: 'OnePlus', model: '11 5G', modelNumber: 'NE2213', variant: null, storage: 128, ram: 8, color: 'Eternal Green', network: '5G' },
  { brand: 'OnePlus', model: '12 5G', modelNumber: 'CPH2573', variant: null, storage: 256, ram: 16, color: 'Flow Emerald', network: '5G' },
  { brand: 'Google', model: 'Pixel 7', modelNumber: 'GVU6C', variant: null, storage: 128, ram: 8, color: 'Obsidian', network: '5G' },
  { brand: 'Google', model: 'Pixel 8', modelNumber: 'GKWS6', variant: null, storage: 128, ram: 8, color: 'Obsidian', network: '5G' },
  { brand: 'Xiaomi', model: '13 Pro', modelNumber: '2210132G', variant: null, storage: 256, ram: 12, color: 'Ceramic Black', network: '5G' },
];

export interface DemoProviderSpec {
  slug: string;
  name: string;
  website: string;
  integrationType: 'API' | 'FEED' | 'AUTHORIZED_CRAWL' | 'MANUAL_IMPORT';
  trustScore: number;
}

/** Demo providers modeled on real Indian refurbished sellers (disabled by default). */
export const DEMO_PROVIDERS: DemoProviderSpec[] = [
  { slug: 'cashify', name: 'Cashify', website: 'https://www.cashify.in', integrationType: 'API', trustScore: 82 },
  { slug: 'budli', name: 'Budli', website: 'https://budli.in', integrationType: 'FEED', trustScore: 70 },
  { slug: 'refit', name: 'ReFit Global', website: 'https://www.refitglobal.in', integrationType: 'AUTHORIZED_CRAWL', trustScore: 66 },
  { slug: 'sahivalue', name: 'SahiValue', website: 'https://sahivalue.com', integrationType: 'API', trustScore: 62 },
  { slug: 'mobilegoo', name: 'MobileGoo', website: 'https://www.mobilegoo.in', integrationType: 'MANUAL_IMPORT', trustScore: 58 },
];

/**
 * Pinned TEST fixture prices for the six canonical device variants exercised by
 * end-to-end testing. Each variant gets an exact, monotonic price ladder across
 * the five providers (cheapest → most expensive in slug order), starting with
 * the reference iPhone 13 128 GB ladder (Cashify 26,799 → MobileGoo 28,499).
 *
 * This is TEST data only: it is generated locally, never scraped, and must
 * never be presented as a live seller price. The MOCK fetch path serves it
 * only outside DATA_MODE=live (see BaseConnector + runProviderSync gating).
 */
export interface TestFixtureVariant {
  brand: string;
  model: string;
  storage: number;
  /** One-sided price ladder keyed by provider slug. */
  prices: Record<string, number>;
}

export const TEST_FIXTURE_VARIANTS: TestFixtureVariant[] = [
  { brand: 'Apple', model: 'iPhone 13', storage: 128, prices: { cashify: 26799, budli: 27199, refit: 27599, sahivalue: 27999, mobilegoo: 28499 } },
  { brand: 'Apple', model: 'iPhone 13', storage: 256, prices: { cashify: 30999, budli: 31499, refit: 31999, sahivalue: 32499, mobilegoo: 32699 } },
  { brand: 'Apple', model: 'iPhone 14', storage: 128, prices: { cashify: 48799, budli: 49299, refit: 49699, sahivalue: 50099, mobilegoo: 50499 } },
  { brand: 'Samsung', model: 'Galaxy S23 5G', storage: 128, prices: { cashify: 39499, budli: 39899, refit: 40299, sahivalue: 40699, mobilegoo: 41199 } },
  { brand: 'OnePlus', model: '11 5G', storage: 128, prices: { cashify: 31999, budli: 32399, refit: 32799, sahivalue: 33199, mobilegoo: 33699 } },
  { brand: 'Google', model: 'Pixel 7', storage: 128, prices: { cashify: 24599, budli: 24999, refit: 25399, sahivalue: 25799, mobilegoo: 26299 } },
];

export function fixtureVariantFor(brand: string, model: string, storage: number): TestFixtureVariant | undefined {
  return TEST_FIXTURE_VARIANTS.find((f) => f.brand === brand && f.model === model && f.storage === storage);
}

/** Fixed timestamp so TEST fixture data is stable (and clearly synthetic). */
export const TEST_FIXTURE_UPDATED_AT = '2026-08-20T00:00:00.000Z';

/** Non-resolvable TEST host so Buy redirects for test listings are always refused. */
export function testFixtureUrl(providerSlug: string, productSlug: string, pinned: boolean): string {
  return `https://test-${providerSlug}.refurbcompare.in/product/${productSlug}${pinned ? '?fixture=1' : ''}`;
}

/** Deterministic PRNG so demo data is stable across boots. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CONDITIONS: NormalizedCondition[] = ['LIKE_NEW', 'EXCELLENT', 'GOOD', 'REFURBISHED'];

/**
 * Builds deterministic TEST listings for a provider across the catalog.
 * Returns raw ProviderProduct rows shaped exactly like a real connector would.
 *
 * The six canonical device variants (TEST_FIXTURE_VARIANTS) use pinned TEST
 * prices; the remainder of the catalog keeps the deterministic demo walk. Every
 * listing is clearly marked TEST: `sourceProductId` carries a `-test` suffix and
 * `url` lives on a non-resolvable `test-<slug>.refurbcompare.in` host so outbound
 * Buy redirects are always refused. These rows may only be served outside
 * DATA_MODE=live (BaseConnector + runProviderSync gate MOCK in live mode).
 */
export function buildDemoProviderProducts(providerSlug: string, products: DemoProductSpec[] = DEMO_PRODUCTS): ProviderProduct[] {
  const rnd = mulberry32(hashSeed(providerSlug));
  return products.map((p, index) => {
    const fixture = fixtureVariantFor(p.brand, p.model, p.storage);
    const price = fixture?.prices[providerSlug] ?? 24000 + Math.floor(rnd() * 42000) + (index % 4) * 700;
    const original = price + 4000 + Math.floor(rnd() * 9000);
    const conditionRoll = rnd();
    const normalizedCondition: NormalizedCondition = conditionRoll < 0.25 ? 'LIKE_NEW' : conditionRoll < 0.55 ? 'EXCELLENT' : conditionRoll < 0.8 ? 'GOOD' : 'REFURBISHED';
    // Fixture variants are always in stock (stable E2E); the non-fixture
    // product at index 2 occasionally demos the out-of-stock path.
    const outOfStock = fixture === undefined && index === 2 && rnd() > 0.6;
    const stockStatus: StockStatus = outOfStock ? 'OUT_OF_STOCK' : 'IN_STOCK';
    const slug = `${p.brand}-${p.model}-${p.storage}gb`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return {
      sourceProductId: `demo-${providerSlug}-${slug}-test`,
      title: `${p.brand} ${p.model} ${p.storage}GB ${p.color} (${normalizedCondition.toLowerCase().replace(/_/g, ' ')})`,
      brand: p.brand,
      model: p.model,
      modelNumber: p.modelNumber ?? undefined,
      variant: p.variant ?? undefined,
      storageGB: p.storage,
      ramGB: p.ram,
      color: p.color,
      network: p.network,
      price,
      originalPrice: original,
      currency: 'INR',
      condition: normalizedCondition.replace(/_/g, ' '),
      warrantyMonths: normalizedCondition === 'REFURBISHED' ? 6 : 3,
      returnDays: 7,
      batteryHealth: 88 + Math.floor(rnd() * 12),
      stockStatus,
      url: testFixtureUrl(providerSlug, slug, fixture !== undefined),
      imageUrl: null,
      imageUrls: [],
      sellerName: DEMO_PROVIDERS.find((d) => d.slug === providerSlug)?.name ?? providerSlug,
      sellerRating: Number((3.9 + rnd()).toFixed(1)),
      lastUpdated: new Date(TEST_FIXTURE_UPDATED_AT),
      extra: { testData: true, fixture: fixture !== undefined ? 'pinned' : 'demo' },
    };
  });
}