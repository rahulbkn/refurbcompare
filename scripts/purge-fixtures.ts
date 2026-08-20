// Fire this in CI only (hard-deletes TEST/fixture data from the production DB).
//
// The TEST fixture rollout wrote demo-* rows (seedDemoCatalog/seedDemoListings
// via scripts/sync-test-fixtures.ts). Once real live data is synced, this
// removes them completely: price history for demo listings, demo listings, and
// the demo product rows (ids demo-*). Real rows are untouched.
import { getPrismaClient } from '@refurbcompare/db';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required (CI only).');

  const client = getPrismaClient();
  await client.$connect();

  const demoListingIds = await client.listing.findMany({ where: { sourceProductId: { startsWith: 'demo-' } }, select: { id: true } });

  const priceHistory = await client.priceHistoryPoint.deleteMany({
    where: { listingId: { in: demoListingIds.map((l) => l.id) } },
  });
  const listings = await client.listing.deleteMany({ where: { sourceProductId: { startsWith: 'demo-' } } });
  const products = await client.product.deleteMany({ where: { id: { startsWith: 'demo-' } } });
  // Demo listings might also participate in click events; drop those for tidiness.
  if (demoListingIds.length) {
    await client.clickEvent.deleteMany({ where: { listingId: { in: demoListingIds.map((l) => l.id) } } });
  }

  console.log(`price-history rows removed: ${priceHistory.count}`);
  console.log(`demo listings removed:      ${listings.count}`);
  console.log(`demo products removed:      ${products.count}`);
  if (listings.count === 0 && products.count === 0) {
    console.log('Nothing to purge (fixtures already gone).');
  } else {
    console.log('Fixture purge complete.');
  }
  await client.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});