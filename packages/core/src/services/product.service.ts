import type { ProductFilter, Repository } from '../db/repository.js';
import { AppError as AppErr } from '../errors.js';
import type { ServiceContext } from './context.js';
import { visibleInLive } from './visibility.js';

export type { ProductFilter } from '../db/repository.js';

export interface PublicProduct {
  id: string;
  brand: string;
  model: string;
  modelNumber: string | null;
  variant: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  network: string | null;
  slug: string;
  imageUrl: string | null;
  images: string[];
  specifications: Record<string, unknown>;
  bestPrice: number | null;
  bestDiscount: number | null;
  bestRating: number | null;
  bestCondition: string | null;
  listingCount: number;
  url: string;
}

export function toPublicProduct(
  p: Awaited<ReturnType<Repository['listProducts']>>['items'][number],
): PublicProduct {
  return {
    id: p.id,
    brand: p.brand,
    model: p.model,
    modelNumber: p.modelNumber,
    variant: p.variant,
    storage: p.storage,
    ram: p.ram,
    color: p.color,
    network: p.network,
    slug: p.slug,
    imageUrl: p.imageUrl,
    images: p.images,
    specifications: p.specifications,
    bestPrice: p.bestPrice,
    bestDiscount: p.bestDiscount,
    bestRating: p.bestRating,
    bestCondition: p.bestCondition,
    listingCount: p.listingCount,
    url: `/product/${p.slug}`,
  };
}

export function createProductService(ctx: ServiceContext) {
  const { repo } = ctx;
  const liveVisibleOnly = ctx.config.dataMode === 'live';

  async function listProducts(filter: ProductFilter): Promise<{ items: PublicProduct[]; total: number }> {
    const result = await repo.listProducts({ ...filter, liveVisibleOnly });
    return { items: result.items.map(toPublicProduct), total: result.total };
  }

  async function getProduct(slugOrId: string): Promise<PublicProduct> {
    const product = /^prod_/.test(slugOrId)
      ? await repo.getProductById(slugOrId, { liveVisibleOnly })
      : await repo.getProductBySlug(slugOrId, { liveVisibleOnly });
    if (!product) throw AppErr.notFound('Product not found');
    return toPublicProduct(product);
  }

  async function getBrandCounts(): Promise<Array<{ brand: string; count: number }>> {
    return repo.brandCounts();
  }

  async function bestPriceForProduct(productId: string): Promise<number | null> {
    const listings = (await repo.listListingsForProduct(productId)).filter((l) => visibleInLive(l, ctx.config.dataMode));
    const prices = listings.filter((l) => l.stockStatus === 'IN_STOCK').map((l) => l.price);
    return prices.length > 0 ? Math.min(...prices) : null;
  }

  return { listProducts, getProduct, getBrandCounts, bestPriceForProduct };
}

export type ProductService = ReturnType<typeof createProductService>;