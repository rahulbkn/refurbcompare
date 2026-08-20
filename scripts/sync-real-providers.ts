// Fire this in CI only (see .github/workflows/enable-real-providers.yml).
//
// Runs a REAL (DATA_MODE=live) sync for every enabled provider against the
// production database via the same pipeline used in sandbox, then prints the
// per-family offer counts. Robots-compliant rates come from the authorization
// records; CASHIFY_MAX_PRODUCTS/REFIT_MAX_PAGES/SAHIVALUE_MAX_CATEGORIES envs
// cap the first pass so the job stays inside CI limits (raise them for deeper
// refreshes; the Render scheduler can keep filling gaps at its own pace).
import { createLogger, loadConfig } from '@refurbcompare/core';
import { createRepository, demoProductId } from '@refurbcompare/db';
import { runProviderSync, listConnectors } from '@refurbcompare/ingestion';
import { randomBytes } from 'node:crypto';

async function main() {
  if (!process.env.RENDER_DATABASE_URL) throw new Error('RENDER_DATABASE_URL is required (CI only).');

  // DATA_MODE=live refuses well-known admin keys in config validation.
  const adminApiKey = process.env.ADMIN_API_KEY ?? `ci-${randomBytes(16).toString('hex')}`;

  const config = loadConfig({
    NODE_ENV: 'development',
    DATA_MODE: 'live',
    ADMIN_API_KEY: adminApiKey,
    DATABASE_DRIVER: 'prisma',
    DATABASE_URL: process.env.RENDER_DATABASE_URL,
    QUEUE_DRIVER: 'memory',
    RATE_LIMIT_MAX: '60',
  });

  const repo = createRepository(config, createLogger('info'));
  await repo.init();

  for (const connector of listConnectors()) {
    const provider = await repo.getProviderBySlug(connector.slug);
    if (!provider) continue;
    const job = await repo.createSyncJob({ providerId: provider.id, mode: provider.mode, source: 'ci-real-sync' });
    const started = Date.now();
    const result = await runProviderSync(
      { repo, logger: createLogger('info'), config },
      { jobId: job.id, providerId: provider.id, mode: provider.mode, force: true },
    );
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `- ${connector.slug}: ${result.jobStatus} seen=${result.recordsSeen} added=${result.itemsAdded} skipped=${result.itemsSkipped} (${secs}s)`,
    );
    if (result.errorMessage) console.log(`    ${result.errorMessage}`);
  }

  console.log('\n===== LIVE OFFER COUNTS (canonical families) =====');
  const families = [
    { label: 'iPhone 13 128GB', id: demoProductId({ brand: 'Apple', model: 'iPhone 13', storage: 128, ram: 4, network: '5G', color: 'Midnight', modelNumber: 'A2633', variant: null }) },
    { label: 'iPhone 12 128GB', id: demoProductId({ brand: 'Apple', model: 'iPhone 12', storage: 128, ram: 4, network: '5G', color: 'Midnight', modelNumber: null, variant: null }) },
    { label: 'iPhone 14 128GB', id: demoProductId({ brand: 'Apple', model: 'iPhone 14', storage: 128, ram: 6, network: '5G', color: 'Midnight', modelNumber: null, variant: null }) },
    { label: 'Galaxy S22 5G 128GB', id: demoProductId({ brand: 'Samsung', model: 'Galaxy S22 5G', storage: 128, ram: 8, network: '5G', color: 'Phantom Black', modelNumber: null, variant: null }) },
    { label: 'Pixel 7 128GB', id: demoProductId({ brand: 'Google', model: 'Pixel 7', storage: 128, ram: 8, network: '5G', color: 'Snow', modelNumber: null, variant: null }) },
  ];
  for (const f of families) {
    const ls = (await repo.listListingsForProduct(f.id)).filter((l) => !l.archivedAt);
    const min = ls.length ? Math.min(...ls.map((l) => l.price)) : null;
    const per = new Map<string, number>();
    for (const l of ls) per.set(l.provider?.slug ?? '?', (per.get(l.provider?.slug ?? '?') ?? 0) + 1);
    console.log(`- ${f.label}: ${ls.length} offers best Rs ${min ?? '-'} [${[...per.entries()].map(([p, n]) => `${p}:${n}`).join(', ')}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});