import type { ListingWithRelations } from '../types/models.js';
import { AppError as AppErr } from '../errors.js';
import {
  computeComparisonStats,
  rankOffers,
  type ComparisonStats,
  type ListingScore,
} from '../scoring/index.js';
import type { ServiceContext } from './context.js';
import type { Repository } from '../db/repository.js';
import { visibleInLive } from './visibility.js';

export interface PublicOffer extends ListingWithRelations {
  valueScore: number | null;
  scoreBreakdown: ListingScore | null;
  isBestValue: boolean;
}

export interface ProductComparison {
  productId: string;
  productSlug: string;
  offers: PublicOffer[];
  stats: ComparisonStats;
  scores: ListingScore[];
}

function toPublicOffer(listing: ListingWithRelations, bestValueId: string | null): PublicOffer {
  return {
    ...listing,
    valueScore: null,
    scoreBreakdown: null,
    isBestValue: listing.id === bestValueId,
  };
}

export function createOffersService(ctx: ServiceContext) {
  const { repo } = ctx;

  async function compareProduct(productId: string, includeArchived = false): Promise<ProductComparison> {
    const all = await repo.listListingsForProduct(productId, includeArchived);
    const listings = all.filter((l) => visibleInLive(l, ctx.config.dataMode));
    const ranked = rankOffers(listings);
    const stats = computeComparisonStats(listings, ranked);
    const scoreById = new Map(ranked.map((s) => [s.listingId, s]));

    const offers: PublicOffer[] = listings.map((listing) => {
      const row = toPublicOffer(listing, stats.bestValueListingId);
      const score = scoreById.get(listing.id);
      if (score) {
        row.valueScore = score.total;
        row.scoreBreakdown = score;
      }
      return row;
    });

    const product = await repo.getProductById(productId);
    if (!product) throw AppErr.notFound('Product not found');

    return {
      productId,
      productSlug: product.slug,
      offers,
      stats,
      scores: ranked,
    };
  }

  async function getListing(listingId: string): Promise<ListingWithRelations> {
    const listing = await repo.getListingById(listingId);
    if (!listing) throw AppErr.notFound('Listing not found');
    return listing;
  }

  async function topDeals(limit: number): Promise<PublicOffer[]>;
  async function topDeals(limit: number, productId?: string): Promise<PublicOffer[]> {
    const active = await repo.listActiveListings();
    const scope = active
      .filter((l) => visibleInLive(l, ctx.config.dataMode))
      .filter((l) => (productId ? l.productId === productId : true));

    const byProduct = new Map<string, ListingWithRelations[]>();
    for (const listing of scope) {
      const group = byProduct.get(listing.productId) ?? [];
      group.push(listing);
      byProduct.set(listing.productId, group);
    }

    const deals: PublicOffer[] = [];
    for (const [, group] of byProduct) {
      const scores = rankOffers(group);
      const best = scores[0];
      const bestListing = best ? group.find((l) => l.id === best.listingId) : undefined;
      if (!best || !bestListing) continue;
      const profit =
        bestListing.originalPrice != null && bestListing.originalPrice > bestListing.price
          ? Math.round((1 - bestListing.price / bestListing.originalPrice) * 100)
          : 0;
      if (profit <= 0) continue;
      deals.push({
        ...toPublicOffer(bestListing, best.listingId),
        valueScore: best.total,
        scoreBreakdown: best,
      });
    }

    return deals
      .sort((a, b) => (b.originalPrice ?? 0) - (a.originalPrice ?? 0))
      .slice(0, limit);
  }

  return { compareProduct, getListing, topDeals };
}

export type OffersService = ReturnType<typeof createOffersService>;
export type { Repository as OffersRepository };