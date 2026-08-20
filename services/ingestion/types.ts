import type { FeedListing } from "@/lib/repo/types";

export type ProviderSourceType = "mock" | "affiliate-feed" | "api";

export type ProviderConfig = Record<string, string | number | boolean>;

/**
 * A pluggable data source. `mock` is the only enabled adapter today; the
 * real-seller adapters (cashify, budli, …) are shipped as stubs that are
 * disabled until an authorized feed or written permission exists. See
 * PROVIDER_INTEGRATION.md.
 */
export type ProviderAdapter = {
  slug: string;
  label: string;
  sourceType: ProviderSourceType;
  defaultEnabled: boolean;
  defaultConfig?: ProviderConfig;
  /** Short reason shown in the UI/settings when the provider is disabled. */
  disabledReason: string | null;
  fetchListings(): Promise<FeedListing[]>;
};

export type SyncContext = {
  config: ProviderConfig;
};

export type SyncSummary = {
  provider: string;
  status: "succeeded" | "failed";
  rowsAdded: number;
  rowsUpdated: number;
  errorMessage?: string;
};
