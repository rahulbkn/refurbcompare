// Bootstrap the local dev database (node:sqlite driver) and load the
// deterministic demo fixtures. Idempotent: seedDemo() upserts, so re-running
// is safe.
//
// Run: npm run bootstrap:dev

process.env.DATABASE_DRIVER = "sqlite";

async function main() {
  const { getRepository } = await import("@/lib/repo");
  const repo = await getRepository();

  const alreadySeeded = await repo.isSeeded();

  const started = Date.now();
  await repo.seedDemo();
  const elapsedMs = Date.now() - started;

  const productCount = await repo.countProducts({});
  const settings = await repo.getProviderSettings();

  console.log(`[bootstrap] ${alreadySeeded ? "re-seeded (upsert)" : "seeded"} demo data in ${elapsedMs}ms`);
  console.log(`[bootstrap] products: ${productCount}`);
  console.log(`[bootstrap] providers registered: ${settings.length}`);
  for (const s of settings) {
    console.log(
      `  - ${s.provider.padEnd(12)} ${s.sourceType.padEnd(15)} enabled=${s.enabled ? "yes" : "no "}${s.disabledReason ? `  (${s.disabledReason})` : ""}`,
    );
  }
}

main().catch((error) => {
  console.error("[bootstrap] FAILED:", error);
  process.exit(1);
});

export {};