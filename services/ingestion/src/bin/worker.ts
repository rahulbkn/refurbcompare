import { createLogger, describeMode, loadConfig } from '@refurbcompare/core';
import { startWorker } from '../worker.js';

/** Runs an ingestion worker process. Node exit-on-signal so containers can stop cleanly. */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  logger.info({ mode: describeMode(config) }, 'starting ingestion worker');
  await startWorker({ config, logger });
}

main().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));