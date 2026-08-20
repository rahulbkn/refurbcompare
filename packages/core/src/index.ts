export * from './types/enums.js';
export * from './types/models.js';
export * from './types/provider.js';

export { AppError, type ErrorCode } from './errors.js';

export { loadConfig, getConfig, resetConfig, describeMode, type AppConfig, type Env } from './config/env.js';

export { createLogger, type AppLogger } from './logging/logger.js';

export * from './validation/schemas.js';

export { normalizeCondition, CONDITION_SCORES, CONDITION_DESCRIPTIONS, type ConditionResult } from './normalization/condition.js';
export { parseStorageGB, parseRamGB } from './normalization/storage.js';
export { canonicalizeBrand, extractModelNumber, buildSlug } from './normalization/model.js';

export {
  parseTitle,
  matchProducts,
  deriveCanonicalProduct,
  type MatchableProduct,
  type ParsedTitle,
  type ProductMatch,
  type DerivedProduct,
} from './matching/index.js';

export {
  scoreListing,
  rankOffers,
  computeComparisonStats,
  SCORING_WEIGHTS,
  type ListingScore,
  type ScoreComponent,
  type ComparisonStats,
} from './scoring/index.js';

export {
  parseAllowedUrl,
  isForbiddenHost,
  hostAllowed,
  parseAllowedDomains,
  buildTargetUrl,
  resolveRedirectTarget,
  type SafeRedirectTarget,
  type UTMConfig,
} from './redirect/index.js';

export type {
  Repository,
  ProductFilter,
  UpsertProviderSettingsInput,
  UpsertProductInput,
  UpsertListingInput,
  UpsertListingResult,
  ClickFilter,
  ClickRow,
  StaleListing,
} from './db/repository.js';
export { isUniqueViolation } from './db/repository.js';

export type { Queue, QueueJob, QueueJobName, QueueJobResult, QueueWorkerOptions } from './queue/queue.js';
export { computeRetryDelay } from './queue/queue.js';
export { InMemoryQueue } from './queue/in-memory-queue.js';

export { stableId, randomHexId, shortId } from './util/ids.js';
export { fnv1aHex, detectDeviceType, hashUserAgent, type DeviceType } from './util/ua.js';

export { createServiceContext, type ServiceContext } from './services/context.js';
export { visibleInLive } from './services/visibility.js';
export { createProductService, toPublicProduct, type ProductService, type PublicProduct } from './services/product.service.js';
export { createOffersService, type OffersService, type PublicOffer, type ProductComparison } from './services/offers.service.js';
export { createSearchService, type SearchService } from './services/search.service.js';
export { createRedirectService, type RedirectService, type RedirectResolution } from './services/redirect.service.js';
export { createPriceHistoryService, type PriceHistoryService } from './services/price-history.service.js';
export { createPriceAlertService, type PriceAlertService } from './services/price-alert.service.js';
export { createProviderService, type ProviderService, type PublicProvider } from './services/provider.service.js';
export {
  createAdminService,
  type AdminService,
  type HealthCheckReport,
  type ProviderHealthChecker,
  type SyncTriggerResult,
} from './services/admin.service.js';