import { mockAdapter } from "@/services/ingestion/providers/mock";
import { cashifyAdapter } from "@/services/ingestion/providers/cashify";
import { budliAdapter } from "@/services/ingestion/providers/budli";
import { refitAdapter } from "@/services/ingestion/providers/refit";
import { sahivalueAdapter } from "@/services/ingestion/providers/sahivalue";
import { mobilegooAdapter } from "@/services/ingestion/providers/mobilegoo";
import type { ProviderAdapter } from "@/services/ingestion/types";

/**
 * Single source of truth for which providers exist.
 *
 * - `mock` drives the deterministic demo fixtures.
 * - The five seller adapters are stubs: they are registered so settings rows
 *   get created with accurate metadata, but disabled until an authorized
 *   feed / API / written permission exists.
 *
 * Enabled provider selection lives in the ProviderSetting table; nothing here
 * toggles at runtime except sync orchestration.
 */
export const PROVIDER_REGISTRY: ProviderAdapter[] = [
  mockAdapter,
  cashifyAdapter,
  budliAdapter,
  refitAdapter,
  sahivalueAdapter,
  mobilegooAdapter,
];

export function getProviderBySlug(
  slug: string,
): ProviderAdapter | undefined {
  return PROVIDER_REGISTRY.find((p) => p.slug === slug);
}