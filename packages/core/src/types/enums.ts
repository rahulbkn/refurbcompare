export const PROVIDER_MODES = [
  'MOCK',
  'API',
  'FEED',
  'AUTHORIZED_CRAWL',
  'MANUAL_IMPORT',
  'DISABLED',
] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

export const PROVIDER_STATUSES = [
  'CONNECTED',
  'ERROR',
  'DISABLED',
  'NOT_CONFIGURED',
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const STOCK_STATUSES = ['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN', 'ARCHIVED'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const NORMALIZED_CONDITIONS = [
  'LIKE_NEW',
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'REFURBISHED',
  'PRE_OWNED',
  'UNKNOWN',
] as const;
export type NormalizedCondition = (typeof NORMALIZED_CONDITIONS)[number];

export const SYNC_STATUSES = ['PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const MATCHING_METHODS = [
  'EXACT_MODEL_NUMBER',
  'BRAND_MODEL_STORAGE',
  'BRAND_MODEL_STORAGE_VARIANT',
  'FUZZY',
  'MANUAL',
  'UNMATCHED',
] as const;
export type MatchingMethod = (typeof MATCHING_METHODS)[number];

export const ALERT_STATUSES = ['ACTIVE', 'TRIGGERED', 'DISABLED'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const INTEGRATION_TYPES = [
  'API',
  'FEED',
  'AUTHORIZED_CRAWL',
  'MANUAL_IMPORT',
  'MOCK',
] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const MIN_MATCH_CONFIDENCE = 0.45;
