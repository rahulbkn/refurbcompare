import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  ClickFilter,
  ClickRow,
  ProductFilter,
  Repository,
  StaleListing,
  UpsertListingInput,
  UpsertListingResult,
  UpsertProductInput,
  UpsertProviderSettingsInput,
} from '@refurbcompare/core';
import type {
  AdminUser,
  AuditLogEntry,
  ClickEvent,
  Listing,
  ListingWithRelations,
  PriceAlert,
  PriceHistoryPoint,
  Product,
  ProductWithBest,
  Provider,
  ProviderAuthorization,
  ProviderWithAuthorization,
  SearchQueryRecord,
  SyncError,
  SyncJob,
} from '@refurbcompare/core';
import type { MatchingMethod, NormalizedCondition, ProviderMode, StockStatus, SyncStatus } from '@refurbcompare/core';
import { SQLITE_DDL, databaseUrlToPath } from './sqlite/ddl.js';

const now = () => new Date().toISOString();

/** Relaxed statement typing: node:sqlite is very strict about SQLInputValue. */
interface LooseStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

interface LooseDatabase {
  exec(sql: string): void;
  prepare(sql: string): LooseStatement;
  close(): void;
}

function asIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

function asDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function jsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function jsonStr(v: unknown): string {
  if (v == null) return JSON.stringify(null);
  return JSON.stringify(v);
}

function mapProvider(row: Record<string, unknown>): Provider {
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    website: str(row.website),
    logoUrl: row.logoUrl == null ? null : str(row.logoUrl),
    mode: str(row.mode) as ProviderMode,
    status: str(row.status) as Provider['status'],
    active: num(row.active) === 1,
    trustScore: num(row.trustScore),
    isDemo: num(row.isDemo) === 1,
    defaultEnabled: num(row.defaultEnabled) === 1,
    disabledReason: row.disabledReason == null ? null : str(row.disabledReason),
    lastSyncAt: asDate(row.lastSyncAt as string | null),
    createdAt: new Date(str(row.createdAt)),
    updatedAt: new Date(str(row.updatedAt)),
  };
}

function mapAuthorization(row: Record<string, unknown> | undefined): ProviderAuthorization | null {
  if (!row) return null;
  return {
    id: str(row.id),
    providerId: str(row.providerId),
    approved: num(row.approved) === 1,
    authorizationType: str(row.authorizationType),
    permittedDomains: str(row.permittedDomains),
    permittedPaths: str(row.permittedPaths),
    permittedFields: str(row.permittedFields),
    maxRequestsPerMinute: num(row.maxRequestsPerMinute),
    termsReviewedAt: asDate(row.termsReviewedAt as string | null),
    robotsReviewedAt: asDate(row.robotsReviewedAt as string | null),
    copyrightDataUseReviewed: num(row.copyrightDataUseReviewed) === 1,
    contactRecorded: num(row.contactRecorded) === 1,
    authorizationNotes: row.authorizationNotes == null ? null : str(row.authorizationNotes),
    sourceAttributionRequired: num(row.sourceAttributionRequired) === 1,
    expiresAt: asDate(row.expiresAt as string | null),
    createdAt: new Date(str(row.createdAt)),
    updatedAt: new Date(str(row.updatedAt)),
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: str(row.id),
    brand: str(row.brand),
    model: str(row.model),
    modelNumber: row.modelNumber == null ? null : str(row.modelNumber),
    variant: row.variant == null ? null : str(row.variant),
    storage: row.storage == null ? null : num(row.storage),
    ram: row.ram == null ? null : num(row.ram),
    color: row.color == null ? null : str(row.color),
    network: row.network == null ? null : str(row.network),
    slug: str(row.slug),
    imageUrl: row.imageUrl == null ? null : str(row.imageUrl),
    images: jsonParse(str(row.images), []),
    specifications: jsonParse(str(row.specifications), {}),
    matchingConfidence: num(row.matchingConfidence),
    matchingMethod: str(row.matchingMethod) as MatchingMethod,
    createdAt: new Date(str(row.createdAt)),
    updatedAt: new Date(str(row.updatedAt)),
  };
}

function mapProductWithBest(row: Record<string, unknown>): ProductWithBest {
  return {
    ...mapProduct(row),
    bestPrice: row.bestPrice == null ? null : num(row.bestPrice),
    bestDiscount: row.bestDiscount == null ? null : num(row.bestDiscount),
    bestRating: row.bestRating == null ? null : num(row.bestRating),
    bestCondition: (row.bestCondition as NormalizedCondition | null) ?? null,
    listingCount: num(row.listingCount),
  };
}

function mapListing(row: Record<string, unknown>): Listing {
  return {
    id: str(row.id),
    productId: str(row.productId),
    providerId: str(row.providerId),
    sourceProductId: str(row.sourceProductId),
    sourceUrl: str(row.sourceUrl),
    affiliateUrl: row.affiliateUrl == null ? null : str(row.affiliateUrl),
    price: num(row.price),
    originalPrice: row.originalPrice == null ? null : num(row.originalPrice),
    discount: row.discount == null ? null : num(row.discount),
    normalizedCondition: str(row.normalizedCondition) as NormalizedCondition,
    sourceCondition: row.sourceCondition == null ? null : str(row.sourceCondition),
    conditionScore: num(row.conditionScore),
    conditionDescription: row.conditionDescription == null ? null : str(row.conditionDescription),
    warrantyMonths: num(row.warrantyMonths),
    returnDays: num(row.returnDays),
    batteryHealth: row.batteryHealth == null ? null : num(row.batteryHealth),
    stockStatus: str(row.stockStatus) as StockStatus,
    deliveryEstimate: row.deliveryEstimate == null ? null : str(row.deliveryEstimate),
    sellerName: str(row.sellerName),
    sellerRating: row.sellerRating == null ? null : num(row.sellerRating),
    lastCheckedAt: new Date(str(row.lastCheckedAt)),
    priceUpdatedAt: new Date(str(row.priceUpdatedAt)),
    consecutiveSyncFailures: num(row.consecutiveSyncFailures),
    archivedAt: asDate(row.archivedAt as string | null),
    createdAt: new Date(str(row.createdAt)),
    updatedAt: new Date(str(row.updatedAt)),
  };
}

function mapListingWithRelations(row: Record<string, unknown>): ListingWithRelations {
  const listing = {
    ...mapListing(row),
    product: row.pBrand != null ? { ...mapProduct(row), id: str(row.productId) } : null,
    provider: row.pName != null ? { ...mapProvider(row), id: str(row.providerId) } : null,
  };
  return listing;
}

/** Restricts the best-price subqueries to listings allowed to surface in
 * DATA_MODE=live: non-demo sourceProductId from an active, non-demo provider. */
function listingVisibilitySQL(): string {
  return `sourceProductId NOT LIKE 'demo-%' AND providerId IN (SELECT id FROM Provider WHERE active = 1 AND isDemo = 0)`;
}

function productSelectPrefix(liveVisibleOnly: boolean): string {
  const vis = liveVisibleOnly ? ` AND ${listingVisibilitySQL()}` : '';
  return `
SELECT p.*, s.bestPrice, s.bestDiscount, s.bestRating, s.listingCount,
  (SELECT l.normalizedCondition FROM Listing l
     WHERE l.productId = p.id AND l.stockStatus='IN_STOCK' AND l.archivedAt IS NULL${vis}
     ORDER BY l.price ASC, l.createdAt ASC LIMIT 1) AS bestCondition
FROM Product p
LEFT JOIN (
  SELECT productId,
    MIN(price) AS bestPrice,
    MAX(discount) AS bestDiscount,
    MAX(sellerRating) AS bestRating,
    COUNT(*) AS listingCount
  FROM Listing
  WHERE stockStatus='IN_STOCK' AND archivedAt IS NULL${vis}
  GROUP BY productId
) s ON s.productId = p.id
`;
}

function productSelectSQL(whereClause: string, liveVisibleOnly = false): string {
  return `${productSelectPrefix(liveVisibleOnly)}WHERE ${whereClause} ORDER BY p.createdAt DESC LIMIT 1`;
}

export function listProductsSQL(filters: Partial<ProductFilter>): { sql: string; params: (string | number | null)[] } {
  const where: string[] = [];
  const params: (string | number | null)[] = [];
  const vis = filters.liveVisibleOnly === true ? ` AND ${listingVisibilitySQL()}` : '';

  if (filters.brand) {
    where.push('p.brand = ?');
    params.push(filters.brand);
  }
  if (filters.model) {
    where.push('p.model LIKE ?');
    params.push(`%${filters.model}%`);
  }
  if (filters.query) {
    where.push('(p.brand LIKE ? OR p.model LIKE ? OR p.modelNumber LIKE ?)');
    const q = `%${filters.query}%`;
    params.push(q, q, q);
  }
  if (filters.condition) {
    where.push(`EXISTS (SELECT 1 FROM Listing l WHERE l.productId = p.id AND l.stockStatus='IN_STOCK' AND l.archivedAt IS NULL AND l.normalizedCondition = ?${vis})`);
    params.push(filters.condition);
  }
  if (filters.minPrice != null) {
    where.push(`EXISTS (SELECT 1 FROM Listing l WHERE l.productId = p.id AND l.stockStatus='IN_STOCK' AND l.price >= ?${vis})`);
    params.push(filters.minPrice);
  }
  if (filters.maxPrice != null) {
    where.push(`EXISTS (SELECT 1 FROM Listing l WHERE l.productId = p.id AND l.stockStatus='IN_STOCK' AND l.price <= ?${vis})`);
    params.push(filters.maxPrice);
  }
  if (filters.inStock === true) {
    where.push('s.bestPrice IS NOT NULL');
  } else if (filters.inStock === false) {
    where.push('s.bestPrice IS NULL');
  }

  let sortSql = 'ORDER BY p.createdAt DESC';
  if (filters.sort === 'price_asc') sortSql = 'ORDER BY s.bestPrice ASC NULLS LAST';
  if (filters.sort === 'price_desc') sortSql = 'ORDER BY s.bestPrice DESC NULLS LAST';
  if (filters.sort === 'discount_desc') sortSql = 'ORDER BY s.bestDiscount DESC NULLS LAST, s.bestPrice ASC';
  if (filters.sort === 'rating_desc') sortSql = 'ORDER BY s.bestRating DESC NULLS LAST';
  if (filters.sort === 'newest') sortSql = 'ORDER BY p.createdAt DESC';

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `${productSelectPrefix(filters.liveVisibleOnly === true)}${whereSql} ${sortSql}`;

  return { sql, params };
}

export class SqliteRepository implements Repository {
  readonly driver = 'sqlite' as const;
  private db: LooseDatabase;

  constructor(databaseUrl: string) {
    const path = databaseUrlToPath(databaseUrl);
    if (path && path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new DatabaseSync(path === '' ? ':memory:' : path) as unknown as LooseDatabase;
    this.db.exec(SQLITE_DDL);
  }

  async init(): Promise<void> {
    // DDL runs eagerly in the constructor; nothing else needed.
    return Promise.resolve();
  }

  // ---------------- products ----------------

  async listProducts(filter: ProductFilter): Promise<{ items: ProductWithBest[]; total: number }> {
    const { sql, params } = listProductsSQL(filter);
    const countSql = `SELECT COUNT(*) AS total FROM (${sql})`;
    const totalRow = this.db.prepare(countSql).get(...params) as { total: number };
    const pageSql = `${sql} LIMIT ? OFFSET ?`;
    const rows = this.db
      .prepare(pageSql)
      .all(...params, filter.pageSize, (filter.page - 1) * filter.pageSize) as unknown as Record<string, unknown>[];
    return {
      items: rows.map((r) => mapProductWithBest(r)),
      total: num(totalRow.total),
    };
  }

  async getProductBySlug(slug: string, opts?: { liveVisibleOnly?: boolean }): Promise<ProductWithBest | null> {
    const row = this.db
      .prepare(productSelectSQL(`p.slug = ?`, opts?.liveVisibleOnly === true))
      .get(slug) as Record<string, unknown> | undefined;
    return row ? mapProductWithBest(row) : null;
  }

  async getProductById(id: string, opts?: { liveVisibleOnly?: boolean }): Promise<ProductWithBest | null> {
    const row = this.db
      .prepare(productSelectSQL(`p.id = ?`, opts?.liveVisibleOnly === true))
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapProductWithBest(row) : null;
  }

  async listProductsForSync(): Promise<Array<Pick<Product, 'id' | 'brand' | 'model' | 'modelNumber' | 'storage' | 'ram' | 'color' | 'variant'>>> {
    const rows = this.db.prepare('SELECT id, brand, model, modelNumber, storage, ram, color, variant FROM Product').all() as unknown as Record<string, unknown>[];
    return rows.map((r) => ({
      id: str(r.id),
      brand: str(r.brand),
      model: str(r.model),
      modelNumber: r.modelNumber == null ? null : str(r.modelNumber),
      storage: r.storage == null ? null : num(r.storage),
      ram: r.ram == null ? null : num(r.ram),
      color: r.color == null ? null : str(r.color),
      variant: r.variant == null ? null : str(r.variant),
    }));
  }

  async upsertProduct(input: UpsertProductInput): Promise<Product> {
    const ts = now();
    const existing = this.db.prepare('SELECT id FROM Product WHERE id = ?').get(input.id) as { id: string } | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE Product SET brand=?, model=?, modelNumber=?, variant=?, storage=?, ram=?, color=?, network=?, slug=?,
            imageUrl=?, images=?, specifications=?, matchingConfidence=?, matchingMethod=?, updatedAt=? WHERE id=?`,
        )
        .run(
          input.brand,
          input.model,
          input.modelNumber ?? null,
          input.variant ?? null,
          input.storage ?? null,
          input.ram ?? null,
          input.color ?? null,
          input.network ?? null,
          input.slug,
          input.imageUrl ?? null,
          jsonStr(input.images ?? []),
          jsonStr(input.specifications ?? {}),
          input.matchingConfidence,
          input.matchingMethod,
          ts,
          input.id,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO Product (id, brand, model, modelNumber, variant, storage, ram, color, network, slug, imageUrl, images, specifications, matchingConfidence, matchingMethod, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          input.id,
          input.brand,
          input.model,
          input.modelNumber ?? null,
          input.variant ?? null,
          input.storage ?? null,
          input.ram ?? null,
          input.color ?? null,
          input.network ?? null,
          input.slug,
          input.imageUrl ?? null,
          jsonStr(input.images ?? []),
          jsonStr(input.specifications ?? {}),
          input.matchingConfidence,
          input.matchingMethod,
          ts,
          ts,
        );
    }
    const row = this.db.prepare('SELECT * FROM Product WHERE id = ?').get(input.id) as Record<string, unknown>;
    return mapProduct(row);
  }

  async updateProduct(id: string, patch: Partial<UpsertProductInput>): Promise<Product | null> {
    const existing = this.db.prepare('SELECT id FROM Product WHERE id = ?').get(id) as { id: string } | undefined;
    if (!existing) return null;
    const current = this.db.prepare('SELECT * FROM Product WHERE id = ?').get(id) as Record<string, unknown>;
    const merged: Record<string, unknown> = {
      brand: patch.brand ?? current.brand,
      model: patch.model ?? current.model,
      modelNumber: patch.modelNumber !== undefined ? patch.modelNumber ?? null : current.modelNumber,
      variant: patch.variant !== undefined ? patch.variant ?? null : current.variant,
      storage: patch.storage !== undefined ? patch.storage ?? null : current.storage,
      ram: patch.ram !== undefined ? patch.ram ?? null : current.ram,
      color: patch.color !== undefined ? patch.color ?? null : current.color,
      network: patch.network !== undefined ? patch.network ?? null : current.network,
      slug: patch.slug ?? current.slug,
      imageUrl: patch.imageUrl !== undefined ? patch.imageUrl ?? null : current.imageUrl,
      images: patch.images ? jsonStr(patch.images) : str(current.images),
      specifications: patch.specifications ? jsonStr(patch.specifications) : str(current.specifications),
      matchingConfidence: patch.matchingConfidence ?? current.matchingConfidence,
      matchingMethod: patch.matchingMethod ?? current.matchingMethod,
    };
    this.db
      .prepare(
        `UPDATE Product SET brand=?, model=?, modelNumber=?, variant=?, storage=?, ram=?, color=?, network=?, slug=?,
          imageUrl=?, images=?, specifications=?, matchingConfidence=?, matchingMethod=?, updatedAt=? WHERE id=?`,
      )
      .run(
        merged.brand,
        merged.model,
        merged.modelNumber,
        merged.variant,
        merged.storage,
        merged.ram,
        merged.color,
        merged.network,
        merged.slug,
        merged.imageUrl,
        merged.images,
        merged.specifications,
        merged.matchingConfidence,
        merged.matchingMethod,
        now(),
        id,
      );
    return mapProduct(this.db.prepare('SELECT * FROM Product WHERE id = ?').get(id) as Record<string, unknown>);
  }

  async brandCounts(): Promise<Array<{ brand: string; count: number }>> {
    const rows = this.db
      .prepare('SELECT brand, COUNT(*) AS count FROM Product GROUP BY brand ORDER BY count DESC')
      .all() as unknown as Record<string, unknown>[];
    return rows.map((r) => ({ brand: str(r.brand), count: num(r.count) }));
  }

  // ---------------- listings ----------------

  private listingRowQuery = `SELECT l.*,
    p.id AS pId, p.brand AS pBrand, p.model AS pModel, p.slug AS pSlug,
    pr.name AS pName, pr.trustScore AS pTrustScore, pr.active AS pActive,
    pr.mode AS pMode, pr.isDemo AS pIsDemo, pr.slug AS prSlug`;

  private listingBaseRows(where: string, params: unknown[]): ListingWithRelations[] {
    const rows = this.db
      .prepare(
        `${this.listingRowQuery}
         FROM Listing l
         JOIN Product p ON p.id = l.productId
         JOIN Provider pr ON pr.id = l.providerId
         ${where}
         ORDER BY l.price ASC`,
      )
      .all(...params) as unknown as Record<string, unknown>[];
    return rows.map((r) => {
      const listing = mapListing(r);
      return {
        ...listing,
        product: {
          id: str(r.pId),
          brand: str(r.pBrand),
          model: str(r.pModel),
          slug: str(r.pSlug),
        } as ListingWithRelations['product'],
        provider: {
          id: listing.providerId,
          name: str(r.pName),
          trustScore: num(r.pTrustScore),
          slug: str(r.prSlug),
          active: num(r.pActive) === 1,
          mode: str(r.pMode),
          isDemo: num(r.pIsDemo) === 1,
        } as ListingWithRelations['provider'],
      };
    });
  }

  async listListingsForProduct(productId: string, includeArchived = false): Promise<ListingWithRelations[]> {
    const where = includeArchived
      ? 'WHERE l.productId = ?'
      : 'WHERE l.productId = ? AND l.archivedAt IS NULL';
    return this.listingBaseRows(where, [productId]);
  }

  async listActiveListings(): Promise<ListingWithRelations[]> {
    const where = 'WHERE l.archivedAt IS NULL AND l.stockStatus = \'IN_STOCK\'';
    return this.listingBaseRows(where, []);
  }

  async getListingById(id: string): Promise<ListingWithRelations | null> {
    const row = this.db
      .prepare(
        `${this.listingRowQuery}
         FROM Listing l
         JOIN Product p ON p.id = l.productId
         JOIN Provider pr ON pr.id = l.providerId
         WHERE l.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...mapListing(row),
      product: {
        id: str(row.pId),
        brand: str(row.pBrand),
        model: str(row.pModel),
        slug: str(row.pSlug),
      } as ListingWithRelations['product'],
      provider: {
        id: str(row.providerId),
        name: str(row.pName),
        trustScore: num(row.pTrustScore),
        slug: str(row.prSlug),
        active: num(row.pActive) === 1,
        mode: str(row.pMode),
        isDemo: num(row.pIsDemo) === 1,
      } as ListingWithRelations['provider'],
    };
  }

  async upsertListing(input: UpsertListingInput): Promise<UpsertListingResult> {
    const ts = now();
    const existing = this.db
      .prepare('SELECT * FROM Listing WHERE providerId = ? AND sourceProductId = ?')
      .get(input.providerId, input.sourceProductId) as Record<string, unknown> | undefined;

    const stockChanged =
      existing == null ||
      str(existing.stockStatus) !== input.stockStatus ||
      asDate(str(existing.archivedAt)) !== null !== (input.stockStatus !== 'ARCHIVED');

    const priceChanged = existing != null && num(existing.price) !== input.price;

    if (!existing) {
      this.db
        .prepare(
          `INSERT INTO Listing (id, productId, providerId, sourceProductId, sourceUrl, affiliateUrl, price, originalPrice,
            discount, normalizedCondition, sourceCondition, conditionScore, conditionDescription, warrantyMonths, returnDays,
            batteryHealth, stockStatus, deliveryEstimate, sellerName, sellerRating, lastCheckedAt, priceUpdatedAt, consecutiveSyncFailures, archivedAt, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          input.id,
          input.productId,
          input.providerId,
          input.sourceProductId,
          input.sourceUrl,
          input.affiliateUrl ?? null,
          input.price,
          input.originalPrice ?? null,
          input.discount ?? null,
          input.normalizedCondition,
          input.sourceCondition ?? null,
          input.conditionScore,
          input.conditionDescription ?? null,
          input.warrantyMonths,
          input.returnDays,
          input.batteryHealth ?? null,
          input.stockStatus,
          input.deliveryEstimate ?? null,
          input.sellerName ?? '',
          input.sellerRating ?? null,
          asIso(input.lastCheckedAt),
          asIso(input.priceUpdatedAt),
          0,
          null,
          ts,
          ts,
        );
      this.recordPricePointLocal(input.id, input.price, input.priceUpdatedAt);
      const row = this.db.prepare('SELECT * FROM Listing WHERE id = ?').get(input.id) as Record<string, unknown>;
      return { status: 'added', listing: mapListing(row), priceChanged: true, wasOutOfStock: input.stockStatus === 'IN_STOCK' };
    }

    const samePrice = num(existing.price) === input.price;
    const sameStock = str(existing.stockStatus) === input.stockStatus;
    const sameCondition = str(existing.normalizedCondition) === input.normalizedCondition;
    const sameWarranty = num(existing.warrantyMonths) === input.warrantyMonths;
    const sameReturn = num(existing.returnDays) === input.returnDays;
    const unchanged = samePrice && sameStock && sameCondition && sameWarranty && sameReturn;

    const updatedPriceAt = samePrice ? str(existing.priceUpdatedAt) : asIso(input.priceUpdatedAt);
    this.db
      .prepare(
        `UPDATE Listing SET productId=?, sourceUrl=?, affiliateUrl=?, price=?, originalPrice=?, discount=?,
          normalizedCondition=?, sourceCondition=?, conditionScore=?, conditionDescription=?, warrantyMonths=?, returnDays=?,
          batteryHealth=?, stockStatus=?, deliveryEstimate=?, sellerName=?, sellerRating=?, lastCheckedAt=?, priceUpdatedAt=?,
          archivedAt=?, updatedAt=?, consecutiveSyncFailures=0 WHERE id=?`,
      )
      .run(
        input.productId,
        input.sourceUrl,
        input.affiliateUrl ?? null,
        input.price,
        input.originalPrice ?? null,
        input.discount ?? null,
        input.normalizedCondition,
        input.sourceCondition ?? null,
        input.conditionScore,
        input.conditionDescription ?? null,
        input.warrantyMonths,
        input.returnDays,
        input.batteryHealth ?? null,
        input.stockStatus,
        input.deliveryEstimate ?? null,
        input.sellerName ?? '',
        input.sellerRating ?? null,
        asIso(input.lastCheckedAt),
        updatedPriceAt,
        input.stockStatus === 'ARCHIVED' ? asIso(input.lastCheckedAt) : null,
        ts,
        str(existing.id),
      );

    const priceChangedFlag = !samePrice;
    if (!samePrice) {
      this.recordPricePointLocal(str(existing.id), input.price, input.priceUpdatedAt);
    }

    const wasOutOfStock = !sameStock && str(existing.stockStatus) !== 'IN_STOCK' && input.stockStatus === 'IN_STOCK';
    const row = this.db.prepare('SELECT * FROM Listing WHERE id = ?').get(str(existing.id)) as Record<string, unknown>;
    return {
      status: unchanged ? 'skipped' : 'updated',
      listing: mapListing(row),
      priceChanged: priceChangedFlag,
      wasOutOfStock,
    };
  }

  private recordPricePointLocal(listingId: string, price: number, at: Date): void {
    const id = `php_${crypto.randomUUID()}`;
    this.db
      .prepare('INSERT INTO PriceHistoryPoint (id, listingId, price, recordedAt) VALUES (?,?,?,?)')
      .run(id, listingId, price, asIso(at));
  }

  async updateListing(id: string, patch: Partial<Omit<UpsertListingInput, 'id'>>): Promise<Listing | null> {
    const existing = this.db.prepare('SELECT * FROM Listing WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return null;
    const merged: Record<string, unknown> = {
      sourceUrl: patch.sourceUrl ?? existing.sourceUrl,
      affiliateUrl: patch.affiliateUrl !== undefined ? patch.affiliateUrl ?? null : existing.affiliateUrl,
      price: patch.price ?? existing.price,
      originalPrice: patch.originalPrice !== undefined ? patch.originalPrice ?? null : existing.originalPrice,
      discount: patch.discount !== undefined ? patch.discount ?? null : existing.discount,
      normalizedCondition: patch.normalizedCondition ?? existing.normalizedCondition,
      sourceCondition: patch.sourceCondition !== undefined ? patch.sourceCondition ?? null : existing.sourceCondition,
      conditionScore: patch.conditionScore ?? existing.conditionScore,
      conditionDescription: patch.conditionDescription !== undefined ? patch.conditionDescription ?? null : existing.conditionDescription,
      warrantyMonths: patch.warrantyMonths ?? existing.warrantyMonths,
      returnDays: patch.returnDays ?? existing.returnDays,
      batteryHealth: patch.batteryHealth !== undefined ? patch.batteryHealth ?? null : existing.batteryHealth,
      stockStatus: patch.stockStatus ?? existing.stockStatus,
      deliveryEstimate: patch.deliveryEstimate !== undefined ? patch.deliveryEstimate ?? null : existing.deliveryEstimate,
      sellerName: patch.sellerName ?? existing.sellerName,
      sellerRating: patch.sellerRating !== undefined ? patch.sellerRating ?? null : existing.sellerRating,
      lastCheckedAt: patch.lastCheckedAt ? asIso(patch.lastCheckedAt) : existing.lastCheckedAt,
      priceUpdatedAt: patch.priceUpdatedAt ? asIso(patch.priceUpdatedAt) : existing.priceUpdatedAt,
    };
    this.db
      .prepare(
        `UPDATE Listing SET sourceUrl=?, affiliateUrl=?, price=?, originalPrice=?, discount=?, normalizedCondition=?,
          sourceCondition=?, conditionScore=?, conditionDescription=?, warrantyMonths=?, returnDays=?, batteryHealth=?,
          stockStatus=?, deliveryEstimate=?, sellerName=?, sellerRating=?, lastCheckedAt=?, priceUpdatedAt=?, updatedAt=? WHERE id=?`,
      )
      .run(
        merged.sourceUrl,
        merged.affiliateUrl,
        merged.price,
        merged.originalPrice,
        merged.discount,
        merged.normalizedCondition,
        merged.sourceCondition,
        merged.conditionScore,
        merged.conditionDescription,
        merged.warrantyMonths,
        merged.returnDays,
        merged.batteryHealth,
        merged.stockStatus,
        merged.deliveryEstimate,
        merged.sellerName,
        merged.sellerRating,
        merged.lastCheckedAt,
        merged.priceUpdatedAt,
        now(),
        id,
      );
    return mapListing(this.db.prepare('SELECT * FROM Listing WHERE id = ?').get(id) as Record<string, unknown>);
  }

  async archiveListing(id: string): Promise<Listing | null> {
    const existing = this.db.prepare('SELECT id FROM Listing WHERE id = ?').get(id) as { id: string } | undefined;
    if (!existing) return null;
    this.db
      .prepare(`UPDATE Listing SET archivedAt=?, stockStatus='ARCHIVED', updatedAt=? WHERE id=?`)
      .run(now(), now(), id);
    return mapListing(this.db.prepare('SELECT * FROM Listing WHERE id = ?').get(id) as Record<string, unknown>);
  }

  async archiveDemoListings(): Promise<number> {
    const info = this.db
      .prepare(
        `UPDATE Listing SET archivedAt=?, stockStatus='ARCHIVED', updatedAt=?
         WHERE archivedAt IS NULL AND sourceProductId LIKE 'demo-%'`,
      )
      .run(now(), now());
    return Number(info.changes ?? 0);
  }

  async markStaleListings(opts: { maxFailures: number; limit: number }): Promise<StaleListing[]> {
    const rows = this.db
      .prepare(
        `SELECT id, providerId, sourceProductId, consecutiveSyncFailures FROM Listing
         WHERE archivedAt IS NULL AND consecutiveSyncFailures >= ? ORDER BY consecutiveSyncFailures DESC LIMIT ?`,
      )
      .all(opts.maxFailures, opts.limit) as unknown as Record<string, unknown>[];
    return rows.map((r) => ({
      id: str(r.id),
      providerId: str(r.providerId),
      sourceProductId: str(r.sourceProductId),
      consecutiveSyncFailures: num(r.consecutiveSyncFailures),
    }));
  }

  // ---------------- price history ----------------

  async getPriceHistory(productId: string, days: number): Promise<Array<{ date: string; price: number }>> {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = this.db
      .prepare(
        `SELECT DATE(h.recordedAt) AS date, AVG(h.price) AS price
         FROM PriceHistoryPoint h
         JOIN Listing l ON l.id = h.listingId
         WHERE l.productId = ? AND h.recordedAt >= ?
         GROUP BY DATE(h.recordedAt)
         ORDER BY date ASC`,
      )
      .all(productId, since) as unknown as Record<string, unknown>[];
    return rows.map((r) => ({ date: str(r.date), price: Math.round(num(r.price)) }));
  }

  async recordPricePoint(listingId: string, price: number, at = new Date()): Promise<PriceHistoryPoint> {
    const id = `php_${crypto.randomUUID()}`;
    this.db
      .prepare('INSERT INTO PriceHistoryPoint (id, listingId, price, recordedAt) VALUES (?,?,?,?)')
      .run(id, listingId, price, at.toISOString());
    return { id, listingId, price, recordedAt: at };
  }

  async purgeOldPriceHistory(before: Date): Promise<number> {
    const res = this.db.prepare('DELETE FROM PriceHistoryPoint WHERE recordedAt < ?').run(before.toISOString());
    return Number(res.changes);
  }

  // ---------------- providers ----------------

  async listProviders(): Promise<ProviderWithAuthorization[]> {
    const providerRows = this.db
      .prepare(`SELECT * FROM Provider ORDER BY isDemo DESC, name ASC`)
      .all() as unknown as Record<string, unknown>[];
    const authRows = this.db.prepare('SELECT * FROM ProviderAuthorization').all() as unknown as Record<string, unknown>[];
    const authByProvider = new Map(authRows.map((a) => [str(a.providerId), a]));
    return providerRows.map((r) => ({
      ...mapProvider(r),
      authorization: authByProvider.get(str(r.id)) ? mapAuthorization(authByProvider.get(str(r.id)))! : null,
    }));
  }

  private async providerByColumn(col: string, value: string): Promise<ProviderWithAuthorization | null> {
    const row = this.db
      .prepare(`SELECT * FROM Provider WHERE ${col} = ?`)
      .get(value) as Record<string, unknown> | undefined;
    if (!row) return null;
    const auth = this.db
      .prepare('SELECT * FROM ProviderAuthorization WHERE providerId = ?')
      .get(str(row.id)) as Record<string, unknown> | undefined;
    return { ...mapProvider(row), authorization: mapAuthorization(auth) };
  }

  async getProviderBySlug(slug: string): Promise<ProviderWithAuthorization | null> {
    return this.providerByColumn('slug', slug);
  }

  async getProviderById(id: string): Promise<ProviderWithAuthorization | null> {
    return this.providerByColumn('id', id);
  }

  async getProviderAuthorization(providerId: string): Promise<ProviderAuthorization | null> {
    const row = this.db.prepare('SELECT * FROM ProviderAuthorization WHERE providerId = ?').get(providerId) as Record<string, unknown> | undefined;
    return mapAuthorization(row);
  }

  async upsertProviderSettings(input: UpsertProviderSettingsInput): Promise<Provider> {
    const ts = now();
    const existing = this.db.prepare('SELECT id FROM Provider WHERE id = ?').get(input.id) as { id: string } | undefined;
    if (existing) {
      this.db
        .prepare('UPDATE Provider SET name=?, website=?, logoUrl=?, updatedAt=? WHERE id=?')
        .run(input.name, input.website, input.logoUrl ?? null, ts, input.id);
    } else {
      this.db
        .prepare(
          `INSERT INTO Provider (id, name, slug, website, logoUrl, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`,
        )
        .run(input.id, input.name, input.slug, input.website, input.logoUrl ?? null, ts, ts);
    }
    const row = this.db.prepare('SELECT * FROM Provider WHERE id = ?').get(input.id) as Record<string, unknown>;
    return mapProvider(row);
  }

  async updateProviderSettings(id: string, patch: Partial<UpsertProviderSettingsInput>): Promise<Provider | null> {
    const existing = this.db.prepare('SELECT id FROM Provider WHERE id = ?').get(id) as { id: string } | undefined;
    if (!existing) return null;
    const current = this.db.prepare('SELECT * FROM Provider WHERE id = ?').get(id) as Record<string, unknown>;
    const merged = {
      name: patch.name ?? current.name,
      website: patch.website ?? current.website,
      logoUrl: patch.logoUrl !== undefined ? patch.logoUrl ?? null : current.logoUrl,
      trustScore: patch.trustScore ?? current.trustScore,
      lastSyncAt: patch.lastSyncAt !== undefined ? asIso(patch.lastSyncAt) : current.lastSyncAt,
    };
    this.db
      .prepare('UPDATE Provider SET name=?, website=?, logoUrl=?, trustScore=?, lastSyncAt=?, updatedAt=? WHERE id=?')
      .run(merged.name, merged.website, merged.logoUrl, merged.trustScore, merged.lastSyncAt, now(), id);
    return mapProvider(this.db.prepare('SELECT * FROM Provider WHERE id = ?').get(id) as Record<string, unknown>);
  }

  async setProviderEnabled(
    id: string,
    opts: { enabled: boolean; disabledReason?: string | null; mode?: Provider['mode'] },
  ): Promise<Provider> {
    const existing = this.db.prepare('SELECT status, mode FROM Provider WHERE id = ?').get(id) as { status: string; mode: string } | undefined;
    if (!existing) return mapProvider(this.db.prepare('SELECT * FROM Provider WHERE id = ?').get(id) as Record<string, unknown>);
    const status = opts.enabled ? 'CONNECTED' : existing.status === 'CONNECTED' ? 'DISABLED' : existing.status;
    // An enabled provider follows the connector's default mode (MOCK in sandbox) unless an
    // explicit mode override is supplied (e.g. an approved API/crawl authorization).
    const mode = opts.mode ?? (opts.enabled && existing.mode === 'DISABLED' ? 'MOCK' : existing.mode);
    this.db
      .prepare('UPDATE Provider SET active=?, status=?, mode=?, disabledReason=?, updatedAt=? WHERE id=?')
      .run(opts.enabled ? 1 : 0, status, mode, opts.disabledReason ?? null, now(), id);
    return mapProvider(this.db.prepare('SELECT * FROM Provider WHERE id = ?').get(id) as Record<string, unknown>);
  }

  async upsertProviderAuthorization(input: Partial<ProviderAuthorization> & { providerId: string }): Promise<ProviderAuthorization> {
    const ts = now();
    const existing = this.db.prepare('SELECT id FROM ProviderAuthorization WHERE providerId = ?').get(input.providerId) as { id: string } | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE ProviderAuthorization SET approved=?, authorizationType=?, permittedDomains=?, permittedPaths=?, permittedFields=?,
            maxRequestsPerMinute=?, termsReviewedAt=?, robotsReviewedAt=?, copyrightDataUseReviewed=?, contactRecorded=?,
            authorizationNotes=?, sourceAttributionRequired=?, expiresAt=?, updatedAt=? WHERE providerId=?`,
        )
        .run(
          input.approved ? 1 : 0,
          input.authorizationType ?? 'MANUAL_IMPORT',
          input.permittedDomains ?? '',
          input.permittedPaths ?? '',
          input.permittedFields ?? '',
          input.maxRequestsPerMinute ?? 60,
          asIso(input.termsReviewedAt),
          asIso(input.robotsReviewedAt),
          input.copyrightDataUseReviewed ? 1 : 0,
          input.contactRecorded ? 1 : 0,
          input.authorizationNotes ?? null,
          input.sourceAttributionRequired ? 1 : 0,
          asIso(input.expiresAt),
          ts,
          input.providerId,
        );
      return mapAuthorization(this.db.prepare('SELECT * FROM ProviderAuthorization WHERE providerId = ?').get(input.providerId) as Record<string, unknown>)!;
    }
    const id = `auth_${crypto.randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO ProviderAuthorization (id, providerId, approved, authorizationType, permittedDomains, permittedPaths,
          permittedFields, maxRequestsPerMinute, termsReviewedAt, robotsReviewedAt, copyrightDataUseReviewed, contactRecorded,
          authorizationNotes, sourceAttributionRequired, expiresAt, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.providerId,
        input.approved ? 1 : 0,
        input.authorizationType ?? 'MANUAL_IMPORT',
        input.permittedDomains ?? '',
        input.permittedPaths ?? '',
        input.permittedFields ?? '',
        input.maxRequestsPerMinute ?? 60,
        asIso(input.termsReviewedAt),
        asIso(input.robotsReviewedAt),
        input.copyrightDataUseReviewed ? 1 : 0,
        input.contactRecorded ? 1 : 0,
        input.authorizationNotes ?? null,
        input.sourceAttributionRequired ? 1 : 0,
        asIso(input.expiresAt),
        ts,
        ts,
      );
    return mapAuthorization(this.db.prepare('SELECT * FROM ProviderAuthorization WHERE providerId = ?').get(input.providerId) as Record<string, unknown>)!;
  }

  // ---------------- alerts ----------------

  async createPriceAlert(input: { productId: string; email: string; targetPrice: number }): Promise<PriceAlert> {
    const id = `alert_${crypto.randomUUID()}`;
    const ts = now();
    this.db
      .prepare('INSERT INTO PriceAlert (id, productId, email, targetPrice, status, createdAt) VALUES (?,?,?,?,?,?)')
      .run(id, input.productId, input.email, input.targetPrice, 'ACTIVE', ts);
    const row = this.db.prepare('SELECT * FROM PriceAlert WHERE id = ?').get(id) as Record<string, unknown>;
    return {
      id: str(row.id),
      productId: str(row.productId),
      email: str(row.email),
      targetPrice: num(row.targetPrice),
      status: str(row.status) as PriceAlert['status'],
      createdAt: new Date(str(row.createdAt)),
      triggeredAt: asDate(row.triggeredAt as string | null),
    };
  }

  async getPriceAlertByProductAndEmail(productId: string, email: string): Promise<PriceAlert | null> {
    const row = this.db.prepare('SELECT * FROM PriceAlert WHERE productId = ? AND email = ?').get(productId, email) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: str(row.id),
      productId: str(row.productId),
      email: str(row.email),
      targetPrice: num(row.targetPrice),
      status: str(row.status) as PriceAlert['status'],
      createdAt: new Date(str(row.createdAt)),
      triggeredAt: asDate(row.triggeredAt as string | null),
    };
  }

  async listActiveAlerts(): Promise<PriceAlert[]> {
    const rows = this.db.prepare('SELECT * FROM PriceAlert WHERE status = \'ACTIVE\'').all() as unknown as Record<string, unknown>[];
    return rows.map((row) => ({
      id: str(row.id),
      productId: str(row.productId),
      email: str(row.email),
      targetPrice: num(row.targetPrice),
      status: str(row.status) as PriceAlert['status'],
      createdAt: new Date(str(row.createdAt)),
      triggeredAt: asDate(row.triggeredAt as string | null),
    }));
  }

  async setAlertStatus(id: string, status: PriceAlert['status']): Promise<PriceAlert | null> {
    const existing = this.db.prepare('SELECT id FROM PriceAlert WHERE id = ?').get(id) as { id: string } | undefined;
    if (!existing) return null;
    const triggeredAt = status === 'TRIGGERED' ? now() : null;
    this.db.prepare('UPDATE PriceAlert SET status=?, triggeredAt=? WHERE id=?').run(status, triggeredAt, id);
    const row = this.db.prepare('SELECT * FROM PriceAlert WHERE id = ?').get(id) as Record<string, unknown>;
    return {
      id: str(row.id),
      productId: str(row.productId),
      email: str(row.email),
      targetPrice: num(row.targetPrice),
      status: str(row.status) as PriceAlert['status'],
      createdAt: new Date(str(row.createdAt)),
      triggeredAt: asDate(row.triggeredAt as string | null),
    };
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
    const id = `click_${crypto.randomUUID()}`;
    this.db
      .prepare('INSERT INTO ClickEvent (id, clickId, listingId, productId, providerId, referrer, deviceType, userAgentHash, createdAt) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, input.clickId, input.listingId, input.productId, input.providerId, input.referrer ?? null, input.deviceType ?? null, input.userAgentHash ?? null, now());
  }

  async listClicks(filter: ClickFilter): Promise<{ items: ClickRow[]; total: number }> {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.providerId) {
      where.push('c.providerId = ?');
      params.push(filter.providerId);
    }
    if (filter.from) {
      where.push('c.createdAt >= ?');
      params.push(filter.from.toISOString());
    }
    if (filter.to) {
      where.push('c.createdAt <= ?');
      params.push(filter.to.toISOString());
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS total FROM ClickEvent c ${whereSql}`).get(...params) as { total: number };
    const rows = this.db
      .prepare(
        `SELECT c.*, p.slug AS productSlug, pr.name AS providerName, l.price AS listingPrice
         FROM ClickEvent c
         JOIN Product p ON p.id = c.productId
         JOIN Provider pr ON pr.id = c.providerId
         LEFT JOIN Listing l ON l.id = c.listingId
         ${whereSql}
         ORDER BY c.createdAt DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, filter.pageSize, (filter.page - 1) * filter.pageSize) as unknown as Record<string, unknown>[];
    return {
      items: rows.map((r) => ({
        id: str(r.id),
        clickId: str(r.clickId),
        listingId: str(r.listingId),
        productId: str(r.productId),
        providerId: str(r.providerId),
        referrer: r.referrer == null ? null : str(r.referrer),
        deviceType: r.deviceType == null ? null : str(r.deviceType),
        userAgentHash: r.userAgentHash == null ? null : str(r.userAgentHash),
        createdAt: new Date(str(r.createdAt)),
        productSlug: str(r.productSlug),
        providerName: str(r.providerName),
        listingPrice: r.listingPrice == null ? null : num(r.listingPrice),
      })),
      total: num(totalRow.total),
    };
  }

  async countClicksByProvider(opts: { from: Date; to: Date }): Promise<Array<{ providerId: string; count: number }>> {
    const rows = this.db
      .prepare('SELECT providerId, COUNT(*) AS count FROM ClickEvent WHERE createdAt >= ? AND createdAt <= ? GROUP BY providerId ORDER BY count DESC')
      .all(opts.from.toISOString(), opts.to.toISOString()) as unknown as Record<string, unknown>[];
    return rows.map((r) => ({ providerId: str(r.providerId), count: num(r.count) }));
  }

  // ---------------- sync jobs ----------------

  async createSyncJob(input: { providerId: string; mode: ProviderMode; source: string }): Promise<SyncJob> {
    const id = `sync_${crypto.randomUUID()}`;
    const ts = now();
    this.db
      .prepare('INSERT INTO SyncJob (id, providerId, status, mode, source, createdAt) VALUES (?,?,?,?,?,?)')
      .run(id, input.providerId, 'PENDING', input.mode, input.source, ts);
    return this.getSyncJob(id) as Promise<SyncJob>;
  }

  async updateSyncJob(id: string, patch: Partial<Pick<SyncJob, 'status' | 'finishedAt' | 'itemsSeen' | 'itemsAdded' | 'itemsUpdated' | 'itemsSkipped' | 'itemsFailed' | 'errorMessage'>>): Promise<SyncJob | null> {
    const existing = this.db.prepare('SELECT * FROM SyncJob WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return null;
    const merged = {
      status: patch.status && typeof patch.status === 'string' ? patch.status : existing.status,
      startedAt: patch.status === 'RUNNING' ? now() : existing.startedAt,
      finishedAt: patch.finishedAt ? asIso(patch.finishedAt) : patch.status === 'SUCCESS' || patch.status === 'FAILED' || patch.status === 'PARTIAL' || patch.status === 'CANCELLED' ? now() : existing.finishedAt,
      itemsSeen: patch.itemsSeen ?? existing.itemsSeen,
      itemsAdded: patch.itemsAdded ?? existing.itemsAdded,
      itemsUpdated: patch.itemsUpdated ?? existing.itemsUpdated,
      itemsSkipped: patch.itemsSkipped ?? existing.itemsSkipped,
      itemsFailed: patch.itemsFailed ?? existing.itemsFailed,
      errorMessage: patch.errorMessage !== undefined ? patch.errorMessage : existing.errorMessage,
    };
    this.db
      .prepare('UPDATE SyncJob SET status=?, startedAt=?, finishedAt=?, itemsSeen=?, itemsAdded=?, itemsUpdated=?, itemsSkipped=?, itemsFailed=?, errorMessage=? WHERE id=?')
      .run(
        merged.status as string,
        merged.startedAt,
        merged.finishedAt,
        merged.itemsSeen,
        merged.itemsAdded,
        merged.itemsUpdated,
        merged.itemsSkipped,
        merged.itemsFailed,
        merged.errorMessage,
        id,
      );
    return this.getSyncJob(id);
  }

  async getSyncJob(id: string): Promise<SyncJob | null> {
    const row = this.db.prepare('SELECT * FROM SyncJob WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: str(row.id),
      providerId: str(row.providerId),
      status: str(row.status) as SyncStatus,
      mode: str(row.mode) as ProviderMode,
      source: str(row.source),
      startedAt: asDate(row.startedAt as string | null),
      finishedAt: asDate(row.finishedAt as string | null),
      itemsSeen: num(row.itemsSeen),
      itemsAdded: num(row.itemsAdded),
      itemsUpdated: num(row.itemsUpdated),
      itemsSkipped: num(row.itemsSkipped),
      itemsFailed: num(row.itemsFailed),
      errorMessage: row.errorMessage == null ? null : str(row.errorMessage),
      createdAt: new Date(str(row.createdAt)),
    };
  }

  async listRecentSyncJobs(limit: number): Promise<SyncJob[]> {
    const rows = this.db.prepare('SELECT * FROM SyncJob ORDER BY createdAt DESC LIMIT ?').all(limit) as unknown as Record<string, unknown>[];
    return rows.map((r) => ({
      id: str(r.id),
      providerId: str(r.providerId),
      status: str(r.status) as SyncStatus,
      mode: str(r.mode) as ProviderMode,
      source: str(r.source),
      startedAt: asDate(r.startedAt as string | null),
      finishedAt: asDate(r.finishedAt as string | null),
      itemsSeen: num(r.itemsSeen),
      itemsAdded: num(r.itemsAdded),
      itemsUpdated: num(r.itemsUpdated),
      itemsSkipped: num(r.itemsSkipped),
      itemsFailed: num(r.itemsFailed),
      errorMessage: r.errorMessage == null ? null : str(r.errorMessage),
      createdAt: new Date(str(r.createdAt)),
    }));
  }

  async logSyncError(input: { jobId: string | null; providerId: string; errorCode: string; message: string; context?: string | null }): Promise<SyncError> {
    const id = `sye_${crypto.randomUUID()}`;
    this.db
      .prepare('INSERT INTO SyncError (id, jobId, providerId, errorCode, message, context, createdAt) VALUES (?,?,?,?,?,?,?)')
      .run(id, input.jobId, input.providerId, input.errorCode, input.message, input.context ?? null, now());
    return {
      id,
      jobId: input.jobId,
      providerId: input.providerId,
      errorCode: input.errorCode,
      message: input.message,
      context: input.context ?? null,
      createdAt: new Date(),
    };
  }

  async listSyncErrors(opts: { providerId?: string; limit: number }): Promise<SyncError[]> {
    const where = opts.providerId ? 'WHERE providerId = ?' : '';
    const params = opts.providerId ? [opts.providerId, opts.limit] : [opts.limit];
    const rows = this.db.prepare(`SELECT * FROM SyncError ${where} ORDER BY createdAt DESC LIMIT ?`).all(...params) as unknown as Record<string, unknown>[];
    return rows.map((r) => ({
      id: str(r.id),
      jobId: r.jobId == null ? null : str(r.jobId),
      providerId: str(r.providerId),
      errorCode: str(r.errorCode),
      message: str(r.message),
      context: r.context == null ? null : str(r.context),
      createdAt: new Date(str(r.createdAt)),
    }));
  }

  // ---------------- search capture ----------------

  async recordSearchQuery(query: string, resultCount: number): Promise<SearchQueryRecord> {
    const id = `sq_${crypto.randomUUID()}`;
    this.db.prepare('INSERT INTO SearchQuery (id, query, resultCount, createdAt) VALUES (?,?,?,?)').run(id, query, resultCount, now());
    return { id, query, resultCount, createdAt: new Date() };
  }

  // ---------------- admin/ops ----------------

  async createAdminUser(input: { email: string; passwordHash: string; role: AdminUser['role'] }): Promise<AdminUser> {
    const id = `admin_${crypto.randomUUID()}`;
    const ts = now();
    this.db.prepare('INSERT INTO AdminUser (id, email, passwordHash, role, createdAt, updatedAt) VALUES (?,?,?,?,?,?)').run(id, input.email, input.passwordHash, input.role, ts, ts);
    return { id, email: input.email, passwordHash: input.passwordHash, role: input.role, createdAt: new Date(ts), updatedAt: new Date(ts) };
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | null> {
    const row = this.db.prepare('SELECT * FROM AdminUser WHERE email = ?').get(email) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: str(row.id),
      email: str(row.email),
      passwordHash: str(row.passwordHash),
      role: str(row.role) as AdminUser['role'],
      createdAt: new Date(str(row.createdAt)),
      updatedAt: new Date(str(row.updatedAt)),
    };
  }

  async logAudit(input: { adminUserId: string | null; action: string; entityType: string; entityId: string; details?: string | null }): Promise<AuditLogEntry> {
    const id = `audit_${crypto.randomUUID()}`;
    this.db.prepare('INSERT INTO AuditLog (id, adminUserId, action, entityType, entityId, details, createdAt) VALUES (?,?,?,?,?,?,?)').run(id, input.adminUserId ?? null, input.action, input.entityType, input.entityId, input.details ?? null, now());
    return { id, adminUserId: input.adminUserId, action: input.action, entityType: input.entityType, entityId: input.entityId, details: input.details ?? null, createdAt: new Date() };
  }
}