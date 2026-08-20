import type { ListingWithRelations } from '../types/models.js';
import type { AppConfig } from '../config/env.js';

/**
 * Production visibility rule for public surfaces.
 *
 * In DATA_MODE=live neither synthetic demo rows nor listings from disabled
 * providers may be presented to visitors. Demo rows are identified by their
 * sourceProductId prefix ("demo-*") and/or the provider's isDemo flag; a
 * provider that is not active must not surface offers even if historic rows
 * still exist in the database.
 *
 * In every other mode every stored listing is legitimate and visible.
 */
export function visibleInLive(listing: ListingWithRelations, dataMode: AppConfig['dataMode']): boolean {
  if (dataMode !== 'live') return true;
  if (listing.sourceProductId && listing.sourceProductId.startsWith('demo-')) return false;
  if (listing.provider?.isDemo === true) return false;
  if (listing.provider?.active === false) return false;
  return true;
}