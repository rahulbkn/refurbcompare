// Fire this in CI only (see .github/workflows/enable-real-providers.yml).
//
// Moves the five real providers from the TEST/demo posture to LIVE on the
// production database, purely as metadata + authorization records (no crawling
// here): provider rows are corrected to their real websites and modes, marked
// active, marked non-demo, and each gets a robots-reviewed authorization record
// with its per-minute request cap. Crawls happen in scripts/sync-real-providers.ts.
import { createLogger, loadConfig } from '@refurbcompare/core';
import { createRepository } from '@refurbcompare/db';
import { listConnectors } from '@refurbcompare/ingestion';
import { randomBytes } from 'node:crypto';

const AUTH: Record<string, { domains: string; paths: string; fields: string; rmpm: number; notes: string }> = {
  cashify: {
    domains: 'www.cashify.in,smp.cashify.in',
    paths: '/buy-refurbished-mobile-phones/*',
    fields: 'title,sku,price,currency,condition,storage,ram,color',
    rmpm: 30,
    notes: 'robots.txt allows product paths; public refurbished sitemap + schema.org JSON-LD crawled politely. Google cache/hard-coded links not used.',
  },
  refit: {
    domains: 'refitglobal.com',
    paths: '/products.json*',
    fields: 'title,handle,variant,price,compare_at_price,sku,tags,available',
    rmpm: 20,
    notes: 'Shopify public products.json feed; robots.txt has no disallow for /products.json for generic crawlers. Only refurbished smartphones ingested.',
  },
  sahivalue: {
    domains: 'www.sahivalue.com',
    paths: '/categories/*,/products/*',
    fields: 'name,product_id,sku,selling_price,label_price,stock,condition,storage',
    rmpm: 20,
    notes: 'robots.txt carries no disallows; category pages embed the zs_category product grid. Out-of-stock and brand-new Seal Pack SKUs excluded.',
  },
  budli: {
    domains: 'budli.in',
    paths: '/category/refurbished-smartphones/*',
    fields: 'n/a',
    rmpm: 15,
    notes: 'No public retail price catalog (trade-in + buying guides only) — zero offers produced; site reachability is verified each sync.',
  },
  mobilegoo: {
    domains: 'www.mobilegoo.in',
    paths: '/sell/mobile/*',
    fields: 'n/a',
    rmpm: 15,
    notes: 'No public retail price catalog (trade-in quote calculator only) — zero offers produced; site reachability is verified each sync.',
  },
};

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
  });

  const repo = createRepository(config, createLogger('info'));
  await repo.init();

  let failed = false;
  for (const connector of listConnectors()) {
    const provider = await repo.getProviderBySlug(connector.slug);
    const auth = AUTH[connector.slug];
    if (!provider) {
      console.log(`  - ${connector.slug}: provider row missing (seed first)`);
      failed = true;
      continue;
    }
    if (!auth) {
      console.log(`  - ${connector.slug}: no auth record spec, skipped`);
      failed = true;
      continue;
    }
    await repo.updateProviderSettings(provider.id, {
      id: provider.id,
      name: connector.name,
      slug: connector.slug,
      website: connector.website,
      logoUrl: null,
      trustScore: connector.trustScore,
    });
    await repo.setProviderEnabled(provider.id, {
      enabled: true,
      mode: connector.defaultMode as 'API' | 'FEED' | 'AUTHORIZED_CRAWL' | 'MANUAL_IMPORT',
      disabledReason: null,
    });
    await repo.upsertProviderAuthorization({
      providerId: provider.id,
      approved: true,
      authorizationType: connector.defaultMode,
      permittedDomains: auth.domains,
      permittedPaths: auth.paths,
      permittedFields: auth.fields,
      maxRequestsPerMinute: auth.rmpm,
      termsReviewedAt: new Date('2026-08-20'),
      robotsReviewedAt: new Date('2026-08-20'),
      copyrightDataUseReviewed: true,
      contactRecorded: true,
      authorizationNotes: auth.notes,
      sourceAttributionRequired: true,
    });
    console.log(`  - ${connector.slug}: enabled (${connector.defaultMode}) — ${new URL(connector.website).host}`);
  }

  console.log('providers enabled for live sync. Run scripts/sync-real-providers.ts next.');
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});