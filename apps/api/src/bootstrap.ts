import {
  createServiceContext,
  createProductService,
  createOffersService,
  createSearchService,
  createRedirectService,
  createPriceHistoryService,
  createPriceAlertService,
  createProviderService,
  createAdminService,
  createLogger,
  describeMode,
  type AppConfig,
  type AppLogger,
  type ProductService,
  type OffersService,
  type SearchService,
  type RedirectService,
  type PriceHistoryService,
  type PriceAlertService,
  type ProviderService,
  type AdminService,
} from '@refurbcompare/core';
import { createRepository } from '@refurbcompare/db';
import { seedDemoCatalog, seedDemoListings } from '@refurbcompare/db';
import { createIngestionQueue, startWorker } from '@refurbcompare/ingestion';
import type { Repository } from '@refurbcompare/core';
import type { Queue } from '@refurbcompare/core';
import { createHealthChecker } from './services/health.js';

export interface ApiServices {
  config: AppConfig;
  logger: AppLogger;
  repo: Repository;
  queue: Queue;
  product: ProductService;
  offers: OffersService;
  search: SearchService;
  redirect: RedirectService;
  priceHistory: PriceHistoryService;
  priceAlert: PriceAlertService;
  provider: ProviderService;
  admin: AdminService;
}

/** Assembles the repository, queue, and domain services from a config. */
export function buildServices(config: AppConfig, loggerOverride?: AppLogger): ApiServices {
  const logger = loggerOverride ?? createLogger(config.logLevel);
  logger.info({ service: 'refurbcompare' }, describeMode(config));

  const repo = createRepository(config, logger);
  const queue = createIngestionQueue(config, logger);
  const ctx = createServiceContext({ repo, queue, logger, config });

  return {
    config,
    logger,
    repo,
    queue,
    product: createProductService(ctx),
    offers: createOffersService(ctx),
    search: createSearchService(ctx),
    redirect: createRedirectService(ctx),
    priceHistory: createPriceHistoryService(ctx),
    priceAlert: createPriceAlertService(ctx),
    provider: createProviderService(ctx),
    admin: createAdminService(ctx, createHealthChecker(repo)),
  };
}

export interface RunningServices extends ApiServices {
  stopWorker?: () => Promise<void>;
}

/**
 * Initializes storage + (in dev) attaches an in-memory worker so admin-triggered
 * syncs run in the same process. In non-live data modes with an empty database
 * the demo catalog is seeded automatically so the API is usable out of the box.
 * Returns a stop function for graceful shutdown.
 */
export async function startServices(services: ApiServices): Promise<{ stop: () => Promise<void> }> {
  const { repo, config, logger } = services;
  await repo.init();

  // DATA_MODE=live must never serve synthetic data. If the database was seeded
  // (e.g. a dev db promoted to live), demote every demo row now so no demo offer
  // can ever surface in search, comparisons, history, alerts or redirects.
  if (config.dataMode === 'live') {
    try {
      const archived = await repo.archiveDemoListings();
      if (archived > 0) logger.info({ archivedDemoListings: archived }, 'archived synthetic demo listings for live mode');
    } catch (err) {
      logger.warn({ err }, 'demo-listing isolation step skipped');
    }
  }

  if (config.dataMode !== 'live' && repo.driver === 'sqlite') {
    try {
      const { total } = await repo.listProducts({ page: 1, pageSize: 1 });
      if (total === 0) {
        await seedDemoCatalog(repo);
        const added = await seedDemoListings(repo);
        logger.info({ products: 10, listingsAdded: added }, 'seeded demo catalog (dev fallback)');
      }
    } catch (err) {
      logger.warn({ err }, 'demo seed skipped');
    }
  }

  let stopWorker: (() => Promise<void>) | undefined;
  if (config.queueDriver === 'memory') {
    const worker = await startWorker({ config, repo, queue: services.queue, logger });
    stopWorker = () => worker();
  }

  return {
    stop: async () => {
      if (stopWorker) await stopWorker();
      await services.queue.close();
    },
  };
}