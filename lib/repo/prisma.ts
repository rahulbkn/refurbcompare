// Production Postgres adapter over Prisma.
//
// Important: this module is NOT exercised in the Android sandbox (Prisma's
// native engines cannot run there — see AGENTS context). It ships verbatim
// for real deployments on PostgreSQL. The SQL here mirrors
// lib/repo/sqlite.ts and prisma/dev/init.sql so behaviour stays identical.

import type { Product } from "@prisma/client";
import prisma from "@/lib/prisma";
import type {
  FeedListing,
  ListingDto,
  PriceAlertDto,
  PricePointDto,
  ProductDto,
  ProductFilter,
  ProviderSettingDto,
  Repository,
  SellerDto,
  SyncResult,
} from "./types";

function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    model: product.model,
    category: product.category,
    storage: product.storage,
    ram: product.ram,
    color: product.color,
    condition: product.condition,
    releaseYear: product.releaseYear,
    imageUrl: product.imageUrl,
    attributes: product.attributes as ProductDto["attributes"],
  };
}

function toSellerDto(seller: {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
  tagline: string | null;
  rating: number | null;
  reviewCount: number;
  supportsAffiliate: boolean;
  allowRedirects: boolean;
}): SellerDto {
  return {
    id: seller.id,
    slug: seller.slug,
    name: seller.name,
    websiteUrl: seller.websiteUrl,
    logoUrl: seller.logoUrl,
    tagline: seller.tagline,
    rating: seller.rating,
    reviewCount: seller.reviewCount,
    supportsAffiliate: seller.supportsAffiliate,
    allowRedirects: seller.allowRedirects,
  };
}

function toListingDto(listing: {
  id: string;
  productId: string;
  sellerId: string;
  targetUrl: string;
  price: number;
  originalPrice: number | null;
  discountPct: number | null;
  condition: string | null;
  storage: number | null;
  inStock: boolean;
  stockStatus: string;
  sellerRating: number | null;
  offerBadge: string | null;
  isDemo: boolean;
  fetchedAt: Date;
  product: Product;
  seller: {
    id: string;
    slug: string;
    name: string;
    websiteUrl: string;
    logoUrl: string | null;
    tagline: string | null;
    rating: number | null;
    reviewCount: number;
    supportsAffiliate: boolean;
    allowRedirects: boolean;
  };
}): ListingDto {
  return {
    id: listing.id,
    productId: listing.productId,
    sellerId: listing.sellerId,
    targetUrl: listing.targetUrl,
    price: listing.price,
    originalPrice: listing.originalPrice,
    discountPct: listing.discountPct,
    condition: listing.condition,
    storage: listing.storage,
    inStock: listing.inStock,
    stockStatus: listing.stockStatus as ListingDto["stockStatus"],
    sellerRating: listing.sellerRating,
    offerBadge: listing.offerBadge,
    isDemo: listing.isDemo,
    fetchedAt: listing.fetchedAt.toISOString(),
    product: toProductDto(listing.product),
    seller: toSellerDto(listing.seller),
  };
}

const listingInclude = {
  product: true,
  seller: true,
} as const;

export const prismaRepository: Repository = {
  async listProducts(filter: ProductFilter = {}) {
    const where: Record<string, unknown> = {};

    if (filter.query) {
      where.OR = [
        { name: { contains: filter.query, mode: "insensitive" } },
        { brand: { contains: filter.query, mode: "insensitive" } },
        { model: { contains: filter.query, mode: "insensitive" } },
      ];
    }
    if (filter.brand) {
      where.brand = filter.brand;
    }

    // Price-range filtering needs a MIN(price) correlated lookup; do it with
    // raw SQL (same semantics as the sqlite driver) when requested.
    if (
      filter.minPrice !== undefined ||
      filter.maxPrice !== undefined ||
      filter.sort !== undefined
    ) {
      const clauses: string[] = [];
      const params: unknown[] = [];
      const priceExpr =
        '(SELECT MIN(l.price) FROM "Listing" l WHERE l."productId" = p."id" AND l."inStock" = true)';

      const add = (value: unknown) => {
        params.push(value);
        return `$${params.length}`;
      };

      if (filter.query) {
        const like = `%${filter.query}%`;
        clauses.push(
          `(p."name" ILIKE ${add(like)} OR p."brand" ILIKE ${add(like)} OR p."model" ILIKE ${add(like)})`,
        );
      }
      if (filter.brand) {
        clauses.push(`p."brand" = ${add(filter.brand)}`);
      }
      if (filter.minPrice !== undefined && filter.maxPrice !== undefined) {
        clauses.push(
          `COALESCE(${priceExpr}, 999999999) BETWEEN ${add(filter.minPrice)} AND ${add(filter.maxPrice)}`,
        );
      } else if (filter.minPrice !== undefined) {
        clauses.push(`COALESCE(${priceExpr}, 999999999) >= ${add(filter.minPrice)}`);
      } else if (filter.maxPrice !== undefined) {
        clauses.push(`COALESCE(${priceExpr}, 999999999) <= ${add(filter.maxPrice)}`);
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const orderBy =
        filter.sort === "price_desc"
          ? `${priceExpr} DESC`
          : filter.sort === "rating_desc"
            ? `(SELECT MAX(l."sellerRating") FROM "Listing" l WHERE l."productId" = p."id" AND l."inStock" = true) DESC`
            : filter.sort === "discount_desc"
              ? `(SELECT MAX(l."discount") FROM "Listing" l WHERE l."productId" = p."id" AND l."inStock" = true) DESC`
              : filter.sort === "price_asc"
                ? `${priceExpr} ASC`
                : `p."createdAt" DESC`;

      const limit = Math.min(filter.limit ?? 24, 60);
      const limitParam = add(limit);

      const rows = (await prisma.$queryRawUnsafe(
        `SELECT p.*, ${priceExpr} AS "bestPrice"
         FROM "Product" p ${whereClause}
         ORDER BY ${orderBy}
         LIMIT ${limitParam}`,
        ...params,
      )) as Array<Record<string, unknown>>;

      return rows.map((row) => {
        const dto = toProductDto(row as unknown as Product);
        (dto as ProductDto & { bestPrice?: number }).bestPrice =
          row.bestPrice === null || row.bestPrice === undefined
            ? undefined
            : Number(row.bestPrice);
        return dto;
      });
    }

    const rows = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: Math.min(filter.limit ?? 24, 60),
    });
    return rows.map(toProductDto);
  },

  async countProducts(filter: ProductFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.query) {
      where.OR = [
        { name: { contains: filter.query, mode: "insensitive" } },
        { brand: { contains: filter.query, mode: "insensitive" } },
        { model: { contains: filter.query, mode: "insensitive" } },
      ];
    }
    if (filter.brand) where.brand = filter.brand;
    return prisma.product.count({ where });
  },

  async getProductBySlug(slug) {
    const row = await prisma.product.findUnique({ where: { slug } });
    return row ? toProductDto(row) : null;
  },

  async listListingsForProduct(productId) {
    const rows = await prisma.listing.findMany({
      where: { productId },
      orderBy: { price: "asc" },
      include: listingInclude,
    });
    return rows.map(toListingDto);
  },

  async listDeals(limit = 8) {
    const rows = await prisma.listing.findMany({
      where: { inStock: true, discountPct: { gt: 0 } },
      orderBy: [{ discountPct: "desc" }, { price: "asc" }],
      take: Math.min(limit, 60),
      include: listingInclude,
    });
    return rows.map(toListingDto);
  },

  async getListingById(id) {
    const row = await prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });
    return row ? toListingDto(row) : null;
  },

  async bestListingForProduct(productId) {
    const row = await prisma.listing.findFirst({
      where: { productId, inStock: true },
      orderBy: { price: "asc" },
      include: listingInclude,
    });
    return row ? toListingDto(row) : null;
  },

  async brandCounts() {
    const groups = await prisma.product.groupBy({
      by: ["brand"],
      _count: { _all: true },
    });
    return groups.map((g) => ({
      brand: g.brand,
      count: g._count._all,
    }));
  },

  async getPriceHistory(productId, days = 45) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await prisma.priceHistoryPoint.findMany({
      where: { productId, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
      include: { seller: { select: { name: true } } },
    });
    return rows.map(
      (row): PricePointDto => ({
        id: row.id,
        productId: row.productId,
        sellerId: row.sellerId,
        price: row.price,
        recordedAt: row.recordedAt.toISOString(),
        sellerName: row.seller.name,
      }),
    );
  },

  async createPriceAlert(data) {
    const row = await prisma.priceAlert.create({
      data: { ...data, status: "active" },
    });
    return toAlertDto(row);
  },

  async listPriceAlerts(email) {
    const rows = await prisma.priceAlert.findMany({
      where: email ? { email } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toAlertDto);
  },

  async recordClick(data) {
    await prisma.click.create({
      data: {
        id: crypto.randomUUID(),
        listingId: data.listingId,
        userAgent: data.userAgent,
        referer: data.referer,
      },
    });
  },

  async getProviderSettings() {
    const rows = await prisma.providerSetting.findMany({
      orderBy: { provider: "asc" },
    });
    return rows.map(
      (row): ProviderSettingDto => ({
        id: row.id,
        provider: row.provider,
        label: row.label,
        sourceType: row.sourceType,
        enabled: row.enabled,
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        nextSyncAt: row.nextSyncAt?.toISOString() ?? null,
        rowsProcessed: row.rowsProcessed,
        disabledReason: row.disabledReason,
      }),
    );
  },

  async setProviderEnabled(provider, enabled) {
    await prisma.providerSetting.updateMany({
      where: { provider },
      data: { enabled },
    });
  },

  async logSync(result: SyncResult) {
    await prisma.syncLog.create({
      data: {
        id: crypto.randomUUID(),
        provider: result.provider,
        status: result.status,
        startedAt: new Date(),
        finishedAt: new Date(),
        errorMessage: result.errorMessage,
        rowsAdded: result.rowsAdded,
        rowsUpdated: result.rowsUpdated,
      },
    });
    await prisma.providerSetting.updateMany({
      where: { provider: result.provider },
      data: {
        lastSyncAt: new Date(),
        rowsProcessed: result.rowsAdded + result.rowsUpdated,
      },
    });
  },

  async importListings(listings: FeedListing[]) {
    let added = 0;
    let updated = 0;
    for (const listing of listings) {
      const product = await prisma.product.findUnique({
        where: { slug: listing.productSlug },
        select: { id: true },
      });
      const seller = await prisma.seller.findUnique({
        where: { slug: listing.sellerSlug },
        select: { id: true, rating: true },
      });
      if (!product || !seller) continue;

      const existing = await prisma.listing.findUnique({
        where: {
          productId_sellerId: {
            productId: product.id,
            sellerId: seller.id,
          },
        },
        select: { id: true },
      });

      const data = {
        productId: product.id,
        sellerId: seller.id,
        targetUrl: listing.targetUrl,
        price: listing.price,
        originalPrice: listing.originalPrice,
        discountPct: listing.discountPct,
        condition: listing.condition,
        storage: listing.storage,
        inStock: listing.inStock,
        stockStatus: listing.stockStatus,
        sellerRating: seller.rating,
        offerBadge: listing.offerBadge,
        isDemo: false,
        fetchedAt: new Date(),
      };

      if (existing) {
        await prisma.listing.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.listing.create({
          data: {
            id: crypto.randomUUID(),
            ...data,
          },
        });
        added++;
      }
    }
    return { added, updated };
  },

  async seedDemo() {
    await seedDemoData();
  },

  async isSeeded() {
    const count = await prisma.product.count();
    return count > 0;
  },
};

function toAlertDto(row: {
  id: string;
  productId: string;
  email: string;
  targetPrice: number;
  status: string;
  createdAt: Date;
}): PriceAlertDto {
  return {
    id: row.id,
    productId: row.productId,
    email: row.email,
    targetPrice: row.targetPrice,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

async function seedDemoData(): Promise<void> {
  const { PRODUCTS, SELLERS, buildDemoListings, buildDemoPriceHistory } =
    await import("@/services/ingestion/mock/data");
  const { PROVIDER_REGISTRY } = await import(
    "@/services/ingestion/providers/registry"
  );

  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        brand: product.brand,
        model: product.model,
        storage: product.storage,
        attributes: product.attributes as unknown as object,
      },
      create: {
        id: `prod_${product.slug}`,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        model: product.model,
        category: product.category,
        storage: product.storage,
        ram: product.ram,
        color: product.color,
        condition: product.condition,
        releaseYear: product.releaseYear,
        imageUrl: product.imageUrl,
        attributes: product.attributes as unknown as object,
      },
    });
  }

  for (const seller of SELLERS) {
    await prisma.seller.upsert({
      where: { slug: seller.slug },
      update: { name: seller.name, websiteUrl: seller.websiteUrl },
      create: {
        id: `seller_${seller.slug}`,
        slug: seller.slug,
        name: seller.name,
        websiteUrl: seller.websiteUrl,
        logoUrl: seller.logoUrl,
        tagline: seller.tagline,
        rating: seller.rating,
        reviewCount: seller.reviewCount,
        supportsAffiliate: seller.supportsAffiliate,
        allowRedirects: seller.allowRedirects,
      },
    });
  }

  for (const provider of PROVIDER_REGISTRY) {
    await prisma.providerSetting.upsert({
      where: { provider: provider.slug },
      update: {
        label: provider.label,
        sourceType: provider.sourceType,
        disabledReason: provider.disabledReason,
        config: (provider.defaultConfig ?? {}) as object,
      },
      create: {
        id: `provider_${provider.slug}`,
        provider: provider.slug,
        label: provider.label,
        sourceType: provider.sourceType,
        enabled: provider.defaultEnabled,
        config: (provider.defaultConfig ?? {}) as object,
        disabledReason: provider.disabledReason,
      },
    });
  }

  for (const listing of buildDemoListings()) {
    const product = await prisma.product.findUnique({
      where: { slug: listing.productSlug },
      select: { id: true },
    });
    const seller = await prisma.seller.findUnique({
      where: { slug: listing.sellerSlug },
      select: { id: true, rating: true },
    });
    if (!product || !seller) continue;

    await prisma.listing.upsert({
      where: {
        productId_sellerId: {
          productId: product.id,
          sellerId: seller.id,
        },
      },
      update: {
        targetUrl: listing.targetUrl,
        price: listing.price,
        originalPrice: listing.originalPrice,
        discountPct: listing.discountPct,
        condition: listing.condition,
        storage: listing.storage,
        inStock: listing.inStock,
        stockStatus: listing.stockStatus,
        offerBadge: listing.offerBadge,
        isDemo: true,
        fetchedAt: new Date(),
      },
      create: {
        id: `listing_${listing.productSlug}_${listing.sellerSlug}`,
        productId: product.id,
        sellerId: seller.id,
        targetUrl: listing.targetUrl,
        price: listing.price,
        originalPrice: listing.originalPrice,
        discountPct: listing.discountPct,
        condition: listing.condition,
        storage: listing.storage,
        inStock: listing.inStock,
        stockStatus: listing.stockStatus,
        sellerRating: seller.rating,
        offerBadge: listing.offerBadge,
        isDemo: true,
        fetchedAt: new Date(),
      },
    });
  }

  const historyCount = await prisma.priceHistoryPoint.count();
  if (historyCount === 0) {
    const productById = new Map(PRODUCTS.map((p) => [p.slug, `prod_${p.slug}`]));
    const sellerById = new Map(SELLERS.map((s) => [s.slug, `seller_${s.slug}`]));
    const rows = await prisma.priceHistoryPoint.createMany({
      data: buildDemoPriceHistory(45).flatMap((point) => {
        const productId = productById.get(point.productSlug);
        const sellerId = sellerById.get(point.sellerSlug);
        if (!productId || !sellerId) return [];
        return [
          {
            id: crypto.randomUUID(),
            productId,
            sellerId,
            price: point.price,
            recordedAt: new Date(point.date),
            source: "seed",
          },
        ];
      }),
    });
    void rows;
  }
}