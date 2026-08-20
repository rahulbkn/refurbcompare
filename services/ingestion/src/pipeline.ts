import type {
  AppConfig,
  AppLogger,
  ProviderMode,
  ProviderProduct,
  Repository,
  SystemProviderConfig,
  UpsertListingInput,
} from '@refurbcompare/core';
import { matchProducts, normalizeCondition, stableId } from '@refurbcompare/core';
import type { ProviderConnector } from './providers/types.js';
import { buildSystemConfig, resolveConnector } from './config.js';

export interface SyncRunContext {
  repo: Repository;
  logger: AppLogger;
  config: AppConfig;
}

export interface SyncRunResult {
  providerId: string;
  providerSlug: string;
  providerName: string;
  jobStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  recordsSeen: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsSkipped: number;
  itemsFailed: number;
  durationMs: number;
  source: string;
  errorMessage: string | null;
}

const MAX_PAGES = 5;

function invalid(item: ProviderProduct): { ok: false; reason: string } | { ok: true } {
  if (!item.sourceProductId) return { ok: false, reason: 'missing sourceProductId' };
  if (!item.title) return { ok: false, reason: 'missing title' };
  if (!item.url) return { ok: false, reason: 'missing url' };
  if (!Number.isFinite(item.price) || item.price <= 0) return { ok: false, reason: 'invalid price' };
  return { ok: true };
}

/**
 * Runs the full ingestion pipeline for one provider:
 * FETCH -> VALIDATE -> NORMALIZE -> MATCH -> DEDUPE (repo) -> UPSERT
 * LISTING/PRICE HISTORY -> count/status. Never performs unrestricted
 * scraping; connectors only use authorized integration modes.
 */
export async function runProviderSync(
  ctx: SyncRunContext,
  opts: { jobId: string; providerId: string; mode: ProviderMode; force?: boolean },
): Promise<SyncRunResult> {
  const { repo, logger, config } = ctx;
  const started = Date.now();
  const base: SyncRunResult = {
    providerId: opts.providerId,
    providerSlug: '',
    providerName: '',
    jobStatus: 'FAILED',
    recordsSeen: 0,
    itemsAdded: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsFailed: 0,
    durationMs: 0,
    source: 'pipeline',
    errorMessage: null,
  };

  const fail = async (message: string, errorCode = 'SYNC_FAILED'): Promise<SyncRunResult> => {
    await repo.updateSyncJob(opts.jobId, { status: 'FAILED', errorMessage: message.slice(0, 1000) });
    await repo.logSyncError({ jobId: opts.jobId, providerId: opts.providerId, errorCode, message: message.slice(0, 2000) });
    return { ...base, errorMessage: message, durationMs: Date.now() - started };
  };

  const provider = await repo.getProviderById(opts.providerId);
  if (!provider) {
    return fail('Provider not found', 'PROVIDER_NOT_FOUND');
  }
  base.providerSlug = provider.slug;
  base.providerName = provider.name;

  const connector = resolveConnector(provider.slug);
  if (!connector) {
    return fail(`No connector registered for "${provider.slug}"`, 'CONNECTOR_NOT_FOUND');
  }

  const systemConfig = buildSystemConfig(provider, provider.authorization ?? null, connector);

  if (!connector.isEnabled(systemConfig) && !opts.force) {
    await repo.updateSyncJob(opts.jobId, { status: 'CANCELLED', errorMessage: 'Provider disabled; run a forced dry sync or complete authorization first.' });
    return { ...base, jobStatus: 'CANCELLED', errorMessage: 'Provider disabled', durationMs: Date.now() - started };
  }

  // Live mode must never fall back to MOCK/demo data. A provider that has no
  // live implementation (mode MOCK) cannot serve a live seat: fail fast instead
  // of writing simulated listings into a production database.
  if (config.dataMode === 'live' && systemConfig.mode === 'MOCK') {
    await repo.updateSyncJob(opts.jobId, {
      status: 'FAILED',
      errorMessage: 'Provider is in MOCK mode; live data mode refuses simulated listings. Complete authorization to switch to a live integration mode (API/FEED/AUTHORIZED_CRAWL).',
    });
    await repo.logSyncError({
      jobId: opts.jobId,
      providerId: opts.providerId,
      errorCode: 'MOCK_IN_LIVE',
      message: 'Refused to sync simulated data in DATA_MODE=live.',
    });
    return {
      ...base,
      jobStatus: 'FAILED',
      errorMessage: 'MOCK provider refused in live mode',
      durationMs: Date.now() - started,
    };
  }

  const validation = await connector.validateConfiguration(systemConfig);
  if (!validation.valid && !opts.force) {
    await repo.updateSyncJob(opts.jobId, { status: 'FAILED', errorMessage: 'Configuration validation failed' });
    for (const err of validation.errors) {
      await repo.logSyncError({ jobId: opts.jobId, providerId: opts.providerId, errorCode: 'CONFIG_INVALID', message: err });
    }
    return fail('Configuration validation failed: ' + validation.errors.join('; '), 'CONFIG_INVALID');
  }

  await repo.updateSyncJob(opts.jobId, { status: 'RUNNING' });
  logger.info({ provider: provider.slug, mode: systemConfig.mode, force: !!opts.force }, 'sync pipeline started');

  const productsForSync = await repo.listProductsForSync();
  const counts = { seen: 0, added: 0, updated: 0, skipped: 0, failed: 0 };
  let pageOffset: number | undefined;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const fetch = await connector.fetchProducts({
        config: systemConfig,
        dataMode: config.dataMode,
        nextOffset: pageOffset,
      });

      for (const item of fetch.items) {
        counts.seen += 1;
        const valid = invalid(item);
        if (!valid.ok) {
          counts.failed += 1;
          continue;
        }

        try {
          await processItem(ctx, connector, provider.id, productsForSync, item, counts);
        } catch (err) {
          counts.failed += 1;
          logger.warn({ err, sourceProductId: item.sourceProductId }, 'item processing failed');
        }
      }

      if (!fetch.hasNextPage) break;
      pageOffset = fetch.nextOffset;
    }

    const finalStatus: SyncRunResult['jobStatus'] = counts.failed > 0 ? 'PARTIAL' : 'SUCCESS';
    const patch = {
      status: finalStatus,
      itemsSeen: counts.seen,
      itemsAdded: counts.added,
      itemsUpdated: counts.updated,
      itemsSkipped: counts.skipped,
      itemsFailed: counts.failed,
    };
    await repo.updateSyncJob(opts.jobId, patch);
    await repo.updateProviderSettings(provider.id, { name: provider.name, slug: provider.slug, website: provider.website, trustScore: provider.trustScore, lastSyncAt: new Date() });

    logger.info({ provider: provider.slug, ...counts, status: finalStatus }, 'sync pipeline finished');
    return {
      providerId: opts.providerId,
      providerSlug: provider.slug,
      providerName: provider.name,
      jobStatus: finalStatus,
      recordsSeen: counts.seen,
      itemsAdded: counts.added,
      itemsUpdated: counts.updated,
      itemsSkipped: counts.skipped,
      itemsFailed: counts.failed,
      durationMs: Date.now() - started,
      source: systemConfig.mode,
      errorMessage: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, provider: provider.slug }, 'sync pipeline crashed');
    return fail(message, 'FETCH_ERROR');
  }
}

async function processItem(
  ctx: SyncRunContext,
  connector: ProviderConnector,
  providerId: string,
  productsForSync: Awaited<ReturnType<Repository['listProductsForSync']>>,
  item: ProviderProduct,
  counts: { seen: number; added: number; updated: number; skipped: number; failed: number },
): Promise<void> {
  const { repo } = ctx;

  const condition = normalizeCondition(item.condition);
  const match = matchProducts(productsForSync, item.title);

  if (!match || match.confidence < 0.45) {
    counts.skipped += 1;
    ctx.logger.debug({ title: item.title }, 'listing skipped: no confident product match');
    return;
  }

  const now = new Date();
  const originalPrice = item.originalPrice && item.originalPrice > item.price ? item.originalPrice : null;
  const listingId = stableId('listing', `${connector.slug}-${item.sourceProductId}`);

  const input: UpsertListingInput = {
    id: listingId,
    productId: match.product.id,
    providerId,
    sourceProductId: item.sourceProductId,
    sourceUrl: item.url,
    affiliateUrl: null,
    price: Math.round(item.price),
    originalPrice: originalPrice != null ? Math.round(originalPrice) : null,
    discount: originalPrice != null ? Math.round(originalPrice) - Math.round(item.price) : null,
    normalizedCondition: condition.normalized,
    sourceCondition: item.condition ?? null,
    conditionScore: condition.score,
    conditionDescription: condition.description,
    warrantyMonths: item.warrantyMonths ?? 0,
    returnDays: item.returnDays ?? 0,
    batteryHealth: item.batteryHealth ?? null,
    stockStatus: item.stockStatus ?? 'IN_STOCK',
    deliveryEstimate: item.availability ?? null,
    sellerName: item.sellerName ?? connector.name,
    sellerRating: item.sellerRating ?? null,
    lastCheckedAt: now,
    priceUpdatedAt: item.lastUpdated ?? now,
  };

  const result = await repo.upsertListing(input);
  if (result.status === 'added') counts.added += 1;
  else if (result.status === 'updated') counts.updated += 1;
  else counts.skipped += 1;
}