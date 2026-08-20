import { buildDemoListingsForSeller } from "@/services/ingestion/mock/data";
import type { FeedListing } from "@/lib/repo/types";
import type { ProviderAdapter } from "@/services/ingestion/types";

// TEST fixtures are served ONLY when demo mode is on (NEXT_PUBLIC_DEMO_MODE).
// Outside demo mode the adapter stays a stub and refuses to serve anything:
// no live integration exists and no live traffic may be simulated.
const DEMO_GATED = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const NOT_CONFIGURED =
  "No authorized product feed or written permission yet. TEST fixtures served only in demo mode (NEXT_PUBLIC_DEMO_MODE=true) — never live traffic.";

export const sahivalueAdapter: ProviderAdapter = {
  slug: "sahivalue",
  label: "SahaValue",
  sourceType: "affiliate-feed",
  defaultEnabled: false,
  defaultConfig: { feedEndpoint: "" },
  disabledReason: NOT_CONFIGURED,
  async fetchListings(): Promise<FeedListing[]> {
    if (!DEMO_GATED) {
      throw new Error(
        "sahivalue adapter is a stub: no authorized feed configured (see PROVIDER_INTEGRATION.md). TEST fixtures only with NEXT_PUBLIC_DEMO_MODE=true.",
      );
    }
    return buildDemoListingsForSeller("sahivalue");
  },
};