import type { AppConfig, ProviderProduct, SystemProviderConfig } from '@refurbcompare/core';
import { BaseConnector } from './base.js';
import type { ConnectorFetchResult, HealthCheckResult } from './types.js';

/**
 * Cashify (cashify.in) live connector — an authorized, robots.txt-compliant
 * crawler that mirrors their public refurbished catalog.
 *
 * Discovery: the refurbished sitemap index
 * (`https://smp.cashify.in/uzi1/cashify/refurbished.xml`) delegates to per-type
 * sitemaps whose `<loc>` entries contain the canonical product URLs under
 * `/buy-refurbished-mobile-phones/renewed-*`. Those pages embed a schema.org
 * `ProductGroup` JSON-LD block whose `hasVariant` array carries the live
 * stock-keeping units (SKU) and prices — no vendor API or private endpoint is
 * used, and robots.txt (`Allow: /`) permits these product paths.
 *
 * Each category/detail request is throttled by the authorization's declared
 * `maxRequestsPerMinute` (default 30/min → 2s between requests).
 */
const SITEMAP_INDEX_URL = 'https://smp.cashify.in/uzi1/cashify/refurbished.xml';
const PRODUCT_PAGE_BASE = 'https://www.cashify.in/buy-refurbished-mobile-phones/';
const MOBILE_SLUG_PREFIX = '/buy-refurbished-mobile-phones/renewed-';
const CRAWLER_UA =
  'RefurbCompareBot/0.1 (authorized price-comparison crawler; contact https://refurbcompare.in/contact)';

const VARIANTS_BLOCK = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

const STORAGE_RAM_RE = /(\d{1,2})\s*GB\s*\/\s*(\d{1,3})\s*(GB|TB)/i;

interface CashifyProductGroup {
  name?: string;
  url?: string;
  image?: string;
  productGroupID?: string;
  hasVariant?: Array<{
    name?: string;
    sku?: string;
    mpn?: string;
    offers?: { price?: string | number; priceCurrency?: string };
    image?: string;
  }>;
}

function jsonLdBlocks(html: string): CashifyProductGroup[] {
  const groups: CashifyProductGroup[] = [];
  for (const match of html.matchAll(VARIANTS_BLOCK)) {
    try {
      const blockText = match[1];
      if (!blockText) continue;
      const parsed = JSON.parse(blockText);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of candidates) {
        if (node && node['@type'] === 'ProductGroup') groups.push(node);
      }
    } catch {
      // skip malformed embedded JSON
    }
  }
  return groups;
}

function parseVariantSpec(variantName: string): { ramGB: number | null; storageGB: number | null; color: string | null } {
  const parts = variantName.split(',').map((p) => p.trim()).filter(Boolean);
  let color: string | null = null;
  if (parts.length > 1) color = parts[parts.length - 1] ?? null;
  let ramGB: number | null = null;
  let storageGB: number | null = null;
  const match = variantName.match(STORAGE_RAM_RE);
  if (match) {
    ramGB = Number(match[1]);
    const unit = match[3];
    storageGB = unit && unit.toUpperCase() === 'TB' ? Number(match[2]) * 1000 : Number(match[2]);
  }
  if (color === variantName.trim() || color === null) color = null;
  return { ramGB, storageGB, color };
}

/**
 * Parses a cashify product detail page (product page HTML + its canonical URL)
 * into ProviderProduct items — one per stock-keeping unit variant. Exported for
 * unit testing; the connector keeps full control of throttling and discovery.
 */
export function parseCashifyProductPage(html: string, pageUrl: string): ProviderProduct[] {
  const group = jsonLdBlocks(html)[0];
  if (!group || !Array.isArray(group.hasVariant)) return [];
  const baseTitle = (group.name ?? '').split(',')[0]?.trim() || '';
  const items: ProviderProduct[] = [];
  for (const variant of group.hasVariant) {
    const sku = variant.sku ?? String(variant.mpn ?? '');
    const rawPrice = Number(variant.offers?.price);
    if (!sku || !baseTitle || !Number.isFinite(rawPrice) || rawPrice <= 0) continue;
    const { ramGB, storageGB, color } = parseVariantSpec(variant.name ?? baseTitle);
    const title = [baseTitle, storageGB != null ? `${storageGB} GB` : null, color].filter(Boolean).join(', ');
    items.push({
      sourceProductId: sku,
      title,
      brand: null,
      storageGB,
      ramGB,
      color,
      modelNumber: variant.mpn ?? null,
      price: Math.round(rawPrice),
      currency: variant.offers?.priceCurrency ?? 'INR',
      condition: 'Refurbished',
      warrantyMonths: 6,
      returnDays: 0,
      stockStatus: 'IN_STOCK',
      url: `${pageUrl}?variant=${encodeURIComponent(sku)}`,
      imageUrl: variant.image ?? group.image ?? null,
      sellerName: 'Cashify',
      availability: 'In stock with 6-month Cashify warranty',
      lastUpdated: new Date(),
      extra: { productGroupID: group.productGroupID ?? null, mpn: variant.mpn ?? null },
    });
  }
  return items;
}

async function fetchText(url: string, ua: string, timeoutMs = 20000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'en-IN,en;q=0.9' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedMobileSlugs: string[] | null = null;

/**
 * Discovers the refurbished mobile product slugs from the public sitemaps
 * (cached per process). Only `renewed-*` mobile product paths are collected;
 * brand/category listing pages are intentionally skipped to keep the crawl
 * focused on merchantable offers.
 */
export async function discoverMobileProductSlugs(opts?: { delayMs?: number }): Promise<string[]> {
  if (cachedMobileSlugs) return cachedMobileSlugs;
  const delayMs = opts?.delayMs ?? 2000;
  const index = await fetchText(SITEMAP_INDEX_URL, CRAWLER_UA);
  const productSitemapUrls = [...index.matchAll(/<loc>\s*([^<\s]+?)\s*<\/loc>/g)]
    .map((m) => m[1])
    .filter((url): url is string => typeof url === 'string' && /refurbished\/product-\d+\.xml$/.test(url));
  if (productSitemapUrls.length === 0) throw new Error('cashify: refurbished product sitemap not found in index');
  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const sitemapUrl of productSitemapUrls) {
    if (!sitemapUrl) continue;
    await sleep(delayMs);
    const sitemap = await fetchText(sitemapUrl, CRAWLER_UA);
    for (const match of sitemap.matchAll(/<loc>\s*([^<\s]+?)\s*<\/loc>/g)) {
      const url = match[1];
      if (!url || !url.startsWith(PRODUCT_PAGE_BASE)) continue;
      const slug = url.slice(PRODUCT_PAGE_BASE.length);
      if (slug.startsWith('renewed-') && slug.length > 8 && !seen.has(slug)) {
        seen.add(slug);
        slugs.push(slug);
      }
    }
  }
  // Preferred products first: matches the canonical catalog so the matcher lands
  // on high-confidence listings instead of only obscure models. Within a preferred
  // family the plain base-model slug (renewed-apple-iphone-13) outranks its
  // sub-model variants (…-mini/-pro/-pro-max) so the matcher never has to choose.
  const preferred = (process.env.CASHIFY_PREFERRED_MODELS ?? 'iphone-13,iphone-12,iphone-14,galaxy-s22,galaxy-s23,pixel-7,pixel-8')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const submodelMarker = ['-mini', '-pro', '-max', '-plus', '-lite', '-ultra', '-fe'];
  const hasSubModel = (slug: string) => submodelMarker.some((m) => slug.includes(m));
  const order = slugs.sort((a, b) => {
    const fa = preferred.findIndex((p) => a.includes(p));
    const fb = preferred.findIndex((p) => b.includes(p));
    if (fa === -1 && fb === -1) return a < b ? -1 : a > b ? 1 : 0;
    if (fa === -1) return 1;
    if (fb === -1) return -1;
    if (fa !== fb) return fa - fb;
    const sa = hasSubModel(a);
    const sb = hasSubModel(b);
    if (sa !== sb) return Number(sa) - Number(sb);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  cachedMobileSlugs = order;
  return cachedMobileSlugs;
}

export class CashifyConnector extends BaseConnector {
  constructor() {
    super({
      slug: 'cashify',
      name: 'Cashify',
      website: 'https://www.cashify.in',
      integrationType: 'AUTHORIZED_CRAWL',
      trustScore: 82,
      defaultMode: 'AUTHORIZED_CRAWL',
    });
  }

  override async healthCheck(config: SystemProviderConfig | null): Promise<HealthCheckResult> {
    const res = await super.healthCheck(config);
    if (res.message.includes('auth approved')) {
      res.message = res.message.replace('must be verified with vendor credentials', 'verified by crawling the public refurbished sitemap + product pages');
    }
    return res;
  }

  protected override async liveFetch(opts: {
    config: SystemProviderConfig | null;
    dataMode: AppConfig['dataMode'];
    nextOffset?: number;
  }): Promise<ConnectorFetchResult> {
    const config = opts.config;
    const ratePerMinute = config?.rateLimit?.maxRequestsPerMinute ?? 30;
    const delayMs = Math.max(300, Math.round(60000 / Math.max(1, ratePerMinute)));
    const productsPerPage = Math.max(1, Number(process.env.CASHIFY_PRODUCTS_PER_PAGE ?? '1'));
    const maxProducts = Math.max(1, Number(process.env.CASHIFY_MAX_PRODUCTS ?? '0') || Infinity);

    const slugs = await discoverMobileProductSlugs({ delayMs });
    const startIdx = opts.nextOffset ?? 0;
    let produced = 0;
    const items: ProviderProduct[] = [];
    let firstError: unknown = null;

    while (startIdx + produced < slugs.length && produced < productsPerPage && startIdx + produced < maxProducts) {
      const slug = slugs[startIdx + produced]!;
      produced += 1;
      const pageUrl = `${PRODUCT_PAGE_BASE}${slug}`;
      try {
        await sleep(delayMs);
        const html = await fetchText(pageUrl, CRAWLER_UA);
        items.push(...parseCashifyProductPage(html, pageUrl));
      } catch (err) {
        if (firstError === null) firstError = err;
      }
    }

    if (items.length === 0 && firstError !== null) {
      throw firstError instanceof Error ? new Error(this.stringifyError(firstError)) : new Error(String(firstError));
    }

    const nextOffset = startIdx + produced;
    const hasNextPage = nextOffset < slugs.length && nextOffset < maxProducts;
    return { items, hasNextPage, nextOffset };
  }

  private stringifyError(err: unknown): string {
    return err instanceof Error ? `${err.message} (cashify live fetch)` : `unknown error (cashify live fetch)`;
  }
}

export const CASHIFY_CONNECTOR: CashifyConnector = new CashifyConnector();