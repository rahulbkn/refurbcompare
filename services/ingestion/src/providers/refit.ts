import type { AppConfig, ProviderProduct, SystemProviderConfig } from '@refurbcompare/core';
import { BaseConnector } from './base.js';
import { PoliteFetcher } from '../http/polite.js';
import type { ConnectorFetchResult, HealthCheckResult } from './types.js';

/**
 * ReFit Global (refitglobal.com) live connector — Shopify storefront. The store
 * publishes its full catalog as `products.json` (a public read-only feed that
 * Shopify generates for every store on /products.json?limit=&page=). robots.txt
 * does not disallow that path for generic crawlers (only /checkout /cart
 * /orders /account /collections*sort_by* etc.), so the canned feed is crawled
 * politely. Only refurbished smartphones are kept; laptops/accessories are
 * skipped so the offer set stays on-topic.
 */
const FEED_URL = 'https://refitglobal.com/products.json';
const PAGE_SIZE = 250;
const STORAGE_RE = /(\d{1,3})\s*(gb|tb)/i;

const LAPTOP_MARKERS = /laptop|macbook|notebook|chromebook|desktop|monitor|workstation|airpods|headphones|earbuds|watch\b|stand|charger|case\b|ipad|tablet/i;
const PHONE_BRANDS =
  /iphone|galaxy|oneplus|google pixel|pixel\b|redmi|poco|xiaomi|realme|vivo|oppo|motorola|moto\b|nothing|asus|zenfone|iqoo|infinix|tecno|sony|xiaomi/i;

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string;
  product_type?: string;
  tags?: string[];
  options?: Array<{ name: string; values: string[] }>;
  variants?: Array<{
    id: number;
    title?: string;
    price?: string;
    compare_at_price?: string | null;
    available?: boolean;
    sku?: string | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
  }>;
}

export function isRefitPhone(product: ShopifyProduct): boolean {
  const hay = `${product.title} ${(product.tags ?? []).join(' ')}`;
  if (LAPTOP_MARKERS.test(hay)) return false;
  return PHONE_BRANDS.test(hay);
}

export function parseStorageGB(title: string): number | null {
  const m = title.match(STORAGE_RE);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return m[2]!.toLowerCase() === 'tb' ? value * 1000 : value;
}

export function parseRefitProduct(product: ShopifyProduct): ProviderProduct[] {
  if (!product.handle || !product.title) return [];
  const items: ProviderProduct[] = [];
  const variants = product.variants && product.variants.length ? product.variants : [];
  for (const variant of variants) {
    const rawPrice = Number(variant.price);
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) continue;
    if (variant.available === false) continue;
    const variantTitle = `${product.title} ${variant.title ?? ''} ${[variant.option1, variant.option2, variant.option3]
      .filter(Boolean)
      .join(' ')}`.trim();
    const storageGB = parseStorageGB(variantTitle);
    items.push({
      sourceProductId: variant.sku ? `sk-${variant.sku}` : `${product.handle}#${variant.id}`,
      title: variantTitle,
      brand: null,
      modelNumber: null,
      storageGB,
      ramGB: null,
      color: null,
      variant: null,
      price: Math.round(rawPrice),
      currency: 'INR',
      condition: 'Refurbished',
      warrantyMonths: 6,
      returnDays: 0,
      stockStatus: variant.available === true ? 'IN_STOCK' : 'UNKNOWN',
      url: `https://refitglobal.com/products/${product.handle}`,
      imageUrl: null,
      sellerName: 'ReFit Global',
      availability: 'Refurbished with 6-month ReFit warranty',
      lastUpdated: new Date(),
      extra: { shopifyVariantId: variant.id, tags: product.tags ?? [] },
    });
  }
  return items;
}

export class RefitConnector extends BaseConnector {
  private fetcher = new PoliteFetcher({ ua: 'RefurbMeterBot/0.1 (authorized price-comparison crawler; https://refurbmeter.pages.dev/contact)', defaultMaxRequestsPerMinute: 20 });

  constructor() {
    super({
      slug: 'refit',
      name: 'ReFit Global',
      website: 'https://www.refitglobal.com',
      integrationType: 'FEED',
      trustScore: 66,
      defaultMode: 'FEED',
    });
  }

  override async healthCheck(config: SystemProviderConfig | null): Promise<HealthCheckResult> {
    const res = await super.healthCheck(config);
    if (res.message.includes('auth approved')) {
      res.message = res.message.replace(
        'endpoint reachability must be verified with vendor credentials',
        'verified via public Shopify catalog feed (products.json); robots.txt reviewed for /products.json',
      );
    }
    return res;
  }

  protected override async liveFetch(opts: {
    config: SystemProviderConfig | null;
    dataMode: AppConfig['dataMode'];
    nextOffset?: number;
  }): Promise<ConnectorFetchResult> {
    const ratePerMinute = opts.config?.rateLimit?.maxRequestsPerMinute ?? 20;
    const maxPages = Math.max(1, Number(process.env.REFIT_MAX_PAGES ?? '0') || Infinity);
    const items: ProviderProduct[] = [];
    let firstError: unknown = null;

    for (let page = 1; page <= maxPages; page++) {
      try {
        const payload = await this.fetcher.json<{ products: ShopifyProduct[] }>(
          `${FEED_URL}?limit=${PAGE_SIZE}&page=${page}`,
          { maxRequestsPerMinute: ratePerMinute },
        );
        const products = payload.products ?? [];
        for (const product of products) {
          if (!isRefitPhone(product)) continue;
          items.push(...parseRefitProduct(product));
        }
        if (products.length < PAGE_SIZE) break;
      } catch (err) {
        if (firstError === null) firstError = err;
        break;
      }
    }

    if (items.length === 0 && firstError !== null) {
      const msg = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(`${msg} (refit live fetch)`);
    }

    // Single-pass: the full catalog is returned in one call, so the pipeline
    // must not request another page (avoids re-fetching the whole feed.
    return { items, hasNextPage: false };
  }
}

export const REFIT_CONNECTOR = new RefitConnector();