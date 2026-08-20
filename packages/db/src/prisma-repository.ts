import type {
  AdminUser,
  AuditLogEntry,
  ClickFilter,
  ClickRow,
  Listing,
  ListingWithRelations,
  PriceAlert,
  PriceHistoryPoint,
  Product,
  ProductFilter,
  ProductWithBest,
  Provider,
  ProviderAuthorization,
  ProviderWithAuthorization,
  Repository,
  SearchQueryRecord,
  StaleListing,
  SyncError,
  SyncJob,
  UpsertListingInput,
  UpsertListingResult,
  UpsertProductInput,
  UpsertProviderSettingsInput,
} from '@refurbcompare/core';
import type { PrismaClient } from '../generated/client/index.js';
import { getPrismaClient } from './prisma/client.js';

const IN_STOCK = 'IN_STOCK';

function toProvider(row: Record<string, unknown> & {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoUrl: string | null;
  mode: string;
  status: string;
  active: boolean;
  trustScore: number;
  isDemo: boolean;
  defaultEnabled: boolean;
  disabledReason: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Provider {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    website: row.website,
    logoUrl: row.logoUrl,
    mode: row.mode as Provider['mode'],
    status: row.status as Provider['status'],
    active: row.active,
    trustScore: row.trustScore,
    isDemo: row.isDemo,
    defaultEnabled: row.defaultEnabled,
    disabledReason: row.disabledReason,
    lastSyncAt: row.lastSyncAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toProduct(row: Record<string, unknown> & {
  id: string;
  brand: string;
  model: string;
  modelNumber: string | null;
  variant: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  network: string | null;
  slug: string;
  imageUrl: string | null;
  images: unknown;
  specifications: unknown;
  matchingConfidence: number;
  matchingMethod: string;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    modelNumber: row.modelNumber,
    variant: row.variant,
    storage: row.storage,
    ram: row.ram,
    color: row.color,
    network: row.network,
    slug: row.slug,
    imageUrl: row.imageUrl,
    images: (Array.isArray(row.images) ? row.images : []) as string[],
    specifications: (row.specifications && typeof row.specifications === 'object' ? row.specifications : {}) as Record<string, unknown>,
    matchingConfidence: row.matchingConfidence,
    matchingMethod: row.matchingMethod as Product['matchingMethod'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toListing(row: Record<string, unknown> & {
  id: string;
  productId: string;
  providerId: string;
  sourceProductId: string;
  sourceUrl: string;
  affiliateUrl: string | null;
  price: number;
  originalPrice: number | null;
  discount: number | null;
  normalizedCondition: string;
  sourceCondition: string | null;
  conditionScore: number;
  conditionDescription: string | null;
  warrantyMonths: number;
  returnDays: number;
  batteryHealth: number | null;
  stockStatus: string;
  deliveryEstimate: string | null;
  sellerName: string;
  sellerRating: number | null;
  lastCheckedAt: Date;
  priceUpdatedAt: Date;
  consecutiveSyncFailures: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Listing {
  return {
    id: row.id,
    productId: row.productId,
    providerId: row.providerId,
    sourceProductId: row.sourceProductId,
    sourceUrl: row.sourceUrl,
    affiliateUrl: row.affiliateUrl,
    price: row.price,
    originalPrice: row.originalPrice,
    discount: row.discount,
    normalizedCondition: row.normalizedCondition as Listing['normalizedCondition'],
    sourceCondition: row.sourceCondition,
    conditionScore: row.conditionScore,
    conditionDescription: row.conditionDescription,
    warrantyMonths: row.warrantyMonths,
    returnDays: row.returnDays,
    batteryHealth: row.batteryHealth,
    stockStatus: row.stockStatus as Listing['stockStatus'],
    deliveryEstimate: row.deliveryEstimate,
    sellerName: row.sellerName,
    sellerRating: row.sellerRating,
    lastCheckedAt: row.lastCheckedAt,
    priceUpdatedAt: row.priceUpdatedAt,
    consecutiveSyncFailures: row.consecutiveSyncFailures,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaRepository implements Repository {
  readonly driver = 'prisma' as const;
  private client: PrismaClient;

  constructor(client?: PrismaClient, connectionString?: string) {
    this.client = client ?? getPrismaClient(connectionString);
  }

  async init(): Promise<void> {
    await this.client.$connect();
  }

  // ---------------- products ----------------

  async listProducts(filter: ProductFilter): Promise<{ items: ProductWithBest[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filter.brand) where.brand = filter.brand;
    if (filter.model) where.model = { contains: filter.model, mode: 'insensitive' };
    if (filter.query) {
      where.OR = [
        { brand: { contains: filter.query, mode: 'insensitive' } },
        { model: { contains: filter.query, mode: 'insensitive' } },
        { modelNumber: { contains: filter.query, mode: 'insensitive' } },
      ];
    }
    const listingWhere = this.listingWhere(filter.liveVisibleOnly === true);
    if (filter.minPrice != null) listingWhere.price = { gte: filter.minPrice };
    if (filter.maxPrice != null) listingWhere.price = { ...(listingWhere.price as object), lte: filter.maxPrice };
    if (filter.condition) listingWhere.normalizedCondition = filter.condition;

    if (filter.minPrice != null || filter.maxPrice != null || filter.condition || filter.inStock != null) {
      where.listings = { some: listingWhere };
    }

    const [rows, total] = await Promise.all([
      this.client.product.findMany({
        where,
        include: { listings: { where: listingWhere } },
        orderBy: this.sortOrder(filter.sort),
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.client.product.count({ where }),
    ]);

    const items = rows.map((row) => this.withBest(row));
    return { items, total };
  }

  private sortOrder(sort?: ProductFilter['sort']): Record<string, unknown>[] {
    switch (sort) {
      case 'price_asc':
        return [{ listings: { _count: 'desc' } }];
      case 'price_desc':
        return [{ updatedAt: 'desc' }];
      case 'discount_desc':
        return [{ updatedAt: 'desc' }];
      case 'rating_desc':
        return [{ updatedAt: 'desc' }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private withBest(row: { [K in keyof Product]?: unknown } & { listings?: Array<Record<string, unknown>> }): ProductWithBest {
    const listings = (row.listings ?? []) as Array<Record<string, unknown> & {
      price: number;
      discount: number | null;
      sellerRating: number | null;
      normalizedCondition: string;
    }>;
    const prices = listings.map((l) => l.price);
    const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
    const bestDiscount = listings.reduce<number | null>((acc, l) => (l.discount != null && (acc == null || l.discount > acc) ? l.discount : acc), null);
    const bestRating = listings.reduce<number | null>((acc, l) => (l.sellerRating != null && (acc == null || l.sellerRating > acc) ? l.sellerRating : acc), null);
    const bestListing = listings.slice().sort((a, b) => a.price - b.price)[0];

    const base = toProduct(row as Parameters<typeof toProduct>[0]);
    return {
      ...base,
      bestPrice,
      bestDiscount,
      bestRating,
      bestCondition: bestListing?.normalizedCondition as ProductWithBest['bestCondition'] ?? null,
      listingCount: listings.length,
    };
  }

  private listingWhere(liveVisibleOnly: boolean): Record<string, unknown> {
    const where: Record<string, unknown> = { stockStatus: IN_STOCK, archivedAt: null };
    if (liveVisibleOnly) {
      where.sourceProductId = { not: { startsWith: 'demo-' } };
      where.provider = { active: true, isDemo: false };
    }
    return where;
  }

  async getProductBySlug(slug: string, opts?: { liveVisibleOnly?: boolean }): Promise<ProductWithBest | null> {
    const row = await this.client.product.findUnique({
      where: { slug },
      include: { listings: { where: this.listingWhere(opts?.liveVisibleOnly === true) } },
    });
    return row ? this.withBest(row) : null;
  }

  async getProductById(id: string, opts?: { liveVisibleOnly?: boolean }): Promise<ProductWithBest | null> {
    const row = await this.client.product.findUnique({
      where: { id },
      include: { listings: { where: this.listingWhere(opts?.liveVisibleOnly === true) } },
    });
    return row ? this.withBest(row) : null;
  }

  async listProductsForSync(): Promise<Array<Pick<Product, 'id' | 'brand' | 'model' | 'modelNumber' | 'storage' | 'ram' | 'color' | 'variant'>>> {
    const rows = await this.client.product.findMany({
      select: { id: true, brand: true, model: true, modelNumber: true, storage: true, ram: true, color: true, variant: true },
    });
    return rows as unknown as Array<Pick<Product, 'id' | 'brand' | 'model' | 'modelNumber' | 'storage' | 'ram' | 'color' | 'variant'>>;
  }

  async upsertProduct(input: UpsertProductInput): Promise<Product> {
    const data = {
      brand: input.brand,
      model: input.model,
      modelNumber: input.modelNumber ?? null,
      variant: input.variant ?? null,
      storage: input.storage ?? null,
      ram: input.ram ?? null,
      color: input.color ?? null,
      network: input.network ?? null,
      slug: input.slug,
      imageUrl: input.imageUrl ?? null,
      images: (input.images ?? []) as never,
      specifications: (input.specifications ?? {}) as never,
      matchingConfidence: input.matchingConfidence,
      matchingMethod: input.matchingMethod,
    };
    const row = await this.client.product.upsert({
      where: { id: input.id },
      create: { ...data, id: input.id },
      update: data,
    });
    return toProduct(row as unknown as Parameters<typeof toProduct>[0]);
  }

  async updateProduct(id: string, patch: Partial<UpsertProductInput>): Promise<Product | null> {
    const existing = await this.client.product.findUnique({ where: { id } });
    if (!existing) return null;
    const data: Record<string, unknown> = {};
    if (patch.brand !== undefined) data.brand = patch.brand;
    if (patch.model !== undefined) data.model = patch.model;
    if (patch.modelNumber !== undefined) data.modelNumber = patch.modelNumber;
    if (patch.variant !== undefined) data.variant = patch.variant;
    if (patch.storage !== undefined) data.storage = patch.storage;
    if (patch.ram !== undefined) data.ram = patch.ram;
    if (patch.color !== undefined) data.color = patch.color;
    if (patch.network !== undefined) data.network = patch.network;
    if (patch.slug !== undefined) data.slug = patch.slug;
    if (patch.imageUrl !== undefined) data.imageUrl = patch.imageUrl;
    if (patch.images !== undefined) data.images = patch.images;
    if (patch.specifications !== undefined) data.specifications = patch.specifications;
    if (patch.matchingConfidence !== undefined) data.matchingConfidence = patch.matchingConfidence;
    if (patch.matchingMethod !== undefined) data.matchingMethod = patch.matchingMethod;
    const row = await this.client.product.update({ where: { id }, data });
    return toProduct(row as unknown as Parameters<typeof toProduct>[0]);
  }

  async brandCounts(): Promise<Array<{ brand: string; count: number }>> {
    const rows = await this.client.product.groupBy({ by: ['brand'], _count: { _all: true }, orderBy: { _count: { brand: 'desc' } } });
    return rows.map((r) => ({ brand: r.brand, count: r._count._all }));
  }

  // ---------------- listings ----------------

  private listingInclude = {
    product: { select: { id: true, brand: true, model: true, slug: true } },
    provider: { select: { id: true, name: true, slug: true, trustScore: true, website: true } },
  } as const;

  async listListingsForProduct(productId: string, includeArchived = false): Promise<ListingWithRelations[]> {
    const rows = await this.client.listing.findMany({
      where: { productId, ...(includeArchived ? {} : { archivedAt: null }) },
      include: this.listingInclude,
      orderBy: { price: 'asc' },
    });
    return rows.map((r) => this.toListingWithRelations(r));
  }

  async listActiveListings(): Promise<ListingWithRelations[]> {
    const rows = await this.client.listing.findMany({
      where: { archivedAt: null, stockStatus: IN_STOCK },
      include: this.listingInclude,
      orderBy: { price: 'asc' },
    });
    return rows.map((r) => this.toListingWithRelations(r));
  }

  async getListingById(id: string): Promise<ListingWithRelations | null> {
    const row = await this.client.listing.findUnique({ where: { id }, include: this.listingInclude });
    return row ? this.toListingWithRelations(row) : null;
  }

  private toListingWithRelations(row: Parameters<typeof toListing>[0] & { product?: unknown; provider?: unknown }): ListingWithRelations {
    return {
      ...toListing(row),
      product: row.product as ListingWithRelations['product'],
      provider: row.provider as ListingWithRelations['provider'],
    };
  }

  async upsertListing(input: UpsertListingInput): Promise<UpsertListingResult> {
    const existing = await this.client.listing.findUnique({
      where: { providerId_sourceProductId: { providerId: input.providerId, sourceProductId: input.sourceProductId } },
    });
    const nowD = new Date();

    if (!existing) {
      const created = await this.client.listing.create({
        data: {
          id: input.id,
          productId: input.productId,
          providerId: input.providerId,
          sourceProductId: input.sourceProductId,
          sourceUrl: input.sourceUrl,
          affiliateUrl: input.affiliateUrl ?? null,
          price: input.price,
          originalPrice: input.originalPrice ?? null,
          discount: input.discount ?? null,
          normalizedCondition: input.normalizedCondition,
          sourceCondition: input.sourceCondition ?? null,
          conditionScore: input.conditionScore,
          conditionDescription: input.conditionDescription ?? null,
          warrantyMonths: input.warrantyMonths,
          returnDays: input.returnDays,
          batteryHealth: input.batteryHealth ?? null,
          stockStatus: input.stockStatus,
          deliveryEstimate: input.deliveryEstimate ?? null,
          sellerName: input.sellerName ?? '',
          sellerRating: input.sellerRating ?? null,
          lastCheckedAt: input.lastCheckedAt,
          priceUpdatedAt: input.priceUpdatedAt,
        },
      });
      await this.client.priceHistoryPoint.create({
        data: { id: `php_${crypto.randomUUID()}`, listingId: created.id, price: input.price, recordedAt: input.priceUpdatedAt },
      });
      return {
        status: 'added',
        listing: toListing(created as unknown as Parameters<typeof toListing>[0]),
        priceChanged: true,
        wasOutOfStock: input.stockStatus === IN_STOCK,
      };
    }

    const samePrice = existing.price === input.price;
    const sameStock = existing.stockStatus === input.stockStatus;
    const unchanged = samePrice && sameStock && existing.normalizedCondition === input.normalizedCondition
      && existing.warrantyMonths === input.warrantyMonths && existing.returnDays === input.returnDays;

    const updated = await this.client.listing.update({
      where: { id: existing.id },
      data: {
        productId: input.productId,
        sourceUrl: input.sourceUrl,
        affiliateUrl: input.affiliateUrl ?? null,
        price: input.price,
        originalPrice: input.originalPrice ?? null,
        discount: input.discount ?? null,
        normalizedCondition: input.normalizedCondition,
        sourceCondition: input.sourceCondition ?? null,
        conditionScore: input.conditionScore,
        conditionDescription: input.conditionDescription ?? null,
        warrantyMonths: input.warrantyMonths,
        returnDays: input.returnDays,
        batteryHealth: input.batteryHealth ?? null,
        stockStatus: input.stockStatus,
        deliveryEstimate: input.deliveryEstimate ?? null,
        sellerName: input.sellerName ?? '',
        sellerRating: input.sellerRating ?? null,
        lastCheckedAt: input.lastCheckedAt,
        priceUpdatedAt: samePrice ? existing.priceUpdatedAt : input.priceUpdatedAt,
        archivedAt: input.stockStatus === 'ARCHIVED' ? input.lastCheckedAt : null,
        consecutiveSyncFailures: 0,
      },
    });

    if (!samePrice) {
      await this.client.priceHistoryPoint.create({
        data: { id: `php_${crypto.randomUUID()}`, listingId: existing.id, price: input.price, recordedAt: input.priceUpdatedAt },
      });
    }

    return {
      status: unchanged ? 'skipped' : 'updated',
      listing: toListing(updated as unknown as Parameters<typeof toListing>[0]),
      priceChanged: !samePrice,
      wasOutOfStock: !sameStock && existing.stockStatus !== IN_STOCK && input.stockStatus === IN_STOCK,
    };
  }

  async updateListing(id: string, patch: Partial<Omit<UpsertListingInput, 'id'>>): Promise<Listing | null> {
    const existing = await this.client.listing.findUnique({ where: { id } });
    if (!existing) return null;
    const data: Record<string, unknown> = {};
    if (patch.sourceUrl !== undefined) data.sourceUrl = patch.sourceUrl;
    if (patch.affiliateUrl !== undefined) data.affiliateUrl = patch.affiliateUrl;
    if (patch.price !== undefined) data.price = patch.price;
    if (patch.originalPrice !== undefined) data.originalPrice = patch.originalPrice;
    if (patch.discount !== undefined) data.discount = patch.discount;
    if (patch.normalizedCondition !== undefined) data.normalizedCondition = patch.normalizedCondition;
    if (patch.sourceCondition !== undefined) data.sourceCondition = patch.sourceCondition;
    if (patch.conditionScore !== undefined) data.conditionScore = patch.conditionScore;
    if (patch.conditionDescription !== undefined) data.conditionDescription = patch.conditionDescription;
    if (patch.warrantyMonths !== undefined) data.warrantyMonths = patch.warrantyMonths;
    if (patch.returnDays !== undefined) data.returnDays = patch.returnDays;
    if (patch.batteryHealth !== undefined) data.batteryHealth = patch.batteryHealth;
    if (patch.stockStatus !== undefined) data.stockStatus = patch.stockStatus;
    if (patch.deliveryEstimate !== undefined) data.deliveryEstimate = patch.deliveryEstimate;
    if (patch.sellerName !== undefined) data.sellerName = patch.sellerName;
    if (patch.sellerRating !== undefined) data.sellerRating = patch.sellerRating;
    if (patch.lastCheckedAt !== undefined) data.lastCheckedAt = patch.lastCheckedAt;
    if (patch.priceUpdatedAt !== undefined) data.priceUpdatedAt = patch.priceUpdatedAt;
    const row = await this.client.listing.update({ where: { id }, data });
    return toListing(row as unknown as Parameters<typeof toListing>[0]);
  }

  async archiveListing(id: string): Promise<Listing | null> {
    const existing = await this.client.listing.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await this.client.listing.update({ where: { id }, data: { archivedAt: new Date(), stockStatus: 'ARCHIVED' } });
    return toListing(row as unknown as Parameters<typeof toListing>[0]);
  }

  async archiveDemoListings(): Promise<number> {
    const result = await this.client.listing.updateMany({
      where: { archivedAt: null, sourceProductId: { startsWith: 'demo-' } },
      data: { archivedAt: new Date(), stockStatus: 'ARCHIVED' },
    });
    return result.count;
  }

  async markStaleListings(opts: { maxFailures: number; limit: number }): Promise<StaleListing[]> {
    const rows = await this.client.listing.findMany({
      where: { archivedAt: null, consecutiveSyncFailures: { gte: opts.maxFailures } },
      select: { id: true, providerId: true, sourceProductId: true, consecutiveSyncFailures: true },
      orderBy: { consecutiveSyncFailures: 'desc' },
      take: opts.limit,
    });
    return rows.map((r) => ({ id: r.id, providerId: r.providerId, sourceProductId: r.sourceProductId, consecutiveSyncFailures: r.consecutiveSyncFailures }));
  }

  // ---------------- price history ----------------

  async getPriceHistory(productId: string, days: number): Promise<Array<{ date: string; price: number }>> {
    const since = new Date(Date.now() - days * 86400000);
    const rows = await this.client.priceHistoryPoint.findMany({
      where: { listing: { productId }, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
    });
    const byDay = new Map<string, number[]>();
    for (const row of rows) {
      const day = row.recordedAt.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? [];
      bucket.push(row.price);
      byDay.set(day, bucket);
    }
    return [...byDay.entries()].map(([date, prices]) => ({
      date,
      price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    }));
  }

  async recordPricePoint(listingId: string, price: number, at = new Date()): Promise<PriceHistoryPoint> {
    return this.client.priceHistoryPoint.create({
      data: { id: `php_${crypto.randomUUID()}`, listingId, price, recordedAt: at },
    }) as Promise<PriceHistoryPoint>;
  }

  async purgeOldPriceHistory(before: Date): Promise<number> {
    const res = await this.client.priceHistoryPoint.deleteMany({ where: { recordedAt: { lt: before } } });
    return res.count;
  }

  // ---------------- providers ----------------

  async listProviders(): Promise<ProviderWithAuthorization[]> {
    const rows = await this.client.provider.findMany({
      orderBy: [{ isDemo: 'desc' }, { name: 'asc' }],
      include: { authorization: true },
    });
    return rows.map((r) => ({ ...toProvider(r as unknown as Parameters<typeof toProvider>[0]), authorization: r.authorization }));
  }

  async getProviderBySlug(slug: string): Promise<ProviderWithAuthorization | null> {
    const row = await this.client.provider.findUnique({ where: { slug }, include: { authorization: true } });
    return row ? { ...toProvider(row as unknown as Parameters<typeof toProvider>[0]), authorization: row.authorization } : null;
  }

  async getProviderById(id: string): Promise<ProviderWithAuthorization | null> {
    const row = await this.client.provider.findUnique({ where: { id }, include: { authorization: true } });
    return row ? { ...toProvider(row as unknown as Parameters<typeof toProvider>[0]), authorization: row.authorization } : null;
  }

  async getProviderAuthorization(providerId: string): Promise<ProviderAuthorization | null> {
    return this.client.providerAuthorization.findUnique({ where: { providerId } });
  }

  async upsertProviderSettings(input: UpsertProviderSettingsInput): Promise<Provider> {
    const row = await this.client.provider.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        name: input.name,
        slug: input.slug,
        website: input.website,
        logoUrl: input.logoUrl ?? null,
        trustScore: input.trustScore,
      },
      update: {
        name: input.name,
        website: input.website,
        logoUrl: input.logoUrl ?? null,
        trustScore: input.trustScore,
      },
    });
    return toProvider(row as unknown as Parameters<typeof toProvider>[0]);
  }

  async updateProviderSettings(id: string, patch: Partial<UpsertProviderSettingsInput>): Promise<Provider | null> {
    const existing = await this.client.provider.findUnique({ where: { id } });
    if (!existing) return null;
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.website !== undefined) data.website = patch.website;
    if (patch.logoUrl !== undefined) data.logoUrl = patch.logoUrl;
    if (patch.trustScore !== undefined) data.trustScore = patch.trustScore;
    if (patch.lastSyncAt !== undefined) data.lastSyncAt = patch.lastSyncAt;
    const row = await this.client.provider.update({ where: { id }, data });
    return toProvider(row as unknown as Parameters<typeof toProvider>[0]);
  }

  async setProviderEnabled(
    id: string,
    opts: { enabled: boolean; disabledReason?: string | null; mode?: Provider['mode'] },
  ): Promise<Provider> {
    const existing = await this.client.provider.findUnique({ where: { id } });
    if (!existing) return toProvider(existing as unknown as Parameters<typeof toProvider>[0]);
    const status = opts.enabled ? 'CONNECTED' : existing.status === 'CONNECTED' ? 'DISABLED' : existing.status;
    const mode = opts.mode ?? (opts.enabled && existing.mode === 'DISABLED' ? 'MOCK' : existing.mode);
    const row = await this.client.provider.update({
      where: { id },
      data: { active: opts.enabled, status, mode, disabledReason: opts.disabledReason ?? null },
    });
    return toProvider(row as unknown as Parameters<typeof toProvider>[0]);
  }

  async upsertProviderAuthorization(input: Partial<ProviderAuthorization> & { providerId: string }): Promise<ProviderAuthorization> {
    const data = {
      approved: input.approved ?? false,
      authorizationType: input.authorizationType ?? 'MANUAL_IMPORT',
      permittedDomains: input.permittedDomains ?? '',
      permittedPaths: input.permittedPaths ?? '',
      permittedFields: input.permittedFields ?? '',
      maxRequestsPerMinute: input.maxRequestsPerMinute ?? 60,
      termsReviewedAt: input.termsReviewedAt ?? null,
      robotsReviewedAt: input.robotsReviewedAt ?? null,
      copyrightDataUseReviewed: input.copyrightDataUseReviewed ?? false,
      contactRecorded: input.contactRecorded ?? false,
      authorizationNotes: input.authorizationNotes ?? null,
      sourceAttributionRequired: input.sourceAttributionRequired ?? true,
      expiresAt: input.expiresAt ?? null,
    };
    const row = await this.client.providerAuthorization.upsert({
      where: { providerId: input.providerId },
      create: { ...data, providerId: input.providerId, id: `auth_${crypto.randomUUID()}` },
      update: data,
    });
    return row;
  }

  // ---------------- alerts ----------------

  async createPriceAlert(input: { productId: string; email: string; targetPrice: number }): Promise<PriceAlert> {
    const row = await this.client.priceAlert.create({
      data: { id: `alert_${crypto.randomUUID()}`, productId: input.productId, email: input.email, targetPrice: input.targetPrice },
    });
    return row as unknown as PriceAlert;
  }

  async getPriceAlertByProductAndEmail(productId: string, email: string): Promise<PriceAlert | null> {
    return this.client.priceAlert.findUnique({ where: { productId_email: { productId, email } } });
  }

  async listActiveAlerts(): Promise<PriceAlert[]> {
    return this.client.priceAlert.findMany({ where: { status: 'ACTIVE' } });
  }

  async setAlertStatus(id: string, status: PriceAlert['status']): Promise<PriceAlert | null> {
    const existing = await this.client.priceAlert.findUnique({ where: { id } });
    if (!existing) return null;
    return this.client.priceAlert.update({
      where: { id },
      data: { status, triggeredAt: status === 'TRIGGERED' ? new Date() : null },
    });
  }

  // ---------------- analytics / clicks ----------------

  async recordClick(input: {
    clickId: string;
    listingId: string;
    productId: string;
    providerId: string;
    referrer?: string | null;
    deviceType?: string | null;
    userAgentHash?: string | null;
  }): Promise<void> {
    await this.client.clickEvent.create({
      data: {
        id: `click_${crypto.randomUUID()}`,
        clickId: input.clickId,
        listingId: input.listingId,
        productId: input.productId,
        providerId: input.providerId,
        referrer: input.referrer ?? null,
        deviceType: input.deviceType ?? null,
        userAgentHash: input.userAgentHash ?? null,
      },
    });
  }

  async listClicks(filter: ClickFilter): Promise<{ items: ClickRow[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filter.providerId) where.providerId = filter.providerId;
    if (filter.from) where.createdAt = { ...(where.createdAt as object ?? {}), gte: filter.from };
    if (filter.to) where.createdAt = { ...(where.createdAt as object ?? {}), lte: filter.to };

    const [rows, total] = await Promise.all([
      this.client.clickEvent.findMany({
        where,
        include: { product: { select: { slug: true } }, provider: { select: { name: true } }, listing: { select: { price: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.client.clickEvent.count({ where }),
    ]);

    const items: ClickRow[] = rows.map((r) => ({
      id: r.id,
      clickId: r.clickId,
      listingId: r.listingId,
      productId: r.productId,
      providerId: r.providerId,
      referrer: r.referrer,
      deviceType: r.deviceType,
      userAgentHash: r.userAgentHash,
      createdAt: r.createdAt,
      productSlug: r.product.slug,
      providerName: r.provider.name,
      listingPrice: r.listing?.price ?? null,
    }));
    return { items, total };
  }

  async countClicksByProvider(opts: { from: Date; to: Date }): Promise<Array<{ providerId: string; count: number }>> {
    const rows = await this.client.clickEvent.groupBy({
      by: ['providerId'],
      where: { createdAt: { gte: opts.from, lte: opts.to } },
      _count: { _all: true },
      orderBy: { _count: { providerId: 'desc' } },
    });
    return rows.map((r) => ({ providerId: r.providerId, count: r._count._all }));
  }

  // ---------------- sync jobs ----------------

  async createSyncJob(input: { providerId: string; mode: string; source: string }): Promise<SyncJob> {
    const row = await this.client.syncJob.create({
      data: { id: `sync_${crypto.randomUUID()}`, providerId: input.providerId, mode: input.mode as never, source: input.source },
    });
    return row as unknown as SyncJob;
  }

  async updateSyncJob(id: string, patch: Partial<Pick<SyncJob, 'status' | 'finishedAt' | 'itemsSeen' | 'itemsAdded' | 'itemsUpdated' | 'itemsSkipped' | 'itemsFailed' | 'errorMessage'>>): Promise<SyncJob | null> {
    const existing = await this.client.syncJob.findUnique({ where: { id } });
    if (!existing) return null;
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      data.status = patch.status;
      if (patch.status === 'RUNNING' && !existing.startedAt) data.startedAt = new Date();
      if (['SUCCESS', 'FAILED', 'PARTIAL', 'CANCELLED'].includes(patch.status) && !existing.finishedAt) data.finishedAt = new Date();
    }
    if (patch.finishedAt !== undefined) data.finishedAt = patch.finishedAt;
    if (patch.itemsSeen !== undefined) data.itemsSeen = patch.itemsSeen;
    if (patch.itemsAdded !== undefined) data.itemsAdded = patch.itemsAdded;
    if (patch.itemsUpdated !== undefined) data.itemsUpdated = patch.itemsUpdated;
    if (patch.itemsSkipped !== undefined) data.itemsSkipped = patch.itemsSkipped;
    if (patch.itemsFailed !== undefined) data.itemsFailed = patch.itemsFailed;
    if (patch.errorMessage !== undefined) data.errorMessage = patch.errorMessage;
    const row = await this.client.syncJob.update({ where: { id }, data });
    return row as unknown as SyncJob;
  }

  async getSyncJob(id: string): Promise<SyncJob | null> {
    return this.client.syncJob.findUnique({ where: { id } });
  }

  async listRecentSyncJobs(limit: number): Promise<SyncJob[]> {
    return this.client.syncJob.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  async logSyncError(input: { jobId: string; providerId: string; errorCode: string; message: string; context?: string | null }): Promise<SyncError> {
    const row = await this.client.syncError.create({
      data: { id: `sye_${crypto.randomUUID()}`, jobId: input.jobId, providerId: input.providerId, errorCode: input.errorCode, message: input.message, context: input.context ?? null },
    });
    return row as unknown as SyncError;
  }

  async listSyncErrors(opts: { providerId?: string; limit: number }): Promise<SyncError[]> {
    return this.client.syncError.findMany({
      where: opts.providerId ? { providerId: opts.providerId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    }) as unknown as Promise<SyncError[]>;
  }

  // ---------------- search capture ----------------

  async recordSearchQuery(query: string, resultCount: number): Promise<SearchQueryRecord> {
    const row = await this.client.searchQuery.create({
      data: { id: `sq_${crypto.randomUUID()}`, query, resultCount },
    });
    return row as unknown as SearchQueryRecord;
  }

  // ---------------- admin/ops ----------------

  async createAdminUser(input: { email: string; passwordHash: string; role: AdminUser['role'] }): Promise<AdminUser> {
    const row = await this.client.adminUser.create({
      data: { id: `admin_${crypto.randomUUID()}`, email: input.email, passwordHash: input.passwordHash, role: input.role },
    });
    return row as unknown as AdminUser;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | null> {
    return this.client.adminUser.findUnique({ where: { email } });
  }

  async logAudit(input: { adminUserId: string | null; action: string; entityType: string; entityId: string; details?: string | null }): Promise<AuditLogEntry> {
    const row = await this.client.auditLog.create({
      data: { id: `audit_${crypto.randomUUID()}`, adminUserId: input.adminUserId, action: input.action, entityType: input.entityType, entityId: input.entityId, details: input.details ?? null },
    });
    return row as unknown as AuditLogEntry;
  }
}