// Manual / scheduled sync runner.
//
// Fetches listings from every ENABLED provider adapter and upserts them into
// the Repository (sqlite dev driver or Prisma/Postgres in prod). Writes a
// SyncLog row per provider and touches lastSyncAt/rowsProcessed.
//
// Run: npm run sync
//       SYNC_MOCK_PROVIDER=true npm run sync   (load demo feed into dev DB)

process.env.DATABASE_DRIVER ??= "sqlite";

import { getRepository } from "@/lib/repo";
import { syncEnabledProviders } from "@/services/ingestion/sync";

async function main() {
  const repo = await getRepository();

  if (process.env.SYNC_MOCK_PROVIDER === "true") {
    await repo.setProviderEnabled("mock", true);
    console.log("[sync] mock provider enabled for this sync pass");
  }

  const results = await syncEnabledProviders(repo);

  let failed = 0;
  for (const r of results) {
    if (r.status === "succeeded") {
      console.log(
        `[sync] ${r.provider}: +${r.rowsAdded} added, ${r.rowsUpdated} updated`,
      );
    } else {
      failed++;
      console.error(`[sync] ${r.provider}: FAILED — ${r.errorMessage}`);
    }
  }

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[sync] FAILED:", error);
  process.exit(1);
});

export {};