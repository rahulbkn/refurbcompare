// Fire this in CI only (see .github/workflows/sync-test-fixtures.yml).
//
// Ingests the 5-provider TEST fixtures (Cashify, Budli, ReFit Global, SahiValue,
// MobileGoo) into the configured database — in CI that is the Render Postgres via
// RENDER_DATABASE_URL and @refurbcompare/db's Prisma repository.
//
// Forces DATA_MODE=demo / prisma so TEST rows never cross a live guard, then
// asserts the pinned iPhone 13 128GB ladder landed for all 5 sellers.
import { createLogger, loadConfig } from '@refurbcompare/core';
import { createRepository, demoProductId, seedDemoCatalog, seedDemoListings } from '@refurbcompare/db';

const LADDER: ReadonlyArray<[string, number]> = [
  ['cashify', 26799],
  ['budli', 27199],
  ['refit', 27599],
  ['sahivalue', 27999],
  ['mobilegoo', 28499],
];

async function main() {
  if (!process.env.RENDER_DATABASE_URL) {
    throw new Error('RENDER_DATABASE_URL is required (CI only).');
  }

  const config = loadConfig({
    NODE_ENV: 'development',
    DATA_MODE: 'demo',
    DATABASE_DRIVER: 'prisma',
    DATABASE_URL: process.env.RENDER_DATABASE_URL,
    QUEUE_DRIVER: 'memory',
  });

  const repo = createRepository(config, createLogger('info'));
  await repo.init();

  await seedDemoCatalog(repo);
  const added = await seedDemoListings(repo);

  const providers = await repo.listProviders();
  const providersBySlug = new Map(providers.map((p) => [p.slug, p]));
  const productId = demoProductId({ brand: 'Apple', model: 'iPhone 13', storage: 128, color: 'Midnight', ram: 4, network: '5G', modelNumber: 'A2633', variant: null });
  const listings = (await repo.listListingsForProduct(productId)).filter((l) => !l.archivedAt);
  const prices = new Map<string, number>();
  let failed = false;
  for (const l of listings) {
    if (!l.provider) continue;
    if (!l.sourceUrl.startsWith(`https://test-${l.provider.slug}.refurbcompare.in/`)) {
      console.log(`  -> non-TEST url for ${l.provider.slug}: ${l.sourceUrl}`);
      failed = true;
    }
    if (l.stockStatus !== 'IN_STOCK') {
      console.log(`  -> fixture variant not in stock for ${l.provider.slug}`);
      failed = true;
    }
    prices.set(l.provider.slug, l.price);
  }
  for (const [slug, price] of LADDER) {
    const ok = prices.get(slug) === price;
    if (!ok) failed = true;
    console.log(`${ok ? 'OK ' : 'MISMATCH'} ${slug.padEnd(10)} ${price}   db=${prices.get(slug) ?? 'missing'}`);
    if (!providersBySlug.has(slug)) {
      console.log(`  -> provider row for ${slug} missing`);
      failed = true;
    }
  }
  console.log(`total listings ingested: ${added}`);
  console.log(`iPhone 13 128GB offers:  ${listings.length} (expect 5)`);
  console.log(`providers in DB:          ${providers.length} (expect 5)`);

  if (failed || listings.length !== 5 || providers.length !== 5) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});