import type { ListingDto } from "@/lib/repo/types";

export interface ComparisonOffer {
  listingId: string;
  sellerName: string;
  price: number;
  targetUrl: string;
  stockStatus: ListingDto["stockStatus"];
}

export interface ComparisonGroup {
  condition: string;
  offers: ComparisonOffer[];
  best: ComparisonOffer | null;
}

/**
 * Build the condition-grouped comparison for one product.
 *
 * ONE ROW = ONE CONDITION. Within a row each provider contributes at most one
 * offer — its cheapest LIVE in-stock listing for that condition — with the
 * exact listing id and Buy URL preserved. Providers without a live offer in
 * that condition are simply absent from the row (rendered as "—"). Underlying
 * listings are never filtered out of the data layer; this only shapes the
 * comparison view.
 */
export function buildComparisonGroups(listings: ListingDto[]): {
  groups: ComparisonGroup[];
  sellers: string[];
} {
  const live = listings.filter((l) => l.inStock);

  const byCondition = new Map<string, ListingDto[]>();
  for (const listing of live) {
    const key = listing.condition?.trim() || "Refurbished";
    const bucket = byCondition.get(key) ?? [];
    bucket.push(listing);
    byCondition.set(key, bucket);
  }

  const sellerOrder: string[] = [];
  for (const bucket of byCondition.values()) {
    for (const listing of bucket) {
      const name = listing.seller?.name ?? "Unknown";
      if (!sellerOrder.includes(name)) sellerOrder.push(name);
    }
  }

  const groups: ComparisonGroup[] = [...byCondition.entries()].map(([condition, bucket]) => {
    const cheapestBySeller = new Map<string, ComparisonOffer>();
    for (const listing of bucket) {
      const sellerName = listing.seller?.name ?? "Unknown";
      const offer: ComparisonOffer = {
        listingId: listing.id,
        sellerName,
        price: listing.price,
        targetUrl: listing.targetUrl,
        stockStatus: listing.stockStatus,
      };
      const current = cheapestBySeller.get(sellerName);
      if (!current || offer.price < current.price) cheapestBySeller.set(sellerName, offer);
    }
    const offers = [...cheapestBySeller.values()].sort((a, b) => a.price - b.price);
    return { condition, offers, best: offers[0] ?? null };
  });

  groups.sort((a, b) => (a.best?.price ?? Infinity) - (b.best?.price ?? Infinity));
  return { groups, sellers: sellerOrder };
}
