import { REAL_CONNECTORS } from './real.js';
import type { ProviderConnector } from './types.js';

export const PROVIDER_REGISTRY: Record<string, ProviderConnector> = {};

for (const connector of REAL_CONNECTORS) {
  PROVIDER_REGISTRY[connector.slug] = connector;
}

export function getConnector(slug: string): ProviderConnector | null {
  return PROVIDER_REGISTRY[slug] ?? null;
}

export function listConnectors(): ProviderConnector[] {
  return Object.values(PROVIDER_REGISTRY);
}