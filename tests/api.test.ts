import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resetConfig, loadConfig } from '@refurbcompare/core';
import { buildServices, startServices } from '../apps/api/src/bootstrap.js';
import { buildApp } from '../apps/api/src/app.js';

let dir: string;
let stop: () => Promise<void>;
let app: Awaited<ReturnType<typeof buildApp>>;
let services: ReturnType<typeof buildServices>;

beforeAll(async () => {
  const base = join(homedir(), '.cache', 'opencode', 'tmp');
  mkdirSync(base, { recursive: true });
  dir = mkdtempSync(join(base, 'refurb-api-test-'));

  resetConfig();
  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_MODE: 'demo',
    DATABASE_DRIVER: 'sqlite',
    DATABASE_URL: `file:${join(dir, 'api.db')}`,
    QUEUE_DRIVER: 'memory',
    ADMIN_API_KEY: 'test-admin-key',
    RATE_LIMIT_MAX: '1000',
  });

  services = buildServices(config);
  const running = await startServices(services);
  stop = running.stop;
  app = buildApp(services);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stop();
  rmSync(dir, { recursive: true, force: true });
});

describe('public API', () => {
  it('GET /healthz reports demo mode', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, data: { status: 'ok', mode: 'demo' } });
  });

  it('GET /api/v1/products lists seeded products with meta', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products?pageSize=50' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(11);
    expect(body.meta.total).toBe(11);
  });

  it('filters products by brand', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products?brand=Apple&pageSize=50' });
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    for (const item of body.data) expect(item.brand).toBe('Apple');
  });

  it('GET /api/v1/search finds products and records the query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=pixel' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].brand).toBe('Google');
  });

  it('GET /api/v1/products/:slug returns a product', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products/apple-iphone-13-128gb' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.slug).toBe('apple-iphone-13-128gb');
  });

  it('GET /api/v1/products/:slug/listings returns a comparison', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/products/apple-iphone-13-128gb/listings' });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.offers.length).toBeGreaterThan(0);
    expect(typeof body.stats.lowestPrice).toBe('number');
    expect(Array.isArray(body.scores)).toBe(true);
  });

  it('GET /api/v1/deals returns discounted offers only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/deals?pageSize=20' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const deal of body.data) {
      expect(deal.originalPrice).toBeGreaterThan(deal.price);
    }
  });

  it('GET /api/v1/providers lists disabled demo providers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/providers' });
    const body = res.json().data;
    expect(body.length).toBe(5);
    for (const provider of body) expect(provider.integrated).toBe(false);
  });

  it('POST /api/v1/price-alerts validates input', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/price-alerts',
      payload: { productId: 'nope', email: 'not-an-email', targetPrice: -1 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().success).toBe(false);

    const good = await app.inject({
      method: 'POST',
      url: '/api/v1/price-alerts',
      payload: { productId: 'prod_apple-iphone-13-128gb', email: 'buyer@example.com', targetPrice: 30000 },
    });
    expect(good.statusCode).toBe(201);
    expect(good.json().data.alert.status).toBe('ACTIVE');
  });

  it('GET /api/v1/price-history returns points', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/price-history/prod_apple-iphone-13-128gb' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.points.length).toBeGreaterThan(0);
  });

  it("GET /go/:id refuses redirects for TEST listings even when the provider is enabled", async () => {
    // Providers are disabled by default: redirect must be refused.
    const refused = await app.inject({ method: "GET", url: "/go/listing_demo-cashify-apple-iphone-13-128gb-test" });
    expect(refused.statusCode).toBe(403);

    // Enable cashify like the admin flow would. TEST fixtures live on a
    // non-resolvable `test-*.refurbcompare.in` host, so the redirect stays
    // refused: no Buy redirect may ever point test data at a real seller.
    await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/providers/provider_cashify",
      headers: { "x-admin-key": "test-admin-key" },
      payload: { active: true, disabledReason: null },
    });
    const redirect = await app.inject({ method: "GET", url: "/go/listing_demo-cashify-apple-iphone-13-128gb-test" });
    expect(redirect.statusCode).toBe(403);
    expect(redirect.headers.location).toBeUndefined();
  });
});

describe('admin API', () => {
  it('rejects calls without a valid admin key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/sync/status' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('lists sync status with the admin key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/sync/status',
      headers: { 'x-admin-key': 'test-admin-key' },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data.recent)).toBe(true);
  });

  it('authorizes a provider', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/providers/provider_cashify/authorize',
      headers: { 'x-admin-key': 'test-admin-key' },
      payload: {
        approved: true,
        authorizationType: 'API',
        permittedDomains: 'cashify.in',
        permittedPaths: '/api',
        permittedFields: 'title,price',
        maxRequestsPerMinute: 30,
        termsReviewedAt: '2026-08-20T00:00:00.000Z',
        robotsReviewedAt: '2026-08-20T00:00:00.000Z',
        copyrightDataUseReviewed: true,
        contactRecorded: true,
        sourceAttributionRequired: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.approved).toBe(true);
  });

  it('triggers a sync job and reports SUCCESS', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/sync/cashify',
      headers: { 'x-admin-key': 'test-admin-key' },
      payload: { mode: 'MOCK' },
    });
    expect(start.statusCode).toBe(202);
    expect(start.json().data.job.status).toBe('PENDING');

    await new Promise((r) => setTimeout(r, 500));

    const status = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/sync/status',
      headers: { 'x-admin-key': 'test-admin-key' },
    });
    expect(status.json().data.recent[0]?.status).toBe('SUCCESS');
  });

  it('runs admin provider health checks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health',
      headers: { 'x-admin-key': 'test-admin-key' },
    });
    expect(res.statusCode).toBe(200);
    const reports = res.json().data;
    expect(reports.length).toBe(5);
    for (const report of reports) {
      expect(['ok', 'error', 'unchecked']).toContain(report.status);
    }
  });
});

describe('live mode isolation (demo-seeded db promoted to DATA_MODE=live)', () => {
  let liveDir: string;
  let liveStop: Awaited<ReturnType<typeof startServices>>;
  let liveApp: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    const base = join(homedir(), '.cache', 'opencode', 'tmp');
    mkdirSync(base, { recursive: true });
    liveDir = mkdtempSync(join(base, 'refurb-live-test-'));
    const dbUrl = `file:${join(liveDir, 'live.db')}`;

    // Phase 1: seed a demo db, then shut it down.
    resetConfig();
    const demoConfig = loadConfig({
      NODE_ENV: 'test',
      DATA_MODE: 'demo',
      DATABASE_DRIVER: 'sqlite',
      DATABASE_URL: dbUrl,
      QUEUE_DRIVER: 'memory',
      ADMIN_API_KEY: 'test-live-key',
      RATE_LIMIT_MAX: '1000',
    });
    const demo = buildServices(demoConfig);
    const demoR = await startServices(demo);
    const demoApp = buildApp(demo);
    await demoApp.ready();
    expect((await demoApp.inject({ method: 'GET', url: '/healthz' })).json().data.mode).toBe('demo');
    const seeded = await demoApp.inject({ method: 'GET', url: '/api/v1/products/apple-iphone-13-128gb/listings' });
    expect(seeded.json().data.offers.length).toBe(5);
    await demoApp.close();
    await demoR.stop();

    // Phase 2: reopen the same db in live mode.
    resetConfig();
    const liveConfig = loadConfig({
      NODE_ENV: 'test',
      DATA_MODE: 'live',
      DATABASE_DRIVER: 'sqlite',
      DATABASE_URL: dbUrl,
      QUEUE_DRIVER: 'memory',
      ADMIN_API_KEY: 'test-live-key',
      RATE_LIMIT_MAX: '1000',
    });
    const live = buildServices(liveConfig);
    liveStop = await startServices(live);
    liveApp = buildApp(live);
    await liveApp.ready();
  });

  afterAll(async () => {
    await liveApp.close();
    await liveStop.stop();
    rmSync(liveDir, { recursive: true, force: true });
  });

  it('healthz reports live mode', async () => {
    const res = await liveApp.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.mode).toBe('live');
  });

  it('archiveDemoListings on boot removes synthetic listings from comparisons', async () => {
    const res = await liveApp.inject({ method: 'GET', url: '/api/v1/products/apple-iphone-13-128gb/listings' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data.offers)).toBe(true);
    expect(body.data.offers).toHaveLength(0);
  });

  it('excludes zero-offer products from the live mode catalog', async () => {
    const res = await liveApp.inject({ method: 'GET', url: '/api/v1/products?pageSize=50' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(0);
  });

  it('serves no demo offers and no best price in live mode price history', async () => {
    const res = await liveApp.inject({ method: 'GET', url: '/api/v1/price-history/prod_apple-iphone-13-128gb' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.currentBestPrice).toBeNull();
  });
});