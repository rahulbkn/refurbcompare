import type { AppConfig, AppLogger, Repository } from '@refurbcompare/core';
import { describeMode } from '@refurbcompare/core';
import { PrismaRepository } from './prisma-repository.js';
import { SqliteRepository } from './sqlite-repository.js';

/**
 * Creates the repository selected by config with an explicit startup log line
 * stating whether we are in DEV FALLBACK or PRODUCTION mode.
 */
export function createRepository(config: AppConfig, logger: AppLogger): Repository {
  const modeLine = describeMode(config);
  if (config.databaseDriver === 'prisma') {
    logger.info({ driver: 'prisma' }, `DB: ${modeLine}`);
    return new PrismaRepository();
  }
  logger.info({ driver: 'sqlite', path: config.databaseUrl }, `DB: ${modeLine}`);
  return new SqliteRepository(config.databaseUrl);
}