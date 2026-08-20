import type { ProviderHealthChecker, HealthCheckReport, Repository } from '@refurbcompare/core';
import { buildSystemConfig, resolveConnector, listConnectors } from '@refurbcompare/ingestion';

/**
 * Wires the ingestion connectors into the admin health-check endpoint.
 * Checks connectivity AND whether the authorization record is complete enough
 * to go live. Live connectors that are not yet authorized report `unchecked`.
 */
export function createHealthChecker(repo: Repository): ProviderHealthChecker {
  return async (providerId: string): Promise<HealthCheckReport> => {
    const provider = await repo.getProviderById(providerId);
    if (!provider) {
      return { providerId, providerName: providerId, status: 'error', latencyMs: null, message: 'Unknown provider' };
    }

    const connector = resolveConnector(provider.slug) ?? listConnectors()[0] ?? null;
    if (!connector) {
      return { providerId, providerName: provider.name, status: 'unchecked', latencyMs: null, message: 'No connector registered' };
    }

    const authorization = await repo.getProviderAuthorization(provider.id);
    const systemConfig = buildSystemConfig(provider, authorization, connector);
    const connectorEnabled = connector.isEnabled(systemConfig);

    if (!connectorEnabled) {
      return {
        providerId,
        providerName: provider.name,
        status: 'unchecked',
        latencyMs: null,
        message: 'Provider is disabled or lacks a complete authorization record',
      };
    }

    const start = Date.now();
    const result = await connector.healthCheck(systemConfig);
    return {
      providerId,
      providerName: provider.name,
      status: result.ok ? 'ok' : 'error',
      latencyMs: Date.now() - start,
      message: result.message,
    };
  };
}