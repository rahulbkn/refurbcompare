import { PrismaRepository } from '../src/prisma-repository.js';
import { seedDemoCatalog, seedDemoListings } from '../src/seed.js';
import { getPrismaClient } from '../src/prisma/client.js';

/** Production (Postgres) seed: canonical demo catalog + listings. */
async function main(): Promise<void> {
  const client = getPrismaClient();
  await client.$connect();
  const repo = new PrismaRepository(client);
  await seedDemoCatalog(repo);
  const added = await seedDemoListings(repo);
  console.log(`Seeded demo catalog: 10 products, 5 providers, ${added} listings added.`);
  await client.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed', err);
  process.exitCode = 1;
});
