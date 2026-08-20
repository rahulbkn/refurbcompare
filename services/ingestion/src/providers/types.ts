import type {
  AppConfig,
  IntegrationType,
  NormalizedCondition,
  ProviderMode,
  ProviderProduct,
  ProviderValidation,
  StockStatus,
  SystemProviderConfig,
} from '@refurbcompare/core';
import { DEFAULT_RATE_LIMIT } from '@refurbcompare/core';

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number | null;
  message: string;
}

export interface ConnectorFetchResult {
  items: ProviderProduct[];
  hasNextPage?: boolean;
  nextOffset?: number;
}

/**
 * Connector contract for a provider integration. Real connectors are shipped
 * disabled and only become active once (a) the seat is in a non-live data
 * mode (MOCK) or (b) a complete authorization record exists for live data.
 */
export interface ProviderConnector {
  slug: string;
  name: string;
  website: string;
  integrationType: IntegrationType;
  defaultMode: ProviderMode;
  defaultEnabled: boolean;
  disabledReason: string | null;
  isDemo: boolean;
  trustScore: number;

  /** Human-friendly defaults surfaced in the admin UI. */
  getSystemConfig(): SystemProviderConfig;

  validateConfiguration(config: SystemProviderConfig | null): Promise<ProviderValidation>;
  isEnabled(config: SystemProviderConfig | null): boolean;
  healthCheck(config: SystemProviderConfig | null): Promise<HealthCheckResult>;
  fetchProducts(opts: { config: SystemProviderConfig | null; dataMode: AppConfig['dataMode']; nextOffset?: number }): Promise<ConnectorFetchResult>;
  /** For manual/CSV import integrations. */
  importManual?(opts: { config: SystemProviderConfig | null; rows: unknown[] }): Promise<ConnectorFetchResult>;
}

export { DEFAULT_RATE_LIMIT, type NormalizedCondition, type ProviderProduct, type StockStatus };

export const AUTHORIZATION_REQUIRED =
  'This provider is disabled by default. Enable only after a complete authorization record is on file (approval status, permitted URLs/frequency/fields, user-agent config, robots.txt + ToS review, contact record, source attribution).';