import type { AppConfig, AppLogger } from '@refurbcompare/core';
import type { Repository } from '@refurbcompare/core';
import { createRepository } from '@refurbcompare/db';
import { createLogger } from '@refurbcompare/core';
import { createIngestionQueue } from './queue/index.js';
import type { Queue } from './queue/index.js';

interface ScheduledDeps {
  config: AppConfig;
  repo: Repository;
  queue: Queue;
  logger: AppLogger;
}

const INTERVAL_MS = 60_000;

/** Adds a job unless a job with the same id is still pending. */
async function enqueueUnique(deps: ScheduledDeps, job: Parameters<Queue['add']>[0]): Promise<void> {
  const { logger } = deps;
  try {
    await deps.queue.add(job);
  } catch (err) {
    logger.error({ err, job: job.name }, 'scheduler failed to enqueue job');
  }
}

/**
 * Lightweight scheduler (no external cron dependency). In production the same
 * cadence is honoured by BullMQ repeatable jobs; here we poll with delay.
 */
export async function startScheduler(deps: {
  config: AppConfig;
  repo?: Repository;
  queue?: Queue;
  logger?: AppLogger;
}): Promise<() => Promise<void>> {
  const config = deps.config;
  const logger = deps.logger ?? createLogger(config.logLevel);
  const repo = deps.repo ?? createRepository(config, logger);
  const queue = deps.queue ?? createIngestionQueue(config, logger);
  await repo.init();

  logger.info('scheduler started (mocked cadence in dev)');

  let tick = 0;
  const timer = setInterval(() => {
    void (async () => {
      try {
        const s = { config, repo, queue, logger };
        tick += 1;

        // Providers due for a sync (mock on the default dev cadence).
        const providers = await repo.listProviders();
        for (const provider of providers) {
          if (!provider.active) continue;
          await enqueueUnique(s, {
            name: 'provider-sync',
            data: { jobId: `sched-sync-${provider.id}-${tick}`, providerId: provider.id, mode: provider.mode, force: false },
            opts: { attempts: 3, backoffMs: 2000, jobId: `provider-sync-${provider.id}` },
          });
        }

        // Health checks every 15 ticks (~15 min in dev).
        if (tick % 15 === 0) {
          for (const provider of providers) {
            if (!provider.active) continue;
            await enqueueUnique(s, {
              name: 'provider-health-check',
              data: { providerId: provider.id },
              opts: { jobId: `health-${provider.id}` },
            });
          }
        }

        // Stale listing cleanup every 10 ticks.
        if (tick % 10 === 0) {
          await enqueueUnique(s, {
            name: 'stale-listing-cleanup',
            data: { maxFailures: 3, limit: 500 },
            opts: { jobId: 'stale-listing-cleanup' },
          });
        }

        // Price alert check every 5 ticks.
        if (tick % 5 === 0) {
          await enqueueUnique(s, {
            name: 'price-alert-check',
            data: {},
            opts: { jobId: 'price-alert-check' },
          });
        }
      } catch (err) {
        logger.error({ err }, 'scheduler tick failed');
      }
    })();
  }, INTERVAL_MS);

  return async () => {
    clearInterval(timer);
    logger.info('scheduler stopped');
  };
}