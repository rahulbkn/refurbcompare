import { PrismaClient } from '../../generated/client/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __refurbcomparePrisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (globalThis.__refurbcomparePrisma) return globalThis.__refurbcomparePrisma;
  const client = new PrismaClient();
  globalThis.__refurbcomparePrisma = client;
  return client;
}