import type { AppConfig } from '../config/env.js';
import type { Repository } from '../db/repository.js';
import type { AppLogger } from '../logging/logger.js';
import type { Queue } from '../queue/queue.js';

export interface ServiceContext {
  repo: Repository;
  queue?: Queue;
  logger: AppLogger;
  config: AppConfig;
}

export function createServiceContext(opts: {
  repo: Repository;
  queue?: Queue;
  logger?: AppLogger;
  config: AppConfig;
}): ServiceContext {
  const logger =
    opts.logger ?? { trace() {}, debug() {}, info() {}, warn() {}, error() {} } as unknown as AppLogger;
  return { repo: opts.repo, queue: opts.queue, logger, config: opts.config };
}