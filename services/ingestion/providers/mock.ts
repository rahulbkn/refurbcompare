import { buildDemoListings } from "@/services/ingestion/mock/data";
import type { FeedListing } from "@/lib/repo/types";
import type { ProviderAdapter } from "@/services/ingestion/types";

/**
 * Mock provider. Produces the deterministic demo catalogue with zero network
 * I/O. Drives the sandbox/dev experience; in production it is disabled by
 * default (see PROVIDER_REGISTRY) so real feeds are never shadowed.
 */
export const mockAdapter: ProviderAdapter = {
  slug: "mock",
  label: "Mock demo feed",
  sourceType: "mock",
  defaultEnabled: false,
  defaultConfig: { deterministic: true },
  disabledReason:
    "Demo fixture feed. Enable only in local sandbox/dev (SYNC_MOCK_PROVIDER).",
  async fetchListings(): Promise<FeedListing[]> {
    return buildDemoListings();
  },
};
