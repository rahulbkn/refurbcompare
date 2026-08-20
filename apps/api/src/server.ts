import { loadConfig, createLogger } from '@refurbcompare/core';
import { buildServices, startServices } from './bootstrap.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const services = buildServices(config, logger);
  const { stop } = await startServices(services);

  const app = buildApp(services);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    await stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    logger.error({ err }, 'failed to start server');
    await stop();
    process.exit(1);
  }
}

void main();