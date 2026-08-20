import type { SystemProviderConfig } from '@refurbcompare/core';
import { BaseConnector } from './base.js';
import { BUDLI_CONNECTOR, MOBILEGOO_CONNECTOR } from './noprice.js';
import { CASHIFY_CONNECTOR } from './cashify.js';
import { REFIT_CONNECTOR } from './refit.js';
import { SAHIVALUE_CONNECTOR } from './sahivalue.js';
import type { HealthCheckResult, ProviderConnector } from './types.js';

export { BUDLI_CONNECTOR, CASHIFY_CONNECTOR, MOBILEGOO_CONNECTOR, REFIT_CONNECTOR, SAHIVALUE_CONNECTOR };

/**
 * Real connectors are registered with `defaultEnabled=false` and ship DISABLED
 * until a complete authorization record is on file (see PROVIDER_INTEGRATION.md).
 * In DATA_MODE=demo they serve simulated data via the base MOCK path;
 * DATA_MODE=live requires an approved authorization + a liveFetch
 * implementation. Cashify/ReFit/SahiValue crawl public catalogs; Budli/MobileGoo
 * are reachable but publish no retail price catalog (zero-offer sources).
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

export const REAL_CONNECTORS: ProviderConnector[] = [
  CASHIFY_CONNECTOR,
  BUDLI_CONNECTOR,
  REFIT_CONNECTOR,
  SAHIVALUE_CONNECTOR,
  MOBILEGOO_CONNECTOR,
];