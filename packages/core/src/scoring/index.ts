import type { ListingWithRelations, ProductWithBest } from '../types/models.js';
import { CONDITION_SCORES } from '../normalization/condition.js';

export const SCORING_WEIGHTS = {
  price: 0.35,
  condition: 0.2,
  warranty: 0.15,
  returns: 0.1,
  sellerTrust: 0.1,
  batteryHealth: 0.1,
} as const;

export interface ScoreComponent {
  weight: number;
  raw: number | null;
  score: number; // 0..100
  contribution: number; // 0..1 before weight * 100
  note: string;
}

export interface ListingScore {
  listingId: string;
  total: number; // 0..100
  components: ScoreComponent[];
  reasons: string[];
}

export interface ComparisonStats {
  lowestPrice: number | null;
  highestPrice: number | null;
  averagePrice: number | null;
  priceDifference: number | null;
  sellerCount: number;
  bestPriceListingId: string | null;
  bestValueListingId: string | null;
  bestWarrantyListingId: string | null;
  bestConditionListingId: string | null;
}

function clamp100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Scores a listing for value. Cheaper is better but a listing is never called
 * "best value" purely because it is the cheapest — warranty, condition,
 * returns, seller trust and battery health all matter.
 */
export function scoreListing(listing: ListingWithRelations, avgPrice: number | null): ListingScore {
  const components: ScoreComponent[] = [];

  // Price: 35 — relative to peers in the same comparison set.
  const priceRaw = listing.price;
  let priceScore = 50;
  let priceNote = 'Price is average for comparable listings';
  if (avgPrice !== null && avgPrice > 0) {
    const ratio = priceRaw / avgPrice;
    if (ratio <= 0.85) {
      priceScore = 100;
      priceNote = `Price ${Math.round((1 - ratio) * 100)}% below the average comparable offer`;
    } else if (ratio >= 1.15) {
      priceScore = clamp100(100 - (ratio - 1) * 200);
      priceNote = `Price ${Math.round((ratio - 1) * 100)}% above the average comparable offer`;
    } else {
      priceScore = clamp100(100 - Math.abs(ratio - 1) * 300);
      priceNote = 'Price close to the average comparable offer';
    }
  }
  components.push({
    weight: SCORING_WEIGHTS.price,
    raw: priceRaw,
    score: priceScore,
    contribution: SCORING_WEIGHTS.price * (priceScore / 100),
    note: priceNote,
  });

  // Condition: 20.
  const conditionScore = listing.conditionScore ?? CONDITION_SCORES.UNKNOWN;
  components.push({
    weight: SCORING_WEIGHTS.condition,
    raw: CONDITION_SCORES[listing.normalizedCondition] ?? conditionScore,
    score: clamp100(conditionScore),
    contribution: SCORING_WEIGHTS.condition * (clamp100(conditionScore) / 100),
    note:
      listing.normalizedCondition === 'UNKNOWN'
        ? 'Condition not graded by the seller'
        : `Condition graded: ${listing.normalizedCondition}`,
  });

  // Warranty: 15 — 12 months is the reference target.
  const warrantyScore = clamp100((listing.warrantyMonths / 12) * 100);
  components.push({
    weight: SCORING_WEIGHTS.warranty,
    raw: listing.warrantyMonths,
    score: warrantyScore,
    contribution: SCORING_WEIGHTS.warranty * (warrantyScore / 100),
    note: listing.warrantyMonths > 0 ? `${listing.warrantyMonths} month(s) warranty` : 'No warranty offered',
  });

  // Returns: 10 — 30 days is the reference target.
  const returnScore = clamp100((listing.returnDays / 30) * 100);
  components.push({
    weight: SCORING_WEIGHTS.returns,
    raw: listing.returnDays,
    score: returnScore,
    contribution: SCORING_WEIGHTS.returns * (returnScore / 100),
    note: listing.returnDays > 0 ? `${listing.returnDays} day(s) return window` : 'No return window',
  });

  // Seller trust: 10.
  const trust = listing.sellerRating !== null ? listing.sellerRating * 20 : (listing.provider?.trustScore ?? 50);
  components.push({
    weight: SCORING_WEIGHTS.sellerTrust,
    raw: listing.sellerRating,
    score: clamp100(trust),
    contribution: SCORING_WEIGHTS.sellerTrust * (clamp100(trust) / 100),
    note:
      listing.sellerRating !== null
        ? `Seller rated ${listing.sellerRating.toFixed(1)}/5`
        : `Provider trust score ${listing.provider?.trustScore ?? 50}/100`,
  });

  // Battery health: 10 — neutral 50 when not disclosed.
  const batteryScore = listing.batteryHealth !== null ? listing.batteryHealth : 50;
  components.push({
    weight: SCORING_WEIGHTS.batteryHealth,
    raw: listing.batteryHealth,
    score: clamp100(batteryScore),
    contribution: SCORING_WEIGHTS.batteryHealth * (clamp100(batteryScore) / 100),
    note: listing.batteryHealth !== null ? `Battery health ${listing.batteryHealth}%` : 'Battery health not disclosed',
  });

  const total = components.reduce((sum, c) => sum + c.contribution, 0);

  return {
    listingId: listing.id,
    total: Math.round(total * 100) / 100,
    components,
    reasons: buildReasons(components),
  };
}

function buildReasons(components: ScoreComponent[]): string[] {
  const reasons: string[] = [];
  const top = [...components].sort((a, b) => b.contribution - a.contribution)[0];
  if (!top) return reasons;
  if (top.score >= 85) reasons.push(`Strongest factor: ${top.note}`);
  const weak = components.filter((c) => c.score < 50);
  for (const w of weak.slice(0, 2)) {
    reasons.push(`Weakest factor: ${w.note}`);
  }
  return reasons;
}

/** Compare all in-stock listings for one product and rank them. */
export function rankOffers(listings: ListingWithRelations[]): ListingScore[] {
  const inStock = listings.filter((l) => l.stockStatus === 'IN_STOCK');
  const avg =
    inStock.length > 0
      ? inStock.reduce((sum, l) => sum + l.price, 0) / inStock.length
      : null;
  return inStock.map((l) => scoreListing(l, avg)).sort((a, b) => b.total - a.total);
}

/** Derive headline comparison stats (best value is score-based, never price-only). */
export function computeComparisonStats(
  listings: ListingWithRelations[],
  scores: ListingScore[],
): ComparisonStats {
  const inStock = listings.filter((l) => l.stockStatus === 'IN_STOCK');
  const prices = inStock.map((l) => l.price).sort((a, b) => a - b);

  const cheapest = prices[0] ?? null;
  const mostExpensive = prices[prices.length - 1] ?? null;
  const avg =
    prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null;

  const bestPrice = cheapest !== null ? inStock.find((l) => l.price === cheapest) : undefined;
  const bestValue = scores.length > 0 ? inStock.find((l) => l.id === scores[0]?.listingId) : undefined;
  const bestWarranty = inStock.length > 0 ? [...inStock].sort((a, b) => b.warrantyMonths - a.warrantyMonths)[0] : undefined;
  const bestCondition = inStock.length > 0 ? [...inStock].sort((a, b) => b.conditionScore - a.conditionScore)[0] : undefined;

  return {
    lowestPrice: cheapest,
    highestPrice: mostExpensive,
    averagePrice: avg,
    priceDifference: cheapest !== null && mostExpensive !== null ? mostExpensive - cheapest : null,
    sellerCount: new Set(inStock.map((l) => l.providerId)).size,
    bestPriceListingId: prices.length > 1 ? bestPrice?.id ?? null : null,
    bestValueListingId: bestValue?.id ?? null,
    bestWarrantyListingId: bestWarranty?.id ?? null,
    bestConditionListingId: bestCondition?.id ?? null,
  };
}

export function bestDiscountPercent(product: ProductWithBest | null): number {
  if (!product || product.bestPrice == null || product.bestDiscount == null) return 0;
  return clamp100(product.bestDiscount);
}