import type { AppConfig, ProviderValidation, StockStatus, SystemProviderConfig } from '@refurbcompare/core';
import { DEFAULT_RATE_LIMIT } from '@refurbcompare/core';
import { buildDemoProviderProducts } from '@refurbcompare/db';
import {
  AUTHORIZATION_REQUIRED,
  type ConnectorFetchResult,
  type HealthCheckResult,
  type ProviderConnector,
} from './types.js';

export interface BaseConnectorOpts {
  slug: string;
  name: string;
  website: string;
  integrationType: ProviderConnector['integrationType'];
  trustScore: number;
  isDemo?: boolean;
  defaultMode?: ProviderConnector['defaultMode'];
}

/**
 * Shared connector plumbing: default system config, authorization gating,
 * config validation and demo (MOCK) data source. Real API/feed connectors
 * extend this and override `liveFetch`/`healthCheck` for their integration.
 */
export abstract class BaseConnector implements ProviderConnector {
  readonly slug: string;
  readonly name: string;
  readonly website: string;
  readonly integrationType: ProviderConnector['integrationType'];
  readonly trustScore: number;
  readonly defaultMode: ProviderConnector['defaultMode'] = 'MOCK';
  readonly defaultEnabled = false;
  readonly disabledReason = AUTHORIZATION_REQUIRED;
  isDemo: boolean;

  constructor(opts: BaseConnectorOpts) {
    this.slug = opts.slug;
    this.name = opts.name;
    this.website = opts.website;
    this.integrationType = opts.integrationType;
    this.trustScore = opts.trustScore;
    this.isDemo = opts.isDemo ?? false;
    if (opts.defaultMode) this.defaultMode = opts.defaultMode;
  }

  getSystemConfig(): SystemProviderConfig {
    const website = this.website;
    return {
      providerSlug: this.slug,
      integrationType: this.integrationType,
      mode: this.defaultMode,
      enabled: false,
      defaultEnabled: this.defaultEnabled,
      disabledReason: this.disabledReason,
      baseUrl: website,
      rateLimit: { ...DEFAULT_RATE_LIMIT },
      concurrency: 1,
      lastSyncAt: null,
      apiConfig: { baseUrl: website, useMock: this.defaultMode === 'MOCK' },
      feedConfig: { feedUrl: `${website}/products.xml`, useMock: this.defaultMode === 'MOCK' },
      health: {
        status: 'unknown',
        connected: false,
        lastCheckAt: null,
        errorMessage: null,
        recordsSeen: 0,
        latencyMs: 0,
        statusCounts: {
          IN_STOCK: 0,
          OUT_OF_STOCK: 0,
          UNKNOWN: 0,
          ARCHIVED: 0,
        } as Record<StockStatus, number>,
        lastItemAt: null,
        auth: { enabled: false, valid: false, expiry: null },
      },
      robotsTxtUrl: `${website}/robots.txt`,
      termsOfServiceUrl: `${website}/terms`,
      privacyPolicyUrl: `${website}/privacy`,
      updatedAt: null,
      authorization: {
        approved: false,
        authorizationType: this.integrationType === 'MOCK' ? 'MANUAL_IMPORT' : (this.integrationType as 'API' | 'FEED' | 'AUTHORIZED_CRAWL' | 'MANUAL_IMPORT'),
        permittedDomains: '',
        permittedPaths: '',
        permittedFields: '',
        maxRequestsPerMinute: DEFAULT_RATE_LIMIT.maxRequestsPerMinute,
        termsReviewedAt: null,
        robotsReviewedAt: null,
        copyrightDataUseReviewed: false,
        contactRecorded: false,
        authorizationNotes: `${this.name}: authorization record pending.`,
        sourceAttributionRequired: true,
        expiresAt: null,
      },
    };
  }

  isEnabled(config: SystemProviderConfig | null): boolean {
    return config?.enabled === true;
  }

  async validateConfiguration(config: SystemProviderConfig | null): Promise<ProviderValidation> {
    if (!config) {
      return { valid: false, errors: ['No provider configuration present'], warnings: [] };
    }
    const errors: string[] = [];
    const warnings: string[] = [];
    const auth = config.authorization;
    const live = config.mode !== 'MOCK';

    if (live) {
      if (!auth) {
        errors.push('Authorization record missing. Complete the authorization checklist before enabling live data.');
      } else {
        if (!auth.approved) errors.push('Authorization record must be approved before live data is allowed.');
        if (!auth.permittedDomains) errors.push('permittedDomains is required.');
        if (!auth.permittedPaths) errors.push('permittedPaths is required.');
        if (!auth.permittedFields) errors.push('permittedFields is required.');
        if (auth.maxRequestsPerMinute < 1) errors.push('maxRequestsPerMinute must be at least 1.');
        if (!auth.termsReviewedAt) errors.push('Terms of Service review not recorded.');
        if (!auth.robotsReviewedAt) errors.push('robots.txt review not recorded.');
        if (!auth.copyrightDataUseReviewed) errors.push('Copyright / data-use review not recorded.');
        if (!auth.contactRecorded) errors.push('Contact / authorization record not recorded.');
      }
    } else {
      // A MOCK (no live implementation) provider must never serve a live seat.
      // validateConfiguration does not know dataMode, so the pipeline gate in
      // runProviderSync (MOCK_IN_LIVE) is the authoritative refusal; this message
      // keeps the sandbox warning useful while flagging the constraint.
      warnings.push('Running in MOCK mode: data is simulated and must never reach production traffic.');
    }

    if (!config.rateLimit || config.rateLimit.maxRequestsPerMinute < 1) {
      errors.push('A valid per-minute request cap is required (rate limiting is mandatory).');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async healthCheck(config: SystemProviderConfig | null): Promise<HealthCheckResult> {
    const start = Date.now();
    const live = config?.mode !== 'MOCK';
    const authApproved = config?.authorization?.approved === true;

    if (live && !authApproved) {
      return {
        ok: false,
        latencyMs: null,
        message: `${this.name}: live mode requires an approved authorization record. ${this.disabledReason}`,
      };
    }

    if (live && !config?.apiConfig?.baseUrl && !config?.feedConfig?.feedUrl) {
      return {
        ok: false,
        latencyMs: null,
        message: `${this.name}: live integration not configured (no API base URL or feed URL).`,
      };
    }

    const latencyMs = Date.now() - start;
    return {
      ok: true,
      latencyMs,
      message: live
        ? `${this.name}: auth approved — endpoint reachability must be verified with vendor credentials.`
        : `${this.name}: MOCK health check OK (simulated source).`,
    };
  }

  async fetchProducts(opts: {
    config: SystemProviderConfig | null;
    dataMode: AppConfig['dataMode'];
    nextOffset?: number;
  }): Promise<ConnectorFetchResult> {
    const { config, dataMode } = opts;
    if (!this.isEnabled(config)) {
      const cause =
        config?.mode === 'MOCK'
          ? 'Connector disabled (MOCK). Enable with SYNC_MOCK_PROVIDER=true or via the admin API.'
          : this.disabledReason;
      throw new Error(`${this.slug}: connector disabled — ${cause}`);
    }

    if (dataMode === 'live' && config?.mode !== 'MOCK') {
      return this.liveFetch(opts);
    }

    const all = buildDemoProviderProducts(this.slug);
    const pageSize = 20;
    const nextOffset = opts.nextOffset ?? 0;
    const items = all.slice(nextOffset, nextOffset + pageSize);
    return {
      items,
      hasNextPage: nextOffset + pageSize < all.length,
      nextOffset: nextOffset + pageSize,
    };
  }

  /** Live integration point; real providers override with their authenticated API/feed call. */
  protected async liveFetch(_opts: {
    config: SystemProviderConfig | null;
    dataMode: AppConfig['dataMode'];
    nextOffset?: number;
  }): Promise<ConnectorFetchResult> {
    throw new Error(
      `${this.slug}: live fetch for this integration is not implemented. Implement ${this.integrationType.toLowerCase()} ingestion using the vendor's authorized endpoint.`,
    );
  }

  protected statusCounts(): Record<StockStatus, number> {
    return { IN_STOCK: 0, OUT_OF_STOCK: 0, UNKNOWN: 0, ARCHIVED: 0 };
  }
}