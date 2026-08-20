import type { AppConfig, ProviderProduct, SystemProviderConfig } from '@refurbcompare/core';
import { BaseConnector } from './base.js';
import { PoliteFetcher } from '../http/polite.js';
import type { ConnectorFetchResult, HealthCheckResult } from './types.js';

/**
 * Connectors for providers whose public footprint does NOT include a
 * machine-readable retail price catalog (robots.txt inspected, pages crawled):
 *
 *  - Budli (budli.in): a sell-your-phone / trade-in + buying-guide platform.
 *    The `refurbished-smartphones` category renders blog articles, not
 *    purchasable SKUs, and /shop is absent.
 *  - MobileGoo (mobilegoo.in): trade-in quote calculator + guides.
 *    `/sell/*` pages list models but publish no retail prices.
 *
 * They are crawled (robots-compliant) to confirm reachability, then produce
 * ZERO offers with an explicit reason so the site never fabricates prices.
 * If a site later publishes a price catalog, these stubs can be upgraded to
 * full connectors without touching the pipeline.
 */
class NoPriceCatalogConnector extends BaseConnector {
  protected fetcher: PoliteFetcher;
  constructor(
    opts: {
      slug: string;
      name: string;
      website: string;
      trustScore: number;
      probePath: string;
      noCatalogReason: string;
    },
  ) {
    super({
      slug: opts.slug,
      name: opts.name,
      website: opts.website,
      integrationType: 'AUTHORIZED_CRAWL',
      trustScore: opts.trustScore,
      defaultMode: 'AUTHORIZED_CRAWL',
    });
    this.noCatalogReason = opts.noCatalogReason;
    this.probePath = opts.probePath;
    this.fetcher = new PoliteFetcher({
      ua: 'RefurbMeterBot/0.1 (authorized price-comparison crawler; https://refurbmeter.pages.dev/contact)',
      defaultMaxRequestsPerMinute: 15,
    });
  }

  private readonly noCatalogReason: string;
  private readonly probePath: string;

  override async healthCheck(config: SystemProviderConfig | null): Promise<HealthCheckResult> {
    if (config?.mode !== 'MOCK' && config?.authorization?.approved === true) {
      const start = Date.now();
      try {
        const html = await this.fetcher.text(`${this.website}${this.probePath}`, {
          maxRequestsPerMinute: config?.rateLimit?.maxRequestsPerMinute ?? 15,
        });
        return {
          ok: true,
          latencyMs: Date.now() - start,
          message: `${this.name}: site reachable (${html.length} bytes). ${this.noCatalogReason} Zero offers will be produced.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, latencyMs: null, message: `${this.name}: probe failed — ${msg}` };
      }
    }
    return super.healthCheck(config);
  }

  protected override async liveFetch(_opts: {
    config: SystemProviderConfig | null;
    dataMode: AppConfig['dataMode'];
    nextOffset?: number;
  }): Promise<ConnectorFetchResult> {
    const items: ProviderProduct[] = [];
    return { items, hasNextPage: false, nextOffset: 0 };
  }
}

export class BudliConnector extends NoPriceCatalogConnector {
  constructor() {
    super({
      slug: 'budli',
      name: 'Budli',
      website: 'https://budli.in',
      trustScore: 70,
      probePath: '/category/refurbished-smartphones/',
      noCatalogReason:
        'Crawl confirmed Budli publishes trade-in quotes and buying guides only — no public retail price catalog exists, so no price offers can be claimed.',
    });
  }
}

export class MobileGooConnector extends NoPriceCatalogConnector {
  constructor() {
    super({
      slug: 'mobilegoo',
      name: 'MobileGoo',
      website: 'https://www.mobilegoo.in',
      trustScore: 58,
      probePath: '/sell/mobile/apple',
      noCatalogReason:
        'Crawl confirmed MobileGoo offers trade-in quote calculators and guides only — no published retail prices, so no price offers can be claimed.',
    });
  }
}

export const BUDLI_CONNECTOR = new BudliConnector();
export const MOBILEGOO_CONNECTOR = new MobileGooConnector();