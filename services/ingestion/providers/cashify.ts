import type { FeedListing } from "@/lib/repo/types";
import type { ProviderAdapter } from "@/services/ingestion/types";

const NOT_CONFIGURED =
  "No authorized product feed or written permission yet. Enable only after an integration agreement is in place.";

export const cashifyAdapter: ProviderAdapter = {
  slug: "cashify",
  label: "Cashify",
  sourceType: "affiliate-feed",
  defaultEnabled: false,
  defaultConfig: { feedEndpoint: "" },
  disabledReason: NOT_CONFIGURED,
  async fetchListings(): Promise<FeedListing[]> {
    throw new Error(
      "cashify adapter is a stub: no authorized feed configured (see PROVIDER_INTEGRATION.md).",
    );
  },
};
