import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SqliteRepository, seedDemoCatalog, seedDemoListings } from '@refurbcompare/db';
import { createLogger } from '@refurbcompare/core';

let dir: string;
let repo: SqliteRepository;
const logger = createLogger('silent');

beforeAll(async () => {
  const base = join(homedir(), '.cache', 'opencode', 'tmp');
  mkdirSync(base, { recursive: true });
  dir = mkdtempSync(join(base, 'refurb-repo-test-'));
  repo = new SqliteRepository(`file:${join(dir, 'test.db')}`);
  await repo.init();
  await seedDemoCatalog(repo);
  await seedDemoListings(repo);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('SqliteRepository', () => {
  it('lists seeded demo products with best-price aggregates', async () => {
    const { items, total } = await repo.listProducts({ page: 1, pageSize: 100 });
    expect(total).toBe(11);
    expect(items[0]).toMatchObject({ brand: expect.any(String), slug: expect.any(String) });
  });

  it('filters by brand and price', async () => {
    const { items, total } = await repo.listProducts({ page: 1, pageSize: 50, brand: 'Apple' });
    expect(total).toBeGreaterThanOrEqual(3);
    for (const item of items) expect(item.brand).toBe('Apple');
  });

  it('searches by query', async () => {
    const { items, total } = await repo.listProducts({ page: 1, pageSize: 50, query: 'pixel' });
    expect(total).toBeGreaterThan(0);
    expect(items[0]?.brand).toBe('Google');
  });

  it('looks up a product by slug and id', async () => {
    const bySlug = await repo.getProductBySlug('apple-iphone-13-128gb');
    expect(bySlug?.brand).toBe('Apple');
    const byId = await repo.getProductById(bySlug!.id);
    expect(byId?.id).toBe(bySlug?.id);
  });

  it('hides demo listings from aggregates when liveVisibleOnly is set', async () => {
    const p = await repo.getProductBySlug('apple-iphone-13-128gb');
    expect(p!.listingCount).toBe(5);
    expect(p!.bestPrice).toBe(26799);

    const live = await repo.getProductBySlug('apple-iphone-13-128gb', { liveVisibleOnly: true });
    expect(live!.listingCount).toBe(0);
    expect(live!.bestPrice).toBeNull();

    const byId = await repo.getProductById(p!.id, { liveVisibleOnly: true });
    expect(byId!.listingCount).toBe(0);
  });

  it('listProducts excludes zero-offer products in live-visible mode', async () => {
    const { items, total } = await repo.listProducts({ page: 1, pageSize: 100, liveVisibleOnly: true });
    expect(total).toBe(0);
    expect(items).toEqual([]);
  });

  it('lists in-stock listings for a product with relations', async () => {
    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const listings = await repo.listListingsForProduct(product!.id);
    expect(listings.length).toBe(5);
    expect(listings[0]?.provider?.name).toBeTruthy();
    expect(listings[0]?.product?.slug).toBe('apple-iphone-13-128gb');
  });

  it('upserts a listing idempotently, updating only on change', async () => {
    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const listing = (await repo.listListingsForProduct(product!.id))[0]!;

    const unchanged = await repo.upsertListing({
      id: listing.id,
      productId: listing.productId,
      providerId: listing.providerId,
      sourceProductId: listing.sourceProductId,
      sourceUrl: listing.sourceUrl,
      affiliateUrl: listing.affiliateUrl,
      price: listing.price,
      originalPrice: listing.originalPrice,
      discount: listing.discount,
      normalizedCondition: listing.normalizedCondition,
      sourceCondition: listing.sourceCondition,
      conditionScore: listing.conditionScore,
      conditionDescription: listing.conditionDescription,
      warrantyMonths: listing.warrantyMonths,
      returnDays: listing.returnDays,
      batteryHealth: listing.batteryHealth,
      stockStatus: listing.stockStatus,
      deliveryEstimate: listing.deliveryEstimate,
      sellerName: listing.sellerName,
      sellerRating: listing.sellerRating,
      lastCheckedAt: new Date(),
      priceUpdatedAt: new Date(),
    });
    expect(unchanged.status).toBe('skipped');

    const changed = await repo.upsertListing({
      id: listing.id,
      productId: listing.productId,
      providerId: listing.providerId,
      sourceProductId: listing.sourceProductId,
      sourceUrl: listing.sourceUrl,
      affiliateUrl: listing.affiliateUrl,
      price: listing.price - 1000,
      originalPrice: listing.originalPrice,
      discount: listing.discount,
      normalizedCondition: listing.normalizedCondition,
      sourceCondition: listing.sourceCondition,
      conditionScore: listing.conditionScore,
      conditionDescription: listing.conditionDescription,
      warrantyMonths: listing.warrantyMonths,
      returnDays: listing.returnDays,
      batteryHealth: listing.batteryHealth,
      stockStatus: listing.stockStatus,
      deliveryEstimate: listing.deliveryEstimate,
      sellerName: listing.sellerName,
      sellerRating: listing.sellerRating,
      lastCheckedAt: new Date(),
      priceUpdatedAt: new Date(),
    });
    expect(changed.status).toBe('updated');
  });

  it('records price history points for a product', async () => {
    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const points = await repo.getPriceHistory(product!.id, 90);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toMatchObject({ date: expect.any(String), price: expect.any(Number) });
  });

  it('creates and dedupes price alerts by email+product', async () => {
    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const alert = await repo.createPriceAlert({ productId: product!.id, email: 'a@example.com', targetPrice: 30000 });
    expect(alert.status).toBe('ACTIVE');
    const existing = await repo.getPriceAlertByProductAndEmail(product!.id, 'a@example.com');
    expect(existing?.id).toBe(alert.id);
    const active = await repo.listActiveAlerts();
    expect(active.some((a) => a.id === alert.id)).toBe(true);
    await repo.setAlertStatus(alert.id, 'TRIGGERED');
    const after = await repo.getPriceAlertByProductAndEmail(product!.id, 'a@example.com');
    expect(after?.status).toBe('TRIGGERED');
  });

  it('records clicks and exposes them with product/provider context', async () => {
    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const listing = (await repo.listListingsForProduct(product!.id))[0]!;
    await repo.recordClick({
      clickId: 'click_test_1',
      listingId: listing.id,
      productId: product!.id,
      providerId: listing.providerId,
      referrer: 'https://refurbcompare.in/product/x',
      deviceType: 'mobile',
      userAgentHash: 'abc123',
    });
    const { items, total } = await repo.listClicks({ page: 1, pageSize: 20 });
    expect(total).toBeGreaterThan(0);
    expect(items[0]?.productSlug).toBe('apple-iphone-13-128gb');
    expect(items[0]?.providerName).toBeTruthy();
  });

  it('enables a provider (mode flips to MOCK) and disables it again', async () => {
    const cashify = await repo.getProviderBySlug('cashify');
    const enabled = await repo.setProviderEnabled(cashify!.id, { enabled: true, disabledReason: null });
    expect(enabled.active).toBe(true);
    expect(enabled.mode).toBe('MOCK');
    const disabled = await repo.setProviderEnabled(cashify!.id, { enabled: false, disabledReason: 'test' });
    expect(disabled.active).toBe(false);
    expect(disabled.disabledReason).toBe('test');
  });

  it('archives synthetic demo listings for live mode but leaves real rows intact', async () => {
    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const activeAll = await repo.listActiveListings();
    const demoCount = activeAll.filter((l) => l.sourceProductId.startsWith('demo-')).length;
    expect(demoCount).toBeGreaterThan(0);
    expect(activeAll.length).toBe(demoCount);

    const archived = await repo.archiveDemoListings();
    expect(archived).toBeGreaterThanOrEqual(demoCount);
    expect(archived).toBeGreaterThan(0);

    const activeAfter = await repo.listActiveListings();
    expect(activeAfter.filter((l) => l.sourceProductId.startsWith('demo-'))).toHaveLength(0);

    const archivedRows = await repo.listListingsForProduct(product!.id, true);
    const archivedDemo = archivedRows.find((l) => l.sourceProductId.startsWith('demo-'));
    expect(archivedDemo?.archivedAt).not.toBeNull();
    expect(archivedDemo?.stockStatus).toBe('ARCHIVED');

    const real = await repo.upsertListing({
      id: 'listing_real_test_1',
      productId: product!.id,
      providerId: archivedDemo!.providerId,
      sourceProductId: 'REAL-SKU-001',
      sourceUrl: 'https://www.cashify.in/buy-refurbished-mobile-phones/renewed-apple-iphone-13?variant=REAL-SKU-001',
      affiliateUrl: null,
      price: 26000,
      originalPrice: null,
      discount: null,
      normalizedCondition: 'REFURBISHED',
      sourceCondition: 'Refurbished',
      conditionScore: 70,
      conditionDescription: null,
      warrantyMonths: 6,
      returnDays: 7,
      batteryHealth: null,
      stockStatus: 'IN_STOCK',
      deliveryEstimate: null,
      sellerName: 'Cashify',
      sellerRating: null,
      lastCheckedAt: new Date(),
      priceUpdatedAt: new Date(),
    });
    expect(real.status).toBe('added');

    const again = await repo.archiveDemoListings();
    expect(again).toBe(0);

    const stillThere = (await repo.listListingsForProduct(product!.id)).find((l) => l.id === 'listing_real_test_1');
    expect(stillThere).toBeDefined();
    expect(stillThere?.archivedAt).toBeNull();
  });

  it('provides provider active/trust on listing relations for live visibility filtering', async () => {
    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const listing = (await repo.listListingsForProduct(product!.id))[0]!;
    expect(listing.provider?.active).toBeTypeOf('boolean');
    expect(listing.provider?.trustScore).toBeTypeOf('number');
    const disabled = await repo.setProviderEnabled(listing.providerId, { enabled: false, disabledReason: 'test' });
    expect(disabled.active).toBe(false);
    const after = await repo.listListingsForProduct(product!.id);
    expect(after[0]?.provider?.active).toBe(false);
  });

  it('persists provider authorization and flips approved', async () => {
    const cashify = await repo.getProviderBySlug('cashify');
    const auth = await repo.upsertProviderAuthorization({
      providerId: cashify!.id,
      approved: true,
      authorizationType: 'API',
      permittedDomains: 'cashify.in',
      permittedPaths: '/api',
      permittedFields: 'title,price',
      maxRequestsPerMinute: 30,
      termsReviewedAt: new Date('2026-01-01'),
      robotsReviewedAt: new Date('2026-01-02'),
      copyrightDataUseReviewed: true,
      contactRecorded: true,
      authorizationNotes: 'n/a',
      sourceAttributionRequired: true,
      expiresAt: new Date('2027-01-01'),
    });
    expect(auth.approved).toBe(true);
    const roundTrip = await repo.getProviderAuthorization(cashify!.id);
    expect(roundTrip?.maxRequestsPerMinute).toBe(30);
  });

  it('creates sync jobs and surfaces recent runs', async () => {
    const cashify = await repo.getProviderBySlug('cashify');
    const job = await repo.createSyncJob({ providerId: cashify!.id, mode: 'MOCK', source: 'test' });
    await repo.updateSyncJob(job.id, { status: 'SUCCESS', itemsSeen: 5 });
    const recent = await repo.listRecentSyncJobs(5);
    expect(recent[0]?.status).toBe('SUCCESS');
  });

  it('marks no stale listings when nothing has failed, and archives a listing', async () => {
    const stale = await repo.markStaleListings({ maxFailures: 3, limit: 50 });
    expect(Array.isArray(stale)).toBe(true);

    const product = await repo.getProductBySlug('apple-iphone-13-128gb');
    const listing = (await repo.listListingsForProduct(product!.id))[0]!;
    await repo.archiveListing(listing.id);
    const archived = await repo.getListingById(listing.id);
    expect(archived?.stockStatus).toBe('ARCHIVED');
  });

  it('records search queries', async () => {
    const row = await repo.recordSearchQuery('iphone', 3);
    expect(row.query).toBe('iphone');
    expect(row.resultCount).toBe(3);
  });
});