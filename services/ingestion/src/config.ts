import type { Provider, ProviderAuthorization, SystemProviderConfig } from '@refurbcompare/core';
import type { ProviderConnector } from './providers/types.js';
import { listConnectors } from './providers/registry.js';

const CONNECTOR_BY_SLUG: Record<string, ProviderConnector> = Object.fromEntries(
  listConnectors().map((c) => [c.slug, c]),
);

/**
 * Merges the persisted provider row + authorization record into the connector's
 * default system config so the connector can safely gate itself.
 */
export function buildSystemConfig(
  provider: Provider,
  authorization: ProviderAuthorization | null,
  connector: ProviderConnector,
): SystemProviderConfig {
  const defaults = connector.getSystemConfig();
  const auth = authorization;
  const statusCounts: Record<string, number> = { IN_STOCK: 0, OUT_OF_STOCK: 0, UNKNOWN: 0, ARCHIVED: 0 };

  return {
    ...defaults,
    providerSlug: provider.slug,
    mode: provider.mode,
    enabled: provider.active,
    defaultEnabled: provider.defaultEnabled,
    disabledReason: provider.disabledReason,
    baseUrl: provider.website,
    lastSyncAt: provider.lastSyncAt?.toISOString() ?? null,
    updatedAt: provider.updatedAt?.toISOString() ?? null,
    rateLimit: {
      maxRequestsPerMinute: auth?.maxRequestsPerMinute ?? defaults.rateLimit.maxRequestsPerMinute,
      maxRequestsPerSecond: Math.max(1, Math.round((auth?.maxRequestsPerMinute ?? 60) / 60)),
    },
    apiConfig: { ...defaults.apiConfig, baseUrl: provider.website },
    authorization: auth
      ? {
          approved: auth.approved,
          authorizationType: (auth.authorizationType as 'API' | 'FEED' | 'AUTHORIZED_CRAWL' | 'MANUAL_IMPORT') ?? 'MANUAL_IMPORT',
          permittedDomains: auth.permittedDomains,
          permittedPaths: auth.permittedPaths,
          permittedFields: auth.permittedFields,
          maxRequestsPerMinute: auth.maxRequestsPerMinute,
          termsReviewedAt: auth.termsReviewedAt?.toISOString() ?? null,
          robotsReviewedAt: auth.robotsReviewedAt?.toISOString() ?? null,
          copyrightDataUseReviewed: auth.copyrightDataUseReviewed,
          contactRecorded: auth.contactRecorded,
          authorizationNotes: auth.authorizationNotes,
          sourceAttributionRequired: auth.sourceAttributionRequired,
          expiresAt: auth.expiresAt?.toISOString() ?? null,
        }
      : defaults.authorization,
    health: {
      ...defaults.health,
      auth: { enabled: provider.active, valid: auth?.approved ?? false, expiry: auth?.expiresAt?.toISOString() ?? null },
      statusCounts: statusCounts as SystemProviderConfig['health']['statusCounts'],
    },
  };
}

export function resolveConnector(slug: string): ProviderConnector | null {
  return CONNECTOR_BY_SLUG[slug] ?? null;
}