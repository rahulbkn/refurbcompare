import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/client/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __refurbcomparePrisma: PrismaClient | undefined;
}

export function getPrismaClient(connectionString?: string): PrismaClient {
  if (globalThis.__refurbcomparePrisma) return globalThis.__refurbcomparePrisma;
  const url = connectionString ?? process.env.DATABASE_URL ?? '';
  const adapter = new PrismaPg({ connectionString: url });
  const client = new PrismaClient({ adapter });
  globalThis.__refurbcomparePrisma = client;
  return client;
}