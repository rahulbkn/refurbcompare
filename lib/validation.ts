import { z } from "zod";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Values match the backend listProductsQuerySchema sort enum
// (packages/core/src/validation/schemas.ts).
export const sortOrders = ["price_asc", "price_desc", "discount_desc", "rating_desc", "newest"] as const;
export type SortOrder = (typeof sortOrders)[number];

export const productQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(sortOrders).optional().default("price_asc"),
  limit: z.coerce.number().int().min(1).max(60).optional().default(24),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const createPriceAlertSchema = z.object({
  productId: z.string().min(1),
  email: z.string().email().max(200),
  targetPrice: z.coerce.number().int().min(1).max(9_000_000),
});

export type CreatePriceAlert = z.infer<typeof createPriceAlertSchema>;

export const slugParamSchema = z.object({
  slug: z.string().min(1).max(200),
});

export const idParamSchema = z.object({
  id: z.string().min(1).max(200),
});