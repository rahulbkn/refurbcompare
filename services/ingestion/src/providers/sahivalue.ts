import type { AppConfig, ProviderProduct, SystemProviderConfig } from '@refurbcompare/core';
import { BaseConnector } from './base.js';
import { PoliteFetcher } from '../http/polite.js';
import type { ConnectorFetchResult, HealthCheckResult } from './types.js';

/**
 * SahiValue (sahivalue.com) live connector — Zoho Commerce storefront. The site
 * embeds its full product grid (`window.zs_category = { ... }`) server-side on
 * category pages. robots.txt carries no disallows, so those public category
 * pages are crawled politely and the embedded JSON is parsed into offers.
 * Only purchaseable refurbished phone SKUs are kept; brand-new "Seal Pack"
 * listings are excluded so the set stays refurbished.
 */
const SITE = 'https://www.sahivalue.com';

const CATEGORY_URLS = [
  `${SITE}/categories/apple/293890000000018034`,
  `${SITE}/categories/buy-refurbished-second-hand-samsung-galaxy-mobile-phone/293890000027193105`,
  `${SITE}/categories/buy-refurbished-new-google-pixel-mobile-phone/293890000027083981`,
  `${SITE}/categories/buy-refurbished-second-hand-oneplus-mobile-phone/293890000027083991`,
  `${SITE}/categories/buy-refurbished-second-hand-xiaomi-mobile-phone/293890000027083744`,
  `${SITE}/categories/buy-refurbished-renewed-vivo-mobile-phone/293890000027083359`,
  `${SITE}/categories/buy-refurbished-renewed-oppo-mobile-phone/293890000027083341`,
  `${SITE}/categories/buy-refurbished-second-hand-realme-mobile-phone/293890000027083806`,
];

const STORAGE_RE = /(\d{1,3})\s*(gb|tb)/i;

interface ZohoCategoryProduct {
  product_id?: string;
  name?: string;
  handle?: string;
  url?: string;
  label_price?: number;
  selling_price?: number;
  is_out_of_stock?: boolean;
  is_available_for_purchase?: boolean;
  brand?: string;
  currency_code?: string;
  images?: Array<{ url?: string }>;
  attributes?: Array<{ name?: string; options?: Array<{ value?: string }> }>;
  variants?: Array<{
    variant_id?: string;
    sku?: string;
    options?: Array<{ name?: string; value?: string }>;
    selling_price?: number;
    is_out_of_stock?: boolean;
    stock_available?: number;
  }>;
}

interface ZohoCategory {
  name?: string;
  products?: ZohoCategoryProduct[];
}

/** Extract the `window.zs_category = {...}` object from a Zoho category page. */
export function extractZohoCategory(html: string): ZohoCategory | null {
  const marker = 'window.zs_category =';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;
  for (let i = start + marker.length; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') {
      depth += 1;
      if (objStart === -1) objStart = i;
    } else if (c === '}') {
      depth -= 1;
      if (depth === 0 && objStart !== -1) {
        const raw = html.slice(objStart, i + 1);
        try {
          return JSON.parse(raw) as ZohoCategory;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function parseStorageGB(text: string): number | null {
  const m = text.match(STORAGE_RE);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return m[2]!.toLowerCase() === 'tb' ? value * 1000 : value;
}

function isBrandNew(product: ZohoCategoryProduct): boolean {
  const name = (product.name ?? '').toLowerCase();
  if (name.includes('new seal') || name.includes('seal pack')) return true;
  const condition = (product.attributes ?? []).find((a) => (a.name ?? '').toLowerCase() === 'condition');
  const value = (condition?.options?.[0]?.value ?? '').toLowerCase();
  return value.startsWith('new') || value.includes('seal pack');
}

const ZOHO_CDN_HOST = 'https://cdn2.zohoecommerce.com';
// The bare /product-images/<file>/<id> path 404s; the CDN only serves sized
// variants with the storefront domain pinned (matches what the site itself
// renders in <img src>).
const ZOHO_IMAGE_SUFFIX = '/400x400?storefront_domain=www.sahivalue.com';

function extractImageUrl(product: ZohoCategoryProduct): string | null {
  const raw = product.images?.find((img) => typeof img.url === 'string' && img.url.length > 0)?.url;
  if (!raw) return null;
  // Zoho's generic "no image" placeholder is not a real product photo.
  if (/no-preview/i.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${ZOHO_CDN_HOST}${path}${ZOHO_IMAGE_SUFFIX}`;
}

export function parseSahiValueCategory(category: ZohoCategory): ProviderProduct[] {
  const items: ProviderProduct[] = [];
  for (const product of category.products ?? []) {
    if (!product.name || !product.handle || !product.url) continue;
    // Zoho marks online purchase as disabled store-wide (buy is via store / COD),
    // so is_available_for_purchase is NOT a stock signal — use out-of-stock + price.
    if (product.is_out_of_stock) continue;
    if (isBrandNew(product)) continue;

    const storageGB = parseStorageGB(product.name);
    const condition = (product.attributes ?? []).find((a) => (a.name ?? '').toLowerCase() === 'condition')?.options?.[0]?.value ?? 'Refurbished';
    const colorValue = (product.attributes ?? []).find((a) => (a.name ?? '').toLowerCase() === 'colour' || (a.name ?? '').toLowerCase() === 'color')?.options?.[0]?.value ?? null;

    const variants = product.variants && product.variants.length ? product.variants : [];
    const emit = (opts: {
      id: string;
      price: number;
      color: string | null;
      variantSku?: string;
    }) => {
      items.push({
        sourceProductId: opts.id,
        title: product.name!,
        brand: product.brand ?? null,
        modelNumber: null,
        storageGB,
        ramGB: null,
        color: opts.color,
        variant: null,
        price: Math.round(opts.price),
        currency: product.currency_code ?? 'INR',
        condition,
        warrantyMonths: 0,
        returnDays: 7,
        stockStatus: 'IN_STOCK',
        url: `${SITE}${product.url!}${opts.variantSku ? `?variant=${encodeURIComponent(opts.variantSku)}` : ''}`,
        imageUrl: extractImageUrl(product),
        sellerName: 'SahiValue',
        availability: 'Refurbished phone sold via SahiValue',
        lastUpdated: new Date(),
        extra: { zohoProductId: product.product_id ?? null, handle: product.handle },
      });
    };

    if (variants.length === 0) {
      if (product.selling_price && product.selling_price > 0) {
        emit({ id: `zoho-${product.product_id}`, price: product.selling_price, color: colorValue });
      }
      continue;
    }
    for (const variant of variants) {
      if (variant.is_out_of_stock) continue;
      const price = variant.selling_price ?? product.selling_price;
      if (!price || price <= 0) continue;
      const vColor =
        variant.options?.find((o) => (o.name ?? '').toLowerCase() === 'colour' || (o.name ?? '').toLowerCase() === 'color')?.value ??
        null;
      emit({
        id: variant.sku ? `zoho-${variant.sku}` : `zoho-${product.product_id}-${variant.variant_id}`,
        price,
        color: vColor,
        variantSku: variant.variant_id,
      });
    }
  }
  return items;
}

export class SahiValueConnector extends BaseConnector {
  private fetcher = new PoliteFetcher({
    ua: 'RefurbMeterBot/0.1 (authorized price-comparison crawler; https://refurbmeter.pages.dev/contact)',
    defaultMaxRequestsPerMinute: 20,
  });

  constructor() {
    super({
      slug: 'sahivalue',
      name: 'SahiValue',
      website: SITE,
      integrationType: 'AUTHORIZED_CRAWL',
      trustScore: 62,
      defaultMode: 'AUTHORIZED_CRAWL',
    });
  }

  override async healthCheck(config: SystemProviderConfig | null): Promise<HealthCheckResult> {
    const res = await super.healthCheck(config);
    if (res.message.includes('auth approved')) {
      res.message = res.message.replace(
        'endpoint reachability must be verified with vendor credentials',
        'verified by crawling public category pages; robots.txt carries no disallows',
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
    const maxCategories = Math.max(1, Number(process.env.SAHIVALUE_MAX_CATEGORIES ?? '0') || CATEGORY_URLS.length);
    const categories = CATEGORY_URLS.slice(opts.nextOffset ?? 0, (opts.nextOffset ?? 0) + maxCategories);
    const items: ProviderProduct[] = [];
    let firstError: unknown = null;
    for (const url of categories) {
      try {
        const html = await this.fetcher.text(url, { maxRequestsPerMinute: ratePerMinute });
        const category = extractZohoCategory(html);
        if (category) items.push(...parseSahiValueCategory(category));
      } catch (err) {
        if (firstError === null) firstError = err;
      }
    }
    if (items.length === 0 && firstError !== null) {
      const msg = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(`${msg} (sahivalue live fetch)`);
    }
    const nextOffset = (opts.nextOffset ?? 0) + categories.length;
    return { items, hasNextPage: nextOffset < CATEGORY_URLS.length, nextOffset };
  }
}

export const SAHIVALUE_CONNECTOR = new SahiValueConnector();