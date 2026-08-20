import { conditionScore } from "./condition-mapping";

export type OfferInput = {
  price: number;
  originalPrice?: number | null;
  condition?: string | null;
  sellerRating?: number | null;
  inStock: boolean;
  // distribution context (computed by rankOffers)
  avgPrice?: number;
};

export type ScoredOffer = {
  valueScore: number; // 0..100, higher = better deal
  savings: number;
  savingsPct: number;
  conditionScore: number;
  priceRatio: number; // offer price / reference price (1 = market par)
};

/**
 * Score a single offer on a 0..100 scale.
 *
 * Weights are tuned for refurbished electronics where condition and cash
 * savings matter more than tiny price deltas between sellers:
 *   price (vs market average) .. 50
 *   condition grade ............. 30
 *   seller rating ............... 15
 *   stock availability ..........  5
 */
export function scoreOffer(offer: OfferInput): ScoredOffer {
  const avg = offer.avgPrice ?? offer.originalPrice ?? offer.price;

  const priceRatio = avg > 0 ? offer.price / avg : 1;
  // cheaper than average → higher score
  const priceScore = 50 * (priceRatio >= 1 ? 1 / priceRatio : 2 - priceRatio);
  const clampedPriceScore = Math.max(0, Math.min(50, priceScore));

  const condition = conditionScore(offer.condition);
  const conditionScorePart = (condition / 3) * 30;

  const rating = offer.sellerRating ?? 0;
  const ratingScore = (Math.max(0, Math.min(5, rating)) / 5) * 15;

  const stockScore = offer.inStock ? 5 : 0;

  const valueScore = Math.round(
    clampedPriceScore + conditionScorePart + ratingScore + stockScore,
  );

  const savings = Math.max(0, (offer.originalPrice ?? offer.price) - offer.price);
  const savingsPct =
    (offer.originalPrice ?? offer.price) > 0
      ? Math.round(((offer.originalPrice ?? offer.price) - offer.price) / (offer.originalPrice ?? offer.price) * 100)
      : 0;

  return {
    valueScore: Math.max(0, Math.min(100, valueScore)),
    savings,
    savingsPct: Math.max(0, savingsPct),
    conditionScore: condition,
    priceRatio,
  };
}

/** Rank a list of offers by value. Mutates a copy and returns best-first. */
export function rankOffers<T extends OfferInput>(offers: T[]): T[] {
  return [...offers]
    .map((offer) => ({ offer, scored: scoreOffer(offer) }))
    .sort((a, b) => b.scored.valueScore - a.scored.valueScore)
    .map(({ offer }) => offer);
}