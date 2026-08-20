// Prisma/Postgres seed: loads the deterministic demo fixtures through the
// repository layer (like scripts/bootstrap-dev-db.ts does for sqlite).
//
// Run: npm run db:seed   (with DATABASE_DRIVER=prisma / Postgres reachable)

process.env.DATABASE_DRIVER = process.env.DATABASE_DRIVER ?? "prisma";

async function main() {
  const { getRepository } = await import("@/lib/repo");
  const repo = await getRepository();

  const alreadySeeded = await repo.isSeeded();
  await repo.seedDemo();

  const productCount = await repo.countProducts({});
  const settings = await repo.getProviderSettings();

  console.log(
    `[seed] ${alreadySeeded ? "re-seeded (upsert)" : "seeded"} via driver=${process.env.DATABASE_DRIVER}`,
  );
  console.log(`[seed] products: ${productCount}`);
  console.log(`[seed] providers registered: ${settings.length}`);
}

main()
  .catch((error) => {
    console.error("[seed] FAILED:", error);
    process.exit(1);
  })
  .finally(async () => {
    if (process.env.DATABASE_DRIVER === "prisma") {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$disconnect();
    }
  });

export {};