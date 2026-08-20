import { z } from 'zod';
import { AppError } from '../errors.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATA_MODE: z.enum(['mock', 'demo', 'live']).default('demo'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default(''),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_DRIVER: z.enum(['prisma', 'sqlite']).default('sqlite'),
  DATABASE_URL: z.string().default('file:./data/dev.db'),

  QUEUE_DRIVER: z.enum(['bullmq', 'memory']).default('memory'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  SYNC_MOCK_PROVIDER: z.enum(['true', 'false']).default('false'),
  API_CRON_SYNC: z.enum(['true', 'false']).default('false'),
  ADMIN_API_KEY: z.string().default('dev-admin-key'),
  ADMIN_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  nodeEnv: Env['NODE_ENV'];
  dataMode: Env['DATA_MODE'];
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimitMax: number;
  logLevel: Env['LOG_LEVEL'];

  databaseDriver: 'prisma' | 'sqlite';
  databaseUrl: string;

  queueDriver: 'bullmq' | 'memory';
  redisUrl: string;

  syncMockProvider: boolean;
  apiCronSync: boolean;
  adminApiKey: string;

  isDevFallback: boolean;
  isProduction: boolean;
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(overrides: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(overrides);
  if (!parsed.success) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      status: 500,
      message: 'Invalid environment configuration',
      details: parsed.error.flatten(),
    });
  }
  const env = parsed.data;

  const databaseDriver = env.DATABASE_DRIVER === 'prisma' ? 'prisma' : 'sqlite';
  const queueDriver = env.QUEUE_DRIVER === 'bullmq' ? 'bullmq' : 'memory';

  const WELL_KNOWN_ADMIN_KEYS = new Set(['dev-admin-key', 'change-me', 'change-me-admin', 'change-me-in-production', 'admin', 'password', 'changeme']);

  const isProduction = env.DATA_MODE === 'live';
  const isDevFallback = databaseDriver === 'sqlite' && queueDriver === 'memory';

  const adminApiKey = env.ADMIN_API_KEY || env.ADMIN_SECRET || 'dev-admin-key';

  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (env.DATA_MODE !== 'live') {
      problems.push('DATA_MODE must be "live" in production');
    }
    if (databaseDriver !== 'prisma') {
      problems.push('DATABASE_DRIVER must be "prisma" (PostgreSQL) in production');
    }
    if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
      problems.push('DATABASE_URL must be a postgresql:// connection string in production');
    }
    if (env.SYNC_MOCK_PROVIDER === 'true') {
      problems.push('SYNC_MOCK_PROVIDER must be false in production');
    }
    if (problems.length > 0) {
      throw new AppError({
        code: 'CONFIG_ERROR',
        status: 500,
        message:
          `Production configuration incomplete: ${problems.join('; ')}. ` +
          'Failing fast — production must not silently fall back to SQLite or mock data.',
        details: { productionGuard: problems },
      });
    }
  }

  if (isProduction && WELL_KNOWN_ADMIN_KEYS.has(adminApiKey)) {
    throw new AppError({
      code: 'CONFIG_ERROR',
      status: 500,
      message:
        'ADMIN_API_KEY must be set to a non-default secret in production (DATA_MODE=live). Refusing to start with a well-known admin key.',
    });
  }

  cachedConfig = {
    nodeEnv: env.NODE_ENV,
    dataMode: env.DATA_MODE,
    port: env.PORT,
    host: env.HOST,
    corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    rateLimitMax: env.RATE_LIMIT_MAX,
    logLevel: env.LOG_LEVEL,
    databaseDriver,
    databaseUrl: env.DATABASE_URL,
    queueDriver,
    redisUrl: env.REDIS_URL,
    syncMockProvider: env.SYNC_MOCK_PROVIDER === 'true',
    apiCronSync: env.API_CRON_SYNC === 'true',
    adminApiKey: adminApiKey,
    isDevFallback,
    isProduction,
  };
  return cachedConfig;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) return loadConfig();
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}

export function describeMode(config: AppConfig): string {
  if (config.isDevFallback) {
    return `DEV FALLBACK MODE: sqlite (${config.databaseUrl}) + in-memory queue. Data mode=${config.dataMode}.`;
  }
  return `PRODUCTION MODE: driver=${config.databaseDriver} queue=${config.queueDriver} dataMode=${config.dataMode}`;
}