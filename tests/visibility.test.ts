import { describe, it, expect } from 'vitest';
import { visibleInLive } from '@refurbcompare/core';
import type { ListingWithRelations } from '@refurbcompare/core';

function listing(overrides: Partial<Pick<ListingWithRelations, 'sourceProductId'>> & {
  provider?: Partial<NonNullable<ListingWithRelations['provider']>>;
} = {}): ListingWithRelations {
  return {
    id: 'l1',
    productId: 'p1',
    providerId: 'provider_cashify',
    sourceProductId: overrides.sourceProductId ?? 'SKU-1',
    sourceUrl: 'https://example.com/p?sku=SKU-1',
    affiliateUrl: null,
    price: 25000,
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
    consecutiveSyncFailures: 0,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    provider: {
      id: 'provider_cashify',
      name: 'Cashify',
      slug: 'cashify',
      website: 'https://www.cashify.in',
      logoUrl: null,
      mode: 'API',
      status: 'AUTHORIZED',
      active: true,
      trustScore: 82,
      isDemo: false,
      defaultEnabled: false,
      disabledReason: null,
      lastSyncAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides.provider,
    },
  };
}

describe('visibleInLive (production listing visibility)', () => {
  it('shows real active-provider listings in every mode', () => {
    expect(visibleInLive(listing(), 'live')).toBe(true);
    expect(visibleInLive(listing(), 'demo')).toBe(true);
    expect(visibleInLive(listing(), 'mock')).toBe(true);
  });

  it('hides synthetic demo rows in live mode', () => {
    const demo = listing({ sourceProductId: 'demo-cashify-apple-iphone-13-128gb' });
    expect(visibleInLive(demo, 'live')).toBe(false);
    expect(visibleInLive(demo, 'demo')).toBe(true);
  });

  it('hides listings whose provider is flagged demo in live mode', () => {
    const demoProvider = listing({ provider: { isDemo: true, active: true } });
    expect(visibleInLive(demoProvider, 'live')).toBe(false);
    expect(visibleInLive(demoProvider, 'demo')).toBe(true);
  });

  it('hides listings from disabled providers in live mode', () => {
    const disabled = listing({ provider: { active: false, isDemo: false } });
    expect(visibleInLive(disabled, 'live')).toBe(false);
    expect(visibleInLive(disabled, 'demo')).toBe(true);
  });
});