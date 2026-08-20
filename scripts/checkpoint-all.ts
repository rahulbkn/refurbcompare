// REAL DATA SANDBOX — runs the 5 real connectors through the live pipeline
// against a LOCAL throwaway sqlite DB (never production). DATA_MODE=live is
// LOCAL ONLY (NODE_ENV=test + sqlite): it switches the pipeline onto the real
// liveFetch paths. Nothing crosses to the Render Postgres.
//
// Each provider is authorized with its own robots-reviewed record and rate
// cap, then synced. Budli/MobileGoo publish no retail price catalog, so they
// legitimately produce zero offers (documented in their authorization notes).
import { createLogger, loadConfig } from '@refurbcompare/core';
import { SqliteRepository, demoProductId, seedDemoCatalog } from '@refurbcompare/db';
import { runProviderSync, listConnectors, type ProviderConnector } from '@refurbcompare/ingestion';
import { mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(homedir(), '.cache', 'opencode', 'tmp', 'rc-real-'));
const dbUrl = `file:${join(dir, 'real.db')}`;

interface AuthSpec {
  domains: string;
  paths: string;
  fields: string;
  maxRequestsPerMinute: number;
  notes: string;
}

const AUTH: Record<string, AuthSpec> = {
  cashify: {
    domains: 'www.cashify.in,smp.cashify.in',
    paths: '/buy-refurbished-mobile-phones/*',
    fields: 'title,sku,price,currency,condition,storage,ram,color',
    maxRequestsPerMinute: 30,
    notes: 'Robots.txt allows product paths. Public sitemap + JSON-LD would be crawled.',
  },
  refit: {
    domains: 'refitglobal.com',
    paths: '/products.json*',
    fields: 'title,handle,variant,price,compare_at_price,sku,tags',
    maxRequestsPerMinute: 20,
    notes: 'Shopify public products.json feed; robots.txt does not disallow the path.',
  },
  sahivalue: {
    domains: 'www.sahivalue.com',
    paths: '/categories/*,/products/*',
    fields: 'name,product_id,sku,selling_price,label_price,stock,condition,storage',
    maxRequestsPerMinute: 20,
    notes: 'Robots.txt carries no disallows; category pages embed zs_category JSON.',
  },
  budli: {
    domains: 'budli.in',
    paths: '/category/refurbished-smartphones/*',
    fields: 'n/a',
    maxRequestsPerMinute: 15,
    notes: 'No public retail price catalog (trade-in/guides only). Zero offers produced.',
  },
  mobilegoo: {
    domains: 'www.mobilegoo.in',
    paths: '/sell/mobile/*',
    fields: 'n/a',
    maxRequestsPerMinute: 15,
    notes: 'No public retail price catalog (trade-in quotes only). Zero offers produced.',
  },
};

async function main() {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATA_MODE: 'live',
    DATABASE_DRIVER: 'sqlite',
    DATABASE_URL: dbUrl,
    QUEUE_DRIVER: 'memory',
    ADMIN_API_KEY: 'cp-all-local-key',
    RATE_LIMIT_MAX: '1000',
  });

  const repo = new SqliteRepository(dbUrl);
  await repo.init();
  await seedDemoCatalog(repo);
  const logger = createLogger('info');

  const connectors = listConnectors();
  for (const connector of connectors) {
    const auth = AUTH[connector.slug];
    if (!auth) {
      console.error(`- ${connector.slug}: no auth spec, skipped`);
      continue;
    }
    const provider = await repo.getProviderBySlug(connector.slug);
    if (!provider) {
      console.error(`- ${connector.slug}: provider row missing from seed catalog`);
      continue;
    }
    await repo.setProviderEnabled(provider.id, {
      enabled: true,
      mode: connector.defaultMode as 'API' | 'FEED' | 'AUTHORIZED_CRAWL' | 'MANUAL_IMPORT',
    });
    await repo.upsertProviderAuthorization({
      providerId: provider.id,
      approved: true,
      authorizationType: connector.defaultMode!,
      permittedDomains: auth.domains,
      permittedPaths: auth.paths,
      permittedFields: auth.fields,
      maxRequestsPerMinute: auth.maxRequestsPerMinute,
      termsReviewedAt: new Date('2026-08-20'),
      robotsReviewedAt: new Date('2026-08-20'),
      copyrightDataUseReviewed: true,
      contactRecorded: true,
      authorizationNotes: auth.notes,
      sourceAttributionRequired: true,
    });
  }

  console.log('\n========== SYNCING ALL REAL CONNECTORS ==========\n');
  for (const connector of connectors) {
    const provider = await repo.getProviderBySlug(connector.slug);
    if (!provider) continue;
    const job = await repo.createSyncJob({ providerId: provider.id, mode: connector.defaultMode!, source: 'checkpoint-all' });
    const started = Date.now();
    const result = await runProviderSync({ repo, logger, config }, {
      jobId: job.id,
      providerId: provider.id,
      mode: connector.defaultMode!,
      force: true,
    });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `- ${connector.slug}: ${result.jobStatus} seen=${result.recordsSeen} added=${result.itemsAdded} skipped=${result.itemsSkipped} (${secs}s)`,
    );
    if (result.errorMessage) console.log(`    ${result.errorMessage}`);
  }

  console.log('\n========== MATCHED OFFERS PER CANONICAL FAMILY ==========');
  const families: Array<{ label: string; id: string }> = [
    { label: 'iPhone 13 128GB', id: demoProductId({ brand: 'Apple', model: 'iPhone 13', storage: 128, ram: 4, network: '5G', color: 'Midnight', modelNumber: 'A2633', variant: null }) },
    { label: 'iPhone 12 128GB', id: demoProductId({ brand: 'Apple', model: 'iPhone 12', storage: 128, ram: 4, network: '5G', color: 'Midnight', modelNumber: null, variant: null }) },
    { label: 'iPhone 14 128GB', id: demoProductId({ brand: 'Apple', model: 'iPhone 14', storage: 128, ram: 6, network: '5G', color: 'Midnight', modelNumber: null, variant: null }) },
    { label: 'Galaxy S22 5G 128GB', id: demoProductId({ brand: 'Samsung', model: 'Galaxy S22 5G', storage: 128, ram: 8, network: '5G', color: 'Phantom Black', modelNumber: null, variant: null }) },
    { label: 'Pixel 7 128GB', id: demoProductId({ brand: 'Google', model: 'Pixel 7', storage: 128, ram: 8, network: '5G', color: 'Snow', modelNumber: null, variant: null }) },
  ];
  let leaked = 0;
  for (const f of families) {
    const ls = await repo.listListingsForProduct(f.id);
    const byProvider = new Map<string, number>();
    let min: number | null = null;
    let minUrl = '';
    for (const l of ls) {
      byProvider.set(l.provider?.slug ?? '?', (byProvider.get(l.provider?.slug ?? '?') ?? 0) + 1);
      if (min === null || l.price < min) {
        min = l.price;
        minUrl = l.sourceUrl;
      }
      if (l.sourceProductId.startsWith('demo-') || l.sourceUrl.startsWith('https://test-')) leaked += 1;
    }
    const per = [...byProvider.entries()].map(([p, n]) => `${p}:${n}`).join(', ');
    console.log(`- ${f.label}: ${ls.length} offers  (best Rs ${min ?? '-'}  ${per})`);
    if (minUrl) console.log(`    best: ${minUrl.slice(0, 110)}`);
  }
  if (leaked > 0) {
    console.error(`FIXTURE ROWS LEAKED: ${leaked}`);
    process.exitCode = 1;
  } else {
    console.log('No fixture rows leaked. Exit 0.');
  }

  rmSync(dir, { recursive: true, force: true });
}

main().catch(async (err) => {
  console.error(err);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  process.exit(1);
});