import type { Repository } from "@/lib/repo/types";
import {
  PROVIDER_REGISTRY,
  getProviderBySlug,
} from "@/services/ingestion/providers/registry";
import type { ProviderAdapter } from "@/services/ingestion/types";

export type SyncResultDetail = {
  provider: string;
  status: "succeeded" | "failed";
  rowsAdded: number;
  rowsUpdated: number;
  errorMessage?: string;
};

/**
 * Runs a sync pass across every enabled provider adapter.
 *
 * Protocol:
 * 1. Read ProviderSetting rows — the source of truth for what is enabled.
 * 2. For each enabled provider, fetch listings and upsert them into the DB.
 * 3. Persist a SyncLog row and update lastSyncAt/rowsProcessed.
 *
 * Nothing here ever scrapes during a page request; this only runs from
 * `npm run sync` / the scheduler.
 */
export async function syncEnabledProviders(
  repo: Repository,
): Promise<SyncResultDetail[]> {
  const settings = await repo.getProviderSettings();
  const results: SyncResultDetail[] = [];

  for (const setting of settings) {
    const adapter: ProviderAdapter | undefined = getProviderBySlug(
      setting.provider,
    );
    if (!adapter) continue;
    if (!setting.enabled) continue;

    try {
      const listings = await adapter.fetchListings();
      const { added, updated } = await repo.importListings(listings);
      const result: SyncResultDetail = {
        provider: adapter.slug,
        status: "succeeded",
        rowsAdded: added,
        rowsUpdated: updated,
      };
      results.push(result);
      await repo.logSync(result);
    } catch (error) {
      const result: SyncResultDetail = {
        provider: adapter.slug,
        status: "failed",
        rowsAdded: 0,
        rowsUpdated: 0,
        errorMessage:
          error instanceof Error ? error.message : String(error),
      };
      results.push(result);
      await repo.logSync(result);
    }
  }

  return results;
}

export function enabledProviderSlugs(settings: {
  provider: string;
  enabled: boolean;
}[]): string[] {
  return settings.filter((s) => s.enabled).map((s) => s.provider);
}

export { PROVIDER_REGISTRY };