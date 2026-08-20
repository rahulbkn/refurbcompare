import { AppError as AppErr } from '../errors.js';
import type { ServiceContext } from './context.js';
import { visibleInLive } from './visibility.js';

export interface PriceHistoryResult {
  productId: string;
  productSlug: string;
  productName: string;
  days: number;
  points: Array<{ date: string; price: number }>;
  currentBestPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  lowestDate: string | null;
  highestDate: string | null;
}

export function createPriceHistoryService(ctx: ServiceContext) {
  const { repo } = ctx;

  async function getHistory(productId: string, days = 90): Promise<PriceHistoryResult> {
    const product = await repo.getProductById(productId);
    if (!product) throw AppErr.notFound('Product not found');

    const points = await repo.getPriceHistory(productId, days);
    const prices = points.map((p) => p.price);

    const lowest = prices.length > 0 ? Math.min(...prices) : null;
    const highest = prices.length > 0 ? Math.max(...prices) : null;
    const lowestPoint = lowest !== null ? points.find((p) => p.price === lowest) : undefined;
    const highestPoint = highest !== null ? points.find((p) => p.price === highest) : undefined;

    const listings = (await repo.listListingsForProduct(productId)).filter((l) => visibleInLive(l, ctx.config.dataMode));
    const inStockPrices = listings.filter((l) => l.stockStatus === 'IN_STOCK').map((l) => l.price);
    const currentBestPrice = inStockPrices.length > 0 ? Math.min(...inStockPrices) : null;

    return {
      productId: product.id,
      productSlug: product.slug,
      productName: `${product.brand} ${product.model}`,
      days,
      points,
      currentBestPrice,
      lowestPrice: lowest,
      highestPrice: highest,
      lowestDate: lowestPoint?.date ?? null,
      highestDate: highestPoint?.date ?? null,
    };
  }

  return { getHistory };
}

export type PriceHistoryService = ReturnType<typeof createPriceHistoryService>;