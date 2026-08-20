import type { SystemProviderConfig } from '@refurbcompare/core';
import { BaseConnector } from './base.js';
import type { HealthCheckResult, ProviderConnector } from './types.js';
import { CASHIFY_CONNECTOR } from './cashify.js';

export { CASHIFY_CONNECTOR };

/**
 * Template connector for a real provider. Real connectors are registered with
 * `defaultEnabled=false` and ship DISABLED until a complete authorization
 * record is on file (see PROVIDER_INTEGRATION.md). In DATA_MODE=demo they
 * serve simulated data via the base MOCK path; DATA_MODE=live requires an
 * approved authorization + a liveFetch implementation.
 */
class RealConnector extends BaseConnector {
  constructor(opts: {
    slug: string;
    name: string;
    website: string;
    integrationType: ProviderConnector['integrationType'];
    trustScore: number;
    defaultMode?: ProviderConnector['defaultMode'];
  }) {
    super(opts);
  }

  override async healthCheck(config: SystemProviderConfig | null): Promise<HealthCheckResult> {
    const res = await super.healthCheck(config);
    if (res.message.includes('auth approved')) {
      res.message = res.message.replace(
        'endpoint reachability must be verified with vendor credentials',
        'implement liveFetch to verify endpoint reachability with vendor credentials',
      );
    }
    return res;
  }
}

export const BUDLI_CONNECTOR = new RealConnector({
  slug: 'budli',
  name: 'Budli',
  website: 'https://budli.in',
  integrationType: 'FEED',
  trustScore: 70,
  defaultMode: 'FEED',
});

export const REFIT_CONNECTOR = new RealConnector({
  slug: 'refit',
  name: 'ReFit Global',
  website: 'https://www.refitglobal.in',
  integrationType: 'AUTHORIZED_CRAWL',
  trustScore: 66,
  defaultMode: 'AUTHORIZED_CRAWL',
});

export const SAHIVALUE_CONNECTOR = new RealConnector({
  slug: 'sahivalue',
  name: 'SahiValue',
  website: 'https://sahivalue.com',
  integrationType: 'API',
  trustScore: 62,
  defaultMode: 'API',
});

export const MOBILEGOO_CONNECTOR = new RealConnector({
  slug: 'mobilegoo',
  name: 'MobileGoo',
  website: 'https://www.mobilegoo.in',
  integrationType: 'MANUAL_IMPORT',
  trustScore: 58,
  defaultMode: 'MANUAL_IMPORT',
});

export const REAL_CONNECTORS: ProviderConnector[] = [
  CASHIFY_CONNECTOR,
  BUDLI_CONNECTOR,
  REFIT_CONNECTOR,
  SAHIVALUE_CONNECTOR,
  MOBILEGOO_CONNECTOR,
];