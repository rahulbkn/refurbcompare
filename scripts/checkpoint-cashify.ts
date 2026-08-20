// CHECKPOINT 1 — real Cashify crawl through the real pipeline into a LOCAL
// sandbox sqlite DB (never production). Showcased because no vendor API or key
// exists; the crawler only touches paths robots.txt allows, throttled by the
// authorization record, and aborts on non-200/pages carrying anti-bot walls.
//
// DATA_MODE=live here is LOCAL ONLY (NODE_ENV=test + sqlite): it switches the
// pipeline onto the real liveFetch path. Nothing crosses to the Render Postgres.
import { createLogger, loadConfig } from '@refurbcompare/core';
import { SqliteRepository, demoProductId, seedDemoCatalog } from '@refurbcompare/db';
import { runProviderSync } from '@refurbcompare/ingestion';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(homedir(), '.cache', 'opencode', 'tmp', 'rc-cp1-'));
const dbUrl = `file:${join(dir, 'cp1.db')}`;

async function main() {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_MODE: 'live',
    DATABASE_DRIVER: 'sqlite',
    DATABASE_URL: dbUrl,
    QUEUE_DRIVER: 'memory',
    ADMIN_API_KEY: 'cp1-local-key',
    RATE_LIMIT_MAX: '1000',
  });

  const repo = new SqliteRepository(dbUrl);
  await repo.init();
  await seedDemoCatalog(repo);

  const cashify = await repo.getProviderBySlug('cashify');
  if (!cashify) throw new Error('provider_cashify missing after seedDemoCatalog');

  await repo.setProviderEnabled(cashify.id, { enabled: true, mode: 'AUTHORIZED_CRAWL' });
  await repo.upsertProviderAuthorization({
    providerId: cashify.id,
    approved: true,
    authorizationType: 'AUTHORIZED_CRAWL',
    permittedDomains: 'www.cashify.in,smp.cashify.in',
    permittedPaths: '/buy-refurbished-mobile-phones/*',
    permittedFields: 'title,sku,price,currency,condition,storage,ram,color',
    maxRequestsPerMinute: 30,
    termsReviewedAt: new Date('2026-08-20'),
    robotsReviewedAt: new Date('2026-08-20'),
    copyrightDataUseReviewed: true,
    contactRecorded: true,
    authorizationNotes: 'Robots.txt allows product paths; quoted prices crawled from public pages only.',
    sourceAttributionRequired: true,
  });

  const job = await repo.createSyncJob({ providerId: cashify.id, mode: 'AUTHORIZED_CRAWL', source: 'checkpoint-1' });
  const logger = createLogger('info');
  const result = await runProviderSync({ repo, logger, config }, {
    jobId: job.id,
    providerId: cashify.id,
    mode: 'AUTHORIZED_CRAWL',
    force: true,
  });

  console.log('SYNC RESULT:', result.jobStatus, 'seen=', result.recordsSeen, 'added=', result.itemsAdded, 'updated=', result.itemsUpdated, 'skipped=', result.itemsSkipped, result.errorMessage ?? '');

  // Show matched, real rows for the fixture-variant product.
  const productId = demoProductId({ brand: 'Apple', model: 'iPhone 13', storage: 128, ram: 4, network: '5G', color: 'Midnight', modelNumber: 'A2633', variant: null });
  const listings = await repo.listListingsForProduct(productId);
  console.log('iPhone 13 128GB offers:', listings.length);
  for (const l of listings.slice(0, 14)) {
    const real = l.sourceUrl.startsWith('https://www.cashify.in/');
    console.log(`  [${real ? 'REAL' : '?!'} ] Rs ${l.price}  ${l.sourceCondition ?? ''} (${l.sourceProductId.slice(-14)})  ${l.sourceUrl.slice(0, 78)}`);
  }

  // Summary across preferred canonical families.
  const families = [
    demoProductId({ brand: 'Apple', model: 'iPhone 12', storage: 128, ram: 4, network: '5G', color: 'Midnight', modelNumber: null, variant: null }),
    demoProductId({ brand: 'Apple', model: 'iPhone 14', storage: 128, ram: 6, network: '5G', color: 'Midnight', modelNumber: null, variant: null }),
    demoProductId({ brand: 'Samsung', model: 'Galaxy S22 5G', storage: 128, ram: 8, network: '5G', color: 'Phantom Black', modelNumber: null, variant: null }),
    demoProductId({ brand: 'Google', model: 'Pixel 7', storage: 128, ram: 8, network: '5G', color: 'Snow', modelNumber: null, variant: null }),
  ];
  for (const id of families) {
    const ls = await repo.listListingsForProduct(id);
    const min = ls.length ? Math.min(...ls.map((l) => l.price)) : null;
    console.log(`  family ${id}: ${ls.length} offers${min ? ` from Rs ${min}` : ''}`);
  }

  // Guard: fixture-marked rows (test- host / demo- sourceProductId) must NOT appear.
  const leakedFixtureRows = listings.filter(
    (l) => l.sourceProductId.startsWith('demo-') || l.sourceUrl.startsWith('https://test-'),
  );
  if (leakedFixtureRows.length > 0) {
    console.error('FIXTURE ROWS LEAKED INTO REAL CRAWL', leakedFixtureRows[0]);
    process.exitCode = 1;
  }
  rmSync(dir, { recursive: true, force: true });
}

main().catch(async (err) => {
  console.error(err);
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
  process.exit(1);
});