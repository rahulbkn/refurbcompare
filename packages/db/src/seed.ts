import type { NormalizedCondition, Repository } from '@refurbcompare/core';
import { CONDITION_SCORES, stableId } from '@refurbcompare/core';
import {
  DEMO_PRODUCTS,
  DEMO_PROVIDERS,
  buildDemoProviderProducts,
  type DemoProductSpec,
} from './seed-data.js';

export function demoProductId(spec: DemoProductSpec): string {
  return stableId('prod', slugFor(spec));
}

export function demoProviderId(slug: string): string {
  return stableId('provider', slug);
}

export function slugFor(spec: DemoProductSpec): string {
  return `${spec.brand}-${spec.model}-${spec.storage}gb`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function demoCondition(raw: string | null | undefined): NormalizedCondition {
  const value = (raw ?? 'UNKNOWN').toUpperCase().replace(/[^A-Z_]/g, '_');
  if (['LIKE_NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'REFURBISHED', 'PRE_OWNED', 'UNKNOWN'].includes(value)) {
    return value as NormalizedCondition;
  }
  return 'UNKNOWN';
}

/** Upserts the 10 demo products + 5 demo providers (disabled by default). */
export async function seedDemoCatalog(repo: Repository): Promise<void> {
  for (const spec of DEMO_PRODUCTS) {
    await repo.upsertProduct({
      id: demoProductId(spec),
      brand: spec.brand,
      model: spec.model,
      modelNumber: spec.modelNumber,
      variant: spec.variant,
      storage: spec.storage,
      ram: spec.ram,
      color: spec.color,
      network: spec.network,
      slug: slugFor(spec),
      imageUrl: null,
      images: [],
      specifications: {
        brand: spec.brand,
        model: spec.model,
        storage: spec.storage,
        ram: spec.ram,
        network: spec.network,
      },
      matchingConfidence: 1,
      matchingMethod: 'MANUAL',
    });
  }

  for (const provider of DEMO_PROVIDERS) {
    await repo.upsertProviderSettings({
      id: demoProviderId(provider.slug),
      name: provider.name,
      slug: provider.slug,
      website: provider.website,
      logoUrl: null,
      trustScore: provider.trustScore,
    });
    await repo.setProviderEnabled(demoProviderId(provider.slug), {
      enabled: false,
      disabledReason: `Demo ${provider.integrationType.toLowerCase()} connector. Enable only in a sandbox with SYNC_MOCK_PROVIDER=true; real traffic requires a completed authorization record.`,
    });
  }
}

/** Builds and upserts demo listings for the given provider slugs. */
export async function seedDemoListings(repo: Repository, providerSlugs: string[] = DEMO_PROVIDERS.map((p) => p.slug)): Promise<number> {
  let added = 0;
  const nowForListening = new Date();
  for (const slug of providerSlugs) {
    const raw = buildDemoProviderProducts(slug);
    for (const item of raw) {
      const spec = DEMO_PRODUCTS.find(
        (d) =>
          d.brand === item.brand &&
          d.model === item.model &&
          d.storage === item.storageGB &&
          d.ram === item.ramGB,
      );
      if (!spec) continue;
      const normalizedCondition = demoCondition(item.condition);
      const result = await repo.upsertListing({
        id: stableId('listing', item.sourceProductId),
        productId: demoProductId(spec),
        providerId: demoProviderId(slug),
        sourceProductId: item.sourceProductId,
        sourceUrl: item.url,
        affiliateUrl: null,
        price: item.price,
        originalPrice: item.originalPrice ?? null,
        discount:
          item.originalPrice != null && item.originalPrice > item.price
            ? item.originalPrice - item.price
            : null,
        normalizedCondition,
        sourceCondition: item.condition ?? null,
        conditionScore: CONDITION_SCORES[normalizedCondition],
        conditionDescription: null,
        warrantyMonths: item.warrantyMonths ?? 0,
        returnDays: item.returnDays ?? 0,
        batteryHealth: item.batteryHealth ?? null,
        stockStatus: item.stockStatus ?? 'IN_STOCK',
        deliveryEstimate: null,
        sellerName: item.sellerName ?? '',
        sellerRating: item.sellerRating ?? null,
        lastCheckedAt: nowForListening,
        priceUpdatedAt: nowForListening,
      });
      if (result.status === 'added') added += 1;
    }
  }
  return added;
}

export function demoProviderSlugs(): string[] {
  return DEMO_PROVIDERS.map((p) => p.slug);
}