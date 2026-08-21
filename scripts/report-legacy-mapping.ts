// READ-ONLY. Fires in CI only. Produces the BEFORE report and the
// legacy → replacement candidate mapping WITHOUT touching any row.
//
// Mapping rule: re-derive each product's canonical identity from its own
// stored brand+model using the CURRENT parser; if that yields a different,
// existing product, record the candidate pair plus strict compatibility
// checks (brand, model line, storage, RAM). Nothing here mutates data.
import { createLogger, loadConfig } from '@refurbcompare/core';
import { deriveCanonicalProduct, stableId } from '@refurbcompare/core';
import { getPrismaClient } from '@refurbcompare/db';

interface Row {
  id: string;
  slug: string;
  brand: string;
  model: string;
  variant: string | null;
  storage: number | null;
  ram: number | null;
  imageUrl: string | null;
  matchingMethod: string;
  createdAt: Date;
}

async function main() {
  if (!process.env.RENDER_DATABASE_URL) throw new Error('RENDER_DATABASE_URL is required (CI only).');
  const config = loadConfig({
    NODE_ENV: 'development',
    DATA_MODE: 'live',
    ADMIN_API_KEY: 'unused-read-only',
    DATABASE_DRIVER: 'prisma',
    DATABASE_URL: process.env.RENDER_DATABASE_URL,
    QUEUE_DRIVER: 'memory',
    RATE_LIMIT_MAX: '60',
  });
  const prisma = getPrismaClient(process.env.RENDER_DATABASE_URL);

  const products = (await prisma.product.findMany({
    select: {
      id: true, slug: true, brand: true, model: true, variant: true,
      storage: true, ram: true, imageUrl: true, matchingMethod: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })) as Row[];

  const listingStats = await prisma.listing.groupBy({
    by: ['productId'],
    _count: { _all: true },
    where: { archivedAt: null },
  });
  const liveByProduct = new Map(listingStats.map((s) => [s.productId, s._count._all]));

  const providerRows = await prisma.listing.groupBy({
    by: ['productId', 'providerId'],
    _count: { _all: true },
    where: { archivedAt: null },
  });
  const providersByProduct = new Map<string, string[]>();
  for (const r of providerRows) {
    const list = providersByProduct.get(r.productId) ?? [];
    list.push(r.providerId);
    providersByProduct.set(r.productId, list);
  }

  const historyRows = await prisma.priceHistoryPoint.groupBy({
    by: ['listingId'],
    _count: { _all: true },
  });
  const listings = await prisma.listing.findMany({ select: { id: true, productId: true } });
  const listingToProduct = new Map(listings.map((l) => [l.id, l.productId]));
  const historyByProduct = new Map<string, number>();
  let historyTotal = 0;
  for (const h of historyRows) {
    historyTotal += h._count._all;
    const pid = listingToProduct.get(h.listingId);
    if (pid) historyByProduct.set(pid, (historyByProduct.get(pid) ?? 0) + h._count._all);
  }

  // ---------- BEFORE metrics ----------
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const dupSlugs = products.length - bySlug.size;
  const visible = products.filter((p) => (liveByProduct.get(p.id) ?? 0) > 0);
  const zeroOffer = products.filter((p) => (liveByProduct.get(p.id) ?? 0) === 0);
  const withImage = products.filter((p) => p.imageUrl);

  console.log('=== BEFORE METRICS ===');
  console.log(JSON.stringify({
    totalProducts: products.length,
    visibleProducts: visible.length,
    zeroOfferProducts: zeroOffer.length,
    totalListingsLive: [...liveByProduct.values()].reduce((a, b) => a + b, 0),
    totalPriceHistoryPoints: historyTotal,
    productsWithImage: withImage.length,
    duplicateSlugs: dupSlugs,
  }, null, 2));

  // ---------- mapping candidates ----------
  type Candidate = {
    legacy: Row;
    derived: { slug: string; model: string; storage: number | null; ram: number | null };
    replacement: {
      id: string; slug: string; brand: string; model: string; variant: string | null;
      storage: number | null; ram: number | null; imageUrl: string | null;
      liveListings: number; providers: string[]; historyPoints: number;
    } | null;
    checks: { brandMatch: boolean; modelMatch: boolean; storageCompat: boolean; ramCompat: boolean };
    verdict: 'UNAMBIGUOUS' | 'AMBIGUOUS' | 'NO_REPLACEMENT' | 'SELF';
  };
  const candidates: Candidate[] = [];

  for (const legacy of products) {
    const title = [legacy.brand, legacy.model].filter(Boolean).join(' ').trim();
    const derived = deriveCanonicalProduct(title, {
      storageGB: legacy.storage ?? undefined,
      ramGB: legacy.ram ?? undefined,
    });
    if (!derived) {
      candidates.push({ legacy, derived: null as never, replacement: null, checks: null as never, verdict: 'NO_REPLACEMENT' });
      continue;
    }
    const repSlug = derived.slug;
    if (repSlug === legacy.slug) {
      candidates.push({ legacy, derived, replacement: null, checks: null as never, verdict: 'SELF' });
      continue;
    }
    const replacement =
      (await prisma.product.findUnique({
        where: { slug: repSlug },
        select: {
          id: true, slug: true, brand: true, model: true, variant: true,
          storage: true, ram: true, imageUrl: true,
        },
      })) ?? null;

    const checks = {
      brandMatch: !!replacement && replacement.brand.toLowerCase() === legacy.brand.toLowerCase(),
      modelMatch: !!replacement && replacement.model.toLowerCase() === derived.model.toLowerCase(),
      storageCompat:
        !replacement ||
        legacy.storage === null ||
        replacement.storage === null ||
        legacy.storage === replacement.storage,
      ramCompat:
        !replacement || legacy.ram === null || replacement.ram === null || legacy.ram === replacement.ram,
    };

    const unambiguous = checks.brandMatch && checks.modelMatch && checks.storageCompat && checks.ramCompat;
    candidates.push({
      legacy,
      derived,
      replacement: replacement
        ? {
            ...replacement,
            liveListings: liveByProduct.get(replacement.id) ?? 0,
            providers: providersByProduct.get(replacement.id) ?? [],
            historyPoints: historyByProduct.get(replacement.id) ?? 0,
          }
        : null,
      checks,
      verdict: replacement ? (unambiguous ? 'UNAMBIGUOUS' : 'AMBIGUOUS') : 'NO_REPLACEMENT',
    });
  }

  const summary = {
    UNAMBIGUOUS: candidates.filter((c) => c.verdict === 'UNAMBIGUOUS').length,
    AMBIGUOUS: candidates.filter((c) => c.verdict === 'AMBIGUOUS').length,
    NO_REPLACEMENT: candidates.filter((c) => c.verdict === 'NO_REPLACEMENT').length,
    SELF: candidates.filter((c) => c.verdict === 'SELF').length,
  };
  console.log('=== MAPPING SUMMARY ===');
  console.log(JSON.stringify(summary));

  console.log('=== CANDIDATES (non-SELF) ===');
  for (const c of candidates) {
    if (c.verdict === 'SELF') continue;
    console.log(JSON.stringify(c));
  }

  // Legacy products that still hold live listings (would need repointing).
  const legacyWithListings = candidates.filter(
    (c) => c.verdict === 'UNAMBIGUOUS' && (liveByProduct.get(c.legacy.id) ?? 0) > 0,
  );
  console.log('=== LEGACY STILL HOLDING LIVE LISTINGS ===');
  for (const c of legacyWithListings) {
    console.log(JSON.stringify({
      legacyId: c.legacy.id,
      legacySlug: c.legacy.slug,
      liveListings: liveByProduct.get(c.legacy.id),
      historyPoints: historyByProduct.get(c.legacy.id) ?? 0,
      providers: providersByProduct.get(c.legacy.id) ?? [],
    }));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
