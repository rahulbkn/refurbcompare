import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const nonEmptyString = z.string().min(1).trim().max(200);

const normalizedConditionSchema = z.enum([
  'LIKE_NEW',
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'REFURBISHED',
  'PRE_OWNED',
  'UNKNOWN',
]);

export const listProductsQuerySchema = paginationSchema.extend({
  query: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(120).optional(),
  condition: normalizedConditionSchema.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'discount_desc', 'rating_desc', 'newest']).default('newest'),
  inStock: z.enum(['true', 'false']).optional(),
});

export const searchQuerySchema = z.object({
  q: nonEmptyString,
  ...paginationSchema.shape,
});

export const priceAlertCreateSchema = z.object({
  productId: nonEmptyString,
  email: z.string().email().max(200),
  targetPrice: z.coerce.number().int().positive().max(1_000_000),
});

export const priceHistoryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});

export const redirectQuerySchema = z.object({
  ref: z.enum(['web', 'whatsapp', 'email', 'social']).optional(),
  utm_source: z.string().trim().max(100).optional(),
  utm_medium: z.string().trim().max(100).optional(),
  utm_campaign: z.string().trim().max(100).optional(),
});

export const adminSyncStartSchema = z.object({
  mode: z.enum(['MOCK', 'API', 'FEED', 'AUTHORIZED_CRAWL', 'MANUAL_IMPORT']).optional(),
  force: z.string().optional(),
});

export const adminProviderUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional().nullable(),
  trustScore: z.coerce.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
  disabledReason: z.string().max(500).optional().nullable(),
});

export const adminAuthorizationSchema = z.object({
  approved: z.boolean(),
  authorizationType: z.enum(['API', 'FEED', 'AUTHORIZED_CRAWL', 'MANUAL_IMPORT']),
  permittedDomains: z.string().max(500),
  permittedPaths: z.string().max(1000),
  permittedFields: z.string().max(1000),
  maxRequestsPerMinute: z.coerce.number().int().min(1).max(3600),
  termsReviewedAt: z.string().datetime().optional().nullable(),
  robotsReviewedAt: z.string().datetime().optional().nullable(),
  copyrightDataUseReviewed: z.boolean().default(false),
  contactRecorded: z.boolean().default(false),
  authorizationNotes: z.string().max(2000).optional().nullable(),
  sourceAttributionRequired: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const adminListingUpdateSchema = z.object({
  price: z.coerce.number().int().positive().max(1_000_000).optional(),
  stockStatus: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN']).optional(),
  normalizedCondition: normalizedConditionSchema.optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(120).optional(),
  returnDays: z.coerce.number().int().min(0).max(365).optional(),
  batteryHealth: z.coerce.number().int().min(0).max(100).optional().nullable(),
  affiliateUrl: z.string().url().optional().nullable(),
});

export const adminProductUpdateSchema = z.object({
  brand: z.string().trim().min(1).max(60).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  modelNumber: z.string().trim().max(120).optional().nullable(),
  variant: z.string().trim().max(120).optional().nullable(),
  storage: z.coerce.number().int().positive().max(1024).optional().nullable(),
  ram: z.coerce.number().int().positive().max(128).optional().nullable(),
  network: z.string().trim().max(40).optional().nullable(),
});

export const adminAnalyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  providerId: z.string().optional(),
});