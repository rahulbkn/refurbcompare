import { AppError as AppErr } from '../errors.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { ClickFilter, Repository } from '../db/repository.js';
import type { ProviderAuthorizationRecord } from '../types/provider.js';
import type { ProviderMode } from '../types/enums.js';
import type { ServiceContext } from './context.js';
import type { SyncJob } from '../types/models.js';

export interface HealthCheckReport {
  providerId: string;
  providerName: string;
  status: 'ok' | 'error' | 'unchecked';
  latencyMs: number | null;
  message: string;
}

export type ProviderHealthChecker = (providerId: string) => Promise<HealthCheckReport>;

export interface SyncTriggerResult {
  job: SyncJob;
  enqueued: boolean;
  message: string;
}

export function createAdminService(
  ctx: ServiceContext,
  healthChecker?: ProviderHealthChecker,
) {
  const { repo, logger } = ctx;

  async function triggerSync(
    providerSlug: string,
    opts: { mode?: string; force?: boolean },
  ): Promise<SyncTriggerResult> {
    const provider = await repo.getProviderBySlug(providerSlug);
    if (!provider) throw AppErr.notFound('Provider not found');
    if (!provider.active && !opts.force) {
      throw new AppErr({
        code: 'INTEGRATION_DISABLED',
        status: 409,
        message: `Provider "${provider.name}" is disabled. Supply the authorization checklist or use force to run a dry sync.`,
      });
    }
    const modeRaw = opts.mode ?? provider.mode;
    const MODES: ProviderMode[] = ['MOCK', 'API', 'FEED', 'AUTHORIZED_CRAWL', 'MANUAL_IMPORT', 'DISABLED'];
    const mode = MODES.includes(modeRaw as ProviderMode) ? (modeRaw as ProviderMode) : provider.mode;
    if (mode === 'DISABLED') throw AppErr.validationMsg('Cannot sync a disabled integration');

    const job = await repo.createSyncJob({ providerId: provider.id, mode, source: 'admin' });
    const enqueued = ctx.queue != null;
    if (enqueued) {
      await ctx.queue!.add({
        name: 'provider-sync',
        data: { jobId: job.id, providerId: provider.id, mode, from: 'admin' },
        opts: { attempts: 3, backoffMs: 2000, jobId: `provider-sync-${provider.id}` },
      });
    } else {
      logger.info({ jobId: job.id }, 'admin sync triggered without a worker queue (job will be picked up by polling)');
    }
    return { job, enqueued, message: enqueued ? 'Sync enqueued' : 'Sync job created (no worker attached)' };
  }

  async function syncStatus(limit = 20): Promise<{ recent: SyncJob[] }> {
    return { recent: await repo.listRecentSyncJobs(limit) };
  }

  async function syncErrors(opts: { providerId?: string; limit: number }) {
    return repo.listSyncErrors(opts);
  }

  async function healthCheck(providerId: string): Promise<HealthCheckReport> {
    const provider = await repo.getProviderById(providerId);
    if (!provider) throw AppErr.notFound('Provider not found');
    if (!healthChecker) {
      return { providerId, providerName: provider.name, status: 'unchecked', latencyMs: null, message: 'Health checker not wired' };
    }
    return healthChecker(providerId);
  }

  async function updateProvider(providerId: string, patch: Parameters<Repository['updateProviderSettings']>[1] & { active?: boolean; disabledReason?: string | null }) {
    let provider = await repo.getProviderById(providerId);
    if (!provider) throw AppErr.notFound('Provider not found');

    if (patch.active !== undefined) {
      provider = await repo.setProviderEnabled(providerId, {
        enabled: patch.active,
        disabledReason: patch.disabledReason ?? null,
      });
    }

    const { active: _active, disabledReason: _reason, ...settings } = patch;
    if (Object.keys(settings).length > 0) {
      const updated = await repo.updateProviderSettings(providerId, settings);
      if (updated) provider = await repo.getProviderById(providerId);
    }
    return provider;
  }

  async function authorizeProvider(
    providerId: string,
    input: ProviderAuthorizationRecord,
  ) {
    const provider = await repo.getProviderById(providerId);
    if (!provider) throw AppErr.notFound('Provider not found');

    const auth = await repo.upsertProviderAuthorization({
      providerId,
      approved: input.approved,
      authorizationType: input.authorizationType,
      permittedDomains: input.permittedDomains,
      permittedPaths: input.permittedPaths,
      permittedFields: input.permittedFields,
      maxRequestsPerMinute: input.maxRequestsPerMinute,
      termsReviewedAt: input.termsReviewedAt ? new Date(input.termsReviewedAt) : null,
      robotsReviewedAt: input.robotsReviewedAt ? new Date(input.robotsReviewedAt) : null,
      copyrightDataUseReviewed: input.copyrightDataUseReviewed,
      contactRecorded: input.contactRecorded,
      authorizationNotes: input.authorizationNotes ?? null,
      sourceAttributionRequired: input.sourceAttributionRequired,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });

    if (auth.approved) {
      await repo.setProviderEnabled(provider.id, {
        enabled: true,
        disabledReason: null,
        mode: input.authorizationType === 'MANUAL_IMPORT' ? 'MANUAL_IMPORT' : input.authorizationType,
      });
    }
    return auth;
  }

  async function analytics(opts: ClickFilter & { from?: Date; to?: Date }) {
    const clicks = await repo.listClicks(opts);
    const byProvider = opts.from && opts.to ? await repo.countClicksByProvider({ from: opts.from, to: opts.to }) : [];
    return { clicks, byProvider };
  }

  async function updateProduct(id: string, patch: object) {
    const product = await repo.getProductById(id);
    if (!product) throw AppErr.notFound('Product not found');
    const updated = await repo.updateProduct(id, patch as Parameters<Repository['updateProduct']>[1]);
    return updated;
  }

  async function updateListing(id: string, patch: object) {
    const listing = await repo.getListingById(id);
    if (!listing) throw AppErr.notFound('Listing not found');
    return repo.updateListing(id, patch as Parameters<Repository['updateListing']>[1]);
  }

  async function adminAuth(adminApiKey: string): Promise<boolean> {
    if (!adminApiKey) return false;
    const configured = ctx.config.adminApiKey;
    if (typeof configured !== 'string' || configured.length === 0) return false;
    const a = createHash('sha256').update(configured).digest();
    const b = createHash('sha256').update(adminApiKey).digest();
    return timingSafeEqual(a, b);
  }

  return {
    triggerSync,
    syncStatus,
    syncErrors,
    healthCheck,
    updateProvider,
    authorizeProvider,
    analytics,
    updateProduct,
    updateListing,
    adminAuth,
  };
}

export type AdminService = ReturnType<typeof createAdminService>;