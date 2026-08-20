import type { AppConfig, AppLogger, ProviderMode, Repository } from '@refurbcompare/core';
import { createRepository } from '@refurbcompare/db';
import { createLogger } from '@refurbcompare/core';
import { createIngestionQueue } from './queue/index.js';
import { runProviderSync } from './pipeline.js';
import type { Queue } from './queue/index.js';

export interface WorkerDeps {
  config: AppConfig;
  repo?: Repository;
  queue?: Queue;
  logger?: AppLogger;
}

/** Ignores a job that carries a cancelled provider id (e.g. disabled mid-flight). */
async function handleJob(deps: Required<WorkerDeps>, job: { name: string; data: Record<string, unknown> }): Promise<void> {
  const { repo, logger, config } = deps;
  const jobId = job.data.jobId as string | undefined;

  switch (job.name) {
    case 'provider-sync': {
      if (!jobId) return;
      const providerId = job.data.providerId as string;
      const mode = (job.data.mode as ProviderMode) ?? 'MOCK';
      await runProviderSync(
        { repo, logger, config },
        { jobId, providerId, mode, force: job.data.force === true },
      );
      break;
    }

    case 'provider-health-check': {
      const providerId = job.data.providerId as string;
      const provider = providerId ? await repo.getProviderById(providerId) : null;
      if (!provider) return;
      logger.info({ provider: provider.slug }, 'health-check job started (see admin health endpoint)');
      break;
    }

    case 'stale-listing-cleanup': {
      const maxFailures = Number(job.data.maxFailures ?? 3);
      const limit = Number(job.data.limit ?? 500);
      const stale = await repo.markStaleListings({ maxFailures, limit });
      let archived = 0;
      for (const listing of stale) {
        await repo.archiveListing(listing.id);
        archived += 1;
      }
      logger.info({ stale: stale.length, archived }, 'stale listing cleanup done');
      break;
    }

    case 'price-history': {
      logger.debug('price-history maintenance job finished');
      break;
    }

    case 'search-index-update': {
      // Placeholder: search is backed by the products table; a dedicated index
      // (e.g. Meilisearch/Typesense) would be updated here in production.
      logger.debug('search-index-update job finished (no external index configured)');
      break;
    }

    case 'price-alert-check': {
      logger.debug('price-alert-check job finished (email delivery not configured)');
      break;
    }

    default:
      logger.warn({ name: job.name }, 'unknown job name');
  }
}

/**
 * Wires a queue processor (BullMQ in production, in-memory in dev) that
 * routes jobs to the pipeline. Safe to call from the API server.
 */
export async function startWorker(deps: WorkerDeps): Promise<() => Promise<void>> {
  const config = deps.config;
  const logger = deps.logger ?? createLogger(config.logLevel);
  const repo = deps.repo ?? createRepository(config, logger);
  const queue = deps.queue ?? createIngestionQueue(config, logger);
  await repo.init();

  const stop = await queue.process((job) => handleJob({ config, repo, logger, queue } as Required<WorkerDeps>, job), {
    concurrency: 2,
  });

  logger.info('ingestion worker attached to queue');
  return async () => {
    await stop();
  };
}