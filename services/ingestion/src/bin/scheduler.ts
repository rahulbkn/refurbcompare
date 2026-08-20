import { createLogger, describeMode, loadConfig } from '@refurbcompare/core';
import { startScheduler } from '../scheduler.js';

/** Runs the scheduling process that enqueues periodic jobs. */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  logger.info({ mode: describeMode(config) }, 'starting scheduler');
  await startScheduler({ config, logger });
}

main().catch((err) => {
  console.error('Scheduler failed to start', err);
  process.exit(1);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));