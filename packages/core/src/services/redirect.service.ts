import { AppError as AppErr } from '../errors.js';
import {
  hostAllowed,
  parseAllowedDomains,
  resolveRedirectTarget,
  type UTMConfig,
} from '../redirect/index.js';
import type { ServiceContext } from './context.js';
import { detectDeviceType, hashUserAgent } from '../util/ua.js';
import { randomHexId } from '../util/ids.js';

export interface RedirectResolution {
  targetUrl: string;
  source: 'affiliate' | 'direct';
  listingId: string;
  productId: string;
  providerId: string;
  providerName: string;
  productSlug: string;
  demoMode: boolean;
}

/**
 * Resolves and records an outbound redirect for a listing.
 * - Listing must exist and not be archived/gone.
 * - Target host must match the provider's approved domains (from the
 *   authorization record); otherwise the redirect is refused.
 * - Clicks are recorded fire-and-forget; attribution params are appended.
 */
export function createRedirectService(ctx: ServiceContext) {
  const { repo, logger, config } = ctx;

  async function resolve(opts: {
    listingId: string;
    utm: UTMConfig;
    userAgent?: string | null;
    referrer?: string | null;
  }): Promise<RedirectResolution> {
    const listing = await repo.getListingById(opts.listingId);
    if (!listing) throw AppErr.notFound('Listing not found');
    if (listing.stockStatus === 'ARCHIVED') throw AppErr.gone('This offer is no longer available');
    if (listing.stockStatus === 'OUT_OF_STOCK') {
      throw new AppErr({ code: 'UNPROCESSABLE', status: 422, message: 'This offer is out of stock' });
    }

    const provider = await repo.getProviderById(listing.providerId);
    if (!provider) throw AppErr.notFound('Provider not found');
    if (!provider.active) throw AppErr.forbidden('Provider is not currently accepting traffic');

    const authorization = await repo.getProviderAuthorization(provider.id);
    const approvedDomains = authorization?.approved
      ? parseAllowedDomains(authorization.permittedDomains)
      : [provider.website];

    const resolved = resolveRedirectTarget({
      rawUrl: listing.sourceUrl,
      affiliateUrl: listing.affiliateUrl,
      allowedDomains: approvedDomains,
      utm: opts.utm,
      allowHttp: config.nodeEnv !== 'production',
    });

    if (!resolved) {
      logger.warn(
        { listingId: listing.id, url: listing.sourceUrl },
        'redirect refused: target not in approved provider domains',
      );
      throw AppErr.forbidden('Redirect target is not approved for this provider');
    }

    // Record click (fire-and-forget; capture failures without breaking the redirect).
    try {
      await repo.recordClick({
        clickId: randomHexId(24),
        listingId: listing.id,
        productId: listing.productId,
        providerId: provider.id,
        referrer: opts.referrer?.slice(0, 500) ?? null,
        deviceType: detectDeviceType(opts.userAgent),
        userAgentHash: hashUserAgent(opts.userAgent),
      });
    } catch (err) {
      logger.warn({ err, listingId: listing.id }, 'failed to record click');
    }

    return {
      targetUrl: resolved.url,
      source: resolved.source,
      listingId: listing.id,
      productId: listing.productId,
      providerId: provider.id,
      providerName: provider.name,
      productSlug: listing.product?.slug ?? '',
      demoMode: config.dataMode !== 'live',
    };
  }

  /** Exposes approved domain list for diagnostics without leaking internals. */
  async function approvedDomainsFor(providerId: string): Promise<string[]> {
    const provider = await repo.getProviderById(providerId);
    if (!provider) throw AppErr.notFound('Provider not found');
    const authorization = await repo.getProviderAuthorization(provider.id);
    return authorization?.approved ? parseAllowedDomains(authorization.permittedDomains) : [provider.website];
  }

  return { resolve, approvedDomainsFor };
}

export type RedirectService = ReturnType<typeof createRedirectService>;
export { hostAllowed, parseAllowedDomains };