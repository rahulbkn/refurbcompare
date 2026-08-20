import { describe, it, expect } from 'vitest';
import { scoreListing, rankOffers, computeComparisonStats } from '@refurbcompare/core';
import type { ListingWithRelations } from '@refurbcompare/core';

const BASE: ListingWithRelations = {
  id: 'listing_a',
  productId: 'prod_x',
  providerId: 'provider_cashify',
  sourceProductId: 'x-1',
  sourceUrl: 'https://cashify.in/x',
  affiliateUrl: null,
  price: 30000,
  originalPrice: 40000,
  discount: 10000,
  normalizedCondition: 'EXCELLENT',
  sourceCondition: 'Excellent',
  conditionScore: 90,
  conditionDescription: null,
  warrantyMonths: 6,
  returnDays: 7,
  batteryHealth: 90,
  stockStatus: 'IN_STOCK',
  deliveryEstimate: null,
  sellerName: 'Cashify',
  sellerRating: 4.6,
  lastCheckedAt: new Date(),
  priceUpdatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  consecutiveSyncFailures: 0,
  product: {
    id: 'prod_x',
    brand: 'Apple',
    model: 'iPhone 13',
    slug: 'apple-iphone-13-128gb',
  },
  provider: {
    id: 'provider_cashify',
    name: 'Cashify',
    slug: 'cashify',
    trustScore: 50,
  },
};

function listing(id: string, patch: Partial<ListingWithRelations>): ListingWithRelations {
  return { ...BASE, id, ...patch } as ListingWithRelations;
}

describe('scoreListing', () => {
  it('scores a cheap, well-rated, in-stock listing highly (0..1 scale)', () => {
    const score = scoreListing(BASE, 40000);
    expect(score.total).toBeGreaterThan(0.6);
    expect(score.total).toBeLessThanOrEqual(1);
    expect(score.components.length).toBe(6);
  });

  it('scores an overpriced listing lower than a cheaper peer', () => {
    const cheap = scoreListing(listing('a', { price: 30000 }), 40000);
    const expensive = scoreListing(listing('b', { price: 50000 }), 40000);
    expect(cheap.total).toBeGreaterThan(expensive.total);
  });

  it('penalizes missing warranty, returns and battery disclosure', () => {
    const bare = listing('c', { warrantyMonths: 0, returnDays: 0, batteryHealth: null, conditionScore: 40 });
    const score = scoreListing(bare, 40000);
    const battery = score.components.find((c) => c.raw === null);
    expect(battery?.score).toBe(50);
    expect(score.total).toBeLessThan(scoreListing(BASE, 40000).total);
  });

  it('generates human-readable reasons', () => {
    const score = scoreListing(BASE, 40000);
    expect(score.reasons.length).toBeGreaterThan(0);
  });
});

describe('rankOffers', () => {
  it('ranks in-stock offers best-first and skips out-of-stock', () => {
    const offers = [
      listing('cheap', { price: 30000, sellerRating: 4.8, warrantyMonths: 12, returnDays: 30 }),
      listing('expensive', { price: 60000, sellerRating: 3.0, warrantyMonths: 0 }),
      listing('oos', { price: 20000, stockStatus: 'OUT_OF_STOCK' }),
    ];
    const ranked = rankOffers(offers);
    expect(ranked.length).toBe(2);
    expect(ranked[0]?.total).toBeGreaterThanOrEqual(ranked[1]?.total ?? 0);
    expect(ranked[0]?.listingId).toBe('cheap');
  });
});

describe('computeComparisonStats', () => {
  it('derives price spread, seller count and best picks', () => {
    const offers = [
      listing('a', { price: 30000, warrantyMonths: 6, conditionScore: 90, sellerRating: 4.8 }),
      listing('b', { price: 36000, warrantyMonths: 12, conditionScore: 75, sellerRating: 4.0 }),
    ];
    const scores = rankOffers(offers);
    const stats = computeComparisonStats(offers, scores);
    expect(stats.lowestPrice).toBe(30000);
    expect(stats.highestPrice).toBe(36000);
    expect(stats.averagePrice).toBe(33000);
    expect(stats.priceDifference).toBe(6000);
    expect(stats.sellerCount).toBe(1);
    expect(stats.bestValueListingId).toBe(scores[0]?.listingId);
    expect(stats.bestWarrantyListingId).toBe('b');
    expect(stats.bestConditionListingId).toBe('a');
  });

  it('handles a single listing gracefully', () => {
    const stats = computeComparisonStats([listing('a', { price: 30000 })], rankOffers([listing('a', { price: 30000 })]));
    expect(stats.averagePrice).toBe(30000);
    expect(stats.bestPriceListingId).toBeNull();
  });
});