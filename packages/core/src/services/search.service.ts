import type { Repository } from '../db/repository.js';
import type { ServiceContext } from './context.js';
import { toPublicProduct, type PublicProduct } from './product.service.js';

export interface SearchResult {
  items: PublicProduct[];
  total: number;
}

export function createSearchService(ctx: ServiceContext) {
  const { repo, logger } = ctx;

  async function search(q: string, page: number, pageSize: number): Promise<SearchResult> {
    const query = q.trim();
    if (!query) return { items: [], total: 0 };

    const result = await repo.listProducts({ query, page, pageSize, sort: 'newest' });

    // Capture search intent for the analytics pipeline (never PII).
    try {
      await repo.recordSearchQuery(query, result.total);
    } catch (err) {
      logger.warn({ err, query }, 'failed to record search query');
    }

    return { items: result.items.map(toPublicProduct), total: result.total };
  }

  return { search };
}

export type SearchService = ReturnType<typeof createSearchService>;
export type { Repository as SearchRepository };