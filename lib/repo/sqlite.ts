import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  PRODUCTS,
  SELLERS,
  buildDemoListings,
  buildDemoPriceHistory,
  type AuthoringProduct,
  type AuthoringSeller,
} from "@/services/ingestion/mock/data";
import { PROVIDER_REGISTRY } from "@/services/ingestion/providers/registry";
import type {
  ListingDto,
  PriceAlertDto,
  PricePointDto,
  ProductDto,
  ProductFilter,
  ProviderSettingDto,
  Repository,
  SyncResult,
} from "./types";

const DB_PATH = resolveDatabaseUrl();

function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./prisma/dev/dev.db";
  const match = raw.match(/^file:(.+)$/);
  if (!match) return path.join(process.cwd(), "prisma/dev/dev.db");
  const p = match[1];
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

function openDatabase(): DatabaseSync {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  const ddl = readFileSync(
    path.join(process.cwd(), "prisma/dev/init.sql"),
    "utf-8",
  );
  db.exec(ddl);
  return db;
}

declare global {
  var __refurbcompareSqlite: DatabaseSync | undefined;
}

const db = (globalThis.__refurbcompareSqlite ??= openDatabase());

// ---------------------------------------------------------------------------
// Row -> DTO mappers
// ---------------------------------------------------------------------------

function toBool(value: unknown): boolean {
  return Number(value) === 1;
}

function toProduct(row: Record<string, unknown>): ProductDto {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    brand: String(row.brand),
    model: String(row.model),
    category: String(row.category),
    storage: Number(row.storage),
    ram: row.ram === null ? null : Number(row.ram),
    color: row.color === null ? null : String(row.color),
    condition: String(row.condition),
    releaseYear: row.releaseYear === null ? null : Number(row.releaseYear),
    imageUrl: row.imageUrl === null ? null : String(row.imageUrl),
    attributes:
      row.attributes === null || row.attributes === undefined
        ? null
        : JSON.parse(String(row.attributes)),
  };
}

function toProductWithPrice(row: Record<string, unknown>): ProductDto {
  const product = toProduct(row);
  if (row.bestPrice !== null && row.bestPrice !== undefined) {
    (product as ProductDto & { bestPrice?: number }).bestPrice = Number(
      row.bestPrice,
    );
  }
  return product;
}

function toListing(row: Record<string, unknown>): ListingDto {
  const listing: ListingDto = {
    id: String(row.id),
    productId: String(row.productId),
    sellerId: String(row.sellerId),
    targetUrl: String(row.targetUrl),
    price: Number(row.price),
    originalPrice: row.originalPrice === null ? null : Number(row.originalPrice),
    discountPct: row.discountPct === null ? null : Number(row.discountPct),
    condition: row.condition === null ? null : String(row.condition),
    storage: row.storage === null ? null : Number(row.storage),
    inStock: toBool(row.inStock),
    stockStatus: String(row.stockStatus) as ListingDto["stockStatus"],
    sellerRating: row.sellerRating === null ? null : Number(row.sellerRating),
    offerBadge: row.offerBadge === null ? null : String(row.offerBadge),
    isDemo: toBool(row.isDemo),
    fetchedAt: String(row.fetchedAt),
  };

  if (row.sellerName) {
    listing.seller = {
      id: String(row.sellerId),
      slug: String(row.sellerSlug ?? ""),
      name: String(row.sellerName),
      websiteUrl: String(row.sellerWebsiteUrl ?? ""),
      logoUrl:
        row.sellerLogoUrl === null || row.sellerLogoUrl === undefined
          ? null
          : String(row.sellerLogoUrl),
      tagline:
        row.sellerTagline === null || row.sellerTagline === undefined
          ? null
          : String(row.sellerTagline),
      rating:
        row.sellerRating === null || row.sellerRating === undefined
          ? null
          : Number(row.sellerRating),
      reviewCount: Number(row.sellerReviewCount ?? 0),
      supportsAffiliate: toBool(row.sellerSupportsAffiliate ?? 0),
      allowRedirects: toBool(row.sellerAllowRedirects ?? 1),
    };
  }

  if (row.productName) {
    listing.product = {
      id: String(row.productId),
      slug: String(row.productSlug ?? ""),
      name: String(row.productName),
      brand: String(row.productBrand ?? ""),
      model: String(row.productModel ?? ""),
      category: String(row.productCategory ?? "smartphone"),
      storage: Number(row.productStorage ?? 0),
      ram: null,
      color: null,
      condition: String(row.productCondition ?? ""),
      releaseYear: null,
      imageUrl: String(row.productImageUrl ?? ""),
      attributes: null,
    };
  }

  return listing;
}

function toPricePoint(row: Record<string, unknown>): PricePointDto {
  return {
    id: String(row.id),
    productId: String(row.productId),
    sellerId: String(row.sellerId),
    price: Number(row.price),
    recordedAt: String(row.recordedAt),
    sellerName:
      row.sellerName === null || row.sellerName === undefined
        ? undefined
        : String(row.sellerName),
  };
}

function toAlert(row: Record<string, unknown>): PriceAlertDto {
  return {
    id: String(row.id),
    productId: String(row.productId),
    email: String(row.email),
    targetPrice: Number(row.targetPrice),
    status: String(row.status),
    createdAt: String(row.createdAt),
  };
}

function toSetting(row: Record<string, unknown>): ProviderSettingDto {
  return {
    id: String(row.id),
    provider: String(row.provider),
    label: String(row.label),
    sourceType: String(row.sourceType),
    enabled: toBool(row.enabled),
    lastSyncAt: row.lastSyncAt === null ? null : String(row.lastSyncAt),
    nextSyncAt: row.nextSyncAt === null ? null : String(row.nextSyncAt),
    rowsProcessed: Number(row.rowsProcessed),
    disabledReason:
      row.disabledReason === null ? null : String(row.disabledReason),
  };
}

function now(): string {
  return new Date().toISOString();
}

function stableId(prefix: string, slug: string): string {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}_${slug.replace(/[^a-z0-9-]/gi, "").slice(0, 24)}`;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

function buildListQuery(filter: ProductFilter, countOnly: boolean) {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.query) {
    clauses.push("(p.name LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)");
    const like = `%${filter.query}%`;
    params.push(like, like, like);
  }
  if (filter.brand) {
    clauses.push("p.brand = ?");
    params.push(filter.brand);
  }

  const priceExpr =
    "(SELECT MIN(l.price) FROM Listing l WHERE l.productId = p.id AND l.inStock = 1)";
  if (filter.minPrice !== undefined && filter.maxPrice !== undefined) {
    clauses.push(`COALESCE(${priceExpr}, 999999999) BETWEEN ? AND ?`);
    params.push(filter.minPrice, filter.maxPrice);
  } else if (filter.minPrice !== undefined) {
    clauses.push(`COALESCE(${priceExpr}, 999999999) >= ?`);
    params.push(filter.minPrice);
  } else if (filter.maxPrice !== undefined) {
    clauses.push(`COALESCE(${priceExpr}, 999999999) <= ?`);
    params.push(filter.maxPrice);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  if (countOnly) {
    return {
      sql: `SELECT COUNT(*) AS count FROM Product p ${whereClause}`,
      params,
    };
  }

  const orderBy =
    filter.sort === "price_desc"
      ? "bestPrice DESC"
      : filter.sort === "price_asc"
        ? "bestPrice ASC"
        : filter.sort === "rating_desc"
          ? "bestRating DESC, bestPrice ASC"
          : filter.sort === "discount_desc"
            ? "bestDiscount DESC, bestPrice ASC"
            : "createdAt DESC, bestPrice ASC";

  const limit = Math.min(filter.limit ?? 24, 60);
  params.push(limit);

  return {
    sql: `
      SELECT
        p.*,
        (SELECT MIN(l.price) FROM Listing l WHERE l.productId = p.id AND l.inStock = 1) AS bestPrice,
        (SELECT MAX(l.discountPct) FROM Listing l WHERE l.productId = p.id AND l.inStock = 1) AS bestDiscount,
        (SELECT MAX(l.sellerRating) FROM Listing l WHERE l.productId = p.id AND l.inStock = 1) AS bestRating
      FROM Product p
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ?
    `,
    params,
  };
}

const LISTING_SELECT = `
  SELECT l.*,
    s.slug AS sellerSlug, s.name AS sellerName, s.websiteUrl AS sellerWebsiteUrl,
    s.logoUrl AS sellerLogoUrl, s.tagline AS sellerTagline, s.rating AS sellerRating,
    s.reviewCount AS sellerReviewCount, s.supportsAffiliate AS sellerSupportsAffiliate,
    s.allowRedirects AS sellerAllowRedirects,
    p.slug AS productSlug, p.name AS productName, p.brand AS productBrand,
    p.model AS productModel, p.category AS productCategory, p.storage AS productStorage,
    p.condition AS productCondition, p.imageUrl AS productImageUrl
  FROM Listing l
  JOIN Seller s ON s.id = l.sellerId
  JOIN Product p ON p.id = l.productId
`;

export const sqliteRepository: Repository = {
  async listProducts(filter: ProductFilter = {}) {
    const { sql, params } = buildListQuery(filter, false);
    return db.prepare(sql).all(...params).map(toProductWithPrice);
  },

  async countProducts(filter: ProductFilter = {}) {
    const { sql, params } = buildListQuery(filter, true);
    const row = db.prepare(sql).get(...params) as { count: number };
    return Number(row.count);
  },

  async getProductBySlug(slug) {
    const row = db
      .prepare("SELECT * FROM Product WHERE slug = ?")
      .get(slug) as Record<string, unknown> | undefined;
    return row ? toProduct(row) : null;
  },

  async listListingsForProduct(productId) {
    return db
      .prepare(`${LISTING_SELECT} WHERE l.productId = ? ORDER BY l.price ASC`)
      .all(productId)
      .map(toListing);
  },

  async listDeals(limit = 8) {
    return db
      .prepare(
        `${LISTING_SELECT}
         WHERE l.inStock = 1 AND l.discountPct > 0
         ORDER BY l.discountPct DESC, l.price ASC
         LIMIT ?`,
      )
      .all(limit)
      .map(toListing);
  },

  async getListingById(id) {
    const row = db
      .prepare(`${LISTING_SELECT} WHERE l.id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? toListing(row) : null;
  },

  async bestListingForProduct(productId) {
    const row = db
      .prepare(
        `${LISTING_SELECT}
         WHERE l.productId = ? AND l.inStock = 1
         ORDER BY l.price ASC
         LIMIT 1`,
      )
      .get(productId) as Record<string, unknown> | undefined;
    return row ? toListing(row) : null;
  },

  async brandCounts() {
    return db
      .prepare("SELECT brand, COUNT(*) AS count FROM Product GROUP BY brand ORDER BY brand")
      .all() as Array<{ brand: string; count: number }>;
  },

  async getPriceHistory(productId, days = 45) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return db
      .prepare(
        `SELECT h.id, h.productId, h.sellerId, h.price, h.recordedAt, s.name AS sellerName
         FROM PriceHistoryPoint h
         JOIN Seller s ON s.id = h.sellerId
         WHERE h.productId = ? AND h.recordedAt >= ?
         ORDER BY h.recordedAt ASC`,
      )
      .all(productId, cutoff.toISOString())
      .map(toPricePoint);
  },

  async createPriceAlert(data) {
    const id = randomUUID();
    const createdAt = now();
    db.prepare(
      `INSERT INTO PriceAlert (id, productId, email, targetPrice, status, createdAt)
       VALUES (?, ?, ?, ?, 'active', ?)`,
    ).run(id, data.productId, data.email, data.targetPrice, createdAt);
    const row = db
      .prepare("SELECT * FROM PriceAlert WHERE id = ?")
      .get(id) as Record<string, unknown>;
    return toAlert(row);
  },

  async listPriceAlerts(email) {
    const rows = email
      ? db
          .prepare("SELECT * FROM PriceAlert WHERE email = ? ORDER BY createdAt DESC")
          .all(email)
      : db.prepare("SELECT * FROM PriceAlert ORDER BY createdAt DESC").all();
    return rows.map(toAlert);
  },

  async recordClick(data) {
    db.prepare(
      "INSERT INTO Click (id, listingId, userAgent, referer, createdAt) VALUES (?, ?, ?, ?, ?)",
    ).run(randomUUID(), data.listingId, data.userAgent, data.referer, now());
  },

  async getProviderSettings() {
    return db
      .prepare("SELECT * FROM ProviderSetting ORDER BY provider")
      .all()
      .map(toSetting);
  },

  async setProviderEnabled(provider, enabled) {
    db.prepare(
      "UPDATE ProviderSetting SET enabled = ?, updatedAt = ? WHERE provider = ?",
    ).run(enabled ? 1 : 0, now(), provider);
  },

  async logSync(result: SyncResult) {
    db.exec("BEGIN");
    try {
      const startedAt =
        result.status === "failed"
          ? result.errorMessage ?? "Error"
          : new Date(Date.now() - 1000).toISOString();
      db.prepare(
        `INSERT INTO SyncLog (id, provider, status, startedAt, finishedAt, errorMessage, rowsAdded, rowsUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        result.provider,
        result.status,
        startedAt,
        now(),
        result.errorMessage ?? null,
        result.rowsAdded,
        result.rowsUpdated,
      );

      const setting = db
        .prepare("SELECT * FROM ProviderSetting WHERE provider = ?")
        .get(result.provider) as Record<string, unknown> | undefined;
      if (setting) {
        db.prepare(
          "UPDATE ProviderSetting SET lastSyncAt = ?, rowsProcessed = ?, updatedAt = ? WHERE provider = ?",
        ).run(
          now(),
          result.rowsAdded + result.rowsUpdated,
          now(),
          result.provider,
        );
      }
    } finally {
      db.exec("COMMIT");
    }
  },

  async importListings(listings) {
    let added = 0;
    let updated = 0;
    for (const listing of listings) {
      const outcome = upsertListing(db, listing);
      if (outcome === "added") added++;
      else if (outcome === "updated") updated++;
    }
    return { added, updated };
  },

  async isSeeded() {
    const row = db.prepare("SELECT COUNT(*) AS count FROM Product").get() as {
      count: number;
    };
    return Number(row.count) > 0;
  },

  async seedDemo() {
    db.exec("BEGIN");
    try {
      for (const product of PRODUCTS) {
        upsertProduct(db, product);
      }
      for (const seller of SELLERS) {
        upsertSeller(db, seller);
      }
      upsertProviderSettings(db);

      for (const listing of buildDemoListings()) {
        upsertListing(db, listing);
      }

      const existing = db
        .prepare("SELECT COUNT(*) AS count FROM PriceHistoryPoint")
        .get() as { count: number };
      if (Number(existing.count) === 0) {
        const productBySlug = new Map(PRODUCTS.map((p) => [p.slug, stableId("prod", p.slug)]));
        const sellerBySlug = new Map(SELLERS.map((s) => [s.slug, stableId("seller", s.slug)]));
        const insert = db.prepare(
          `INSERT INTO PriceHistoryPoint (id, productId, sellerId, listingId, price, recordedAt, source)
           VALUES (?, ?, ?, NULL, ?, ?, 'seed')`,
        );
        for (const point of buildDemoPriceHistory(45)) {
          const productId = productBySlug.get(point.productSlug);
          const sellerId = sellerBySlug.get(point.sellerSlug);
          if (!productId || !sellerId) continue;
          insert.run(randomUUID(), productId, sellerId, point.price, point.date);
        }
      }
    } finally {
      db.exec("COMMIT");
    }
  },
};

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function upsertProduct(db: DatabaseSync, product: AuthoringProduct) {
  const id = stableId("prod", product.slug);
  const createdAt = now();
  db.prepare(
    `INSERT INTO Product (id, slug, name, brand, model, category, storage, ram, color, condition, releaseYear, imageUrl, attributes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, brand = excluded.brand, model = excluded.model,
       storage = excluded.storage, ram = excluded.ram, color = excluded.color,
       condition = excluded.condition, releaseYear = excluded.releaseYear,
       imageUrl = excluded.imageUrl, attributes = excluded.attributes,
       updatedAt = excluded.updatedAt`,
  ).run(
    id,
    product.slug,
    product.name,
    product.brand,
    product.model,
    product.category,
    product.storage,
    product.ram,
    product.color,
    product.condition,
    product.releaseYear,
    product.imageUrl,
    JSON.stringify(product.attributes),
    createdAt,
    createdAt,
  );
}

function upsertSeller(db: DatabaseSync, seller: AuthoringSeller) {
  const id = stableId("seller", seller.slug);
  const createdAt = now();
  db.prepare(
    `INSERT INTO Seller (id, slug, name, websiteUrl, logoUrl, tagline, rating, reviewCount, supportsAffiliate, allowRedirects, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, websiteUrl = excluded.websiteUrl, logoUrl = excluded.logoUrl,
       tagline = excluded.tagline, rating = excluded.rating, reviewCount = excluded.reviewCount,
       supportsAffiliate = excluded.supportsAffiliate, allowRedirects = excluded.allowRedirects,
       updatedAt = excluded.updatedAt`,
  ).run(
    id,
    seller.slug,
    seller.name,
    seller.websiteUrl,
    seller.logoUrl,
    seller.tagline,
    seller.rating,
    seller.reviewCount,
    seller.supportsAffiliate ? 1 : 0,
    seller.allowRedirects ? 1 : 0,
    createdAt,
    createdAt,
  );
}

function upsertProviderSettings(db: DatabaseSync) {
  const createdAt = now();
  const upsert = db.prepare(
    `INSERT INTO ProviderSetting (id, provider, label, sourceType, enabled, config, lastSyncAt, nextSyncAt, rowsProcessed, disabledReason, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       label = excluded.label, sourceType = excluded.sourceType, updatedAt = excluded.updatedAt`,
  );

  for (const provider of PROVIDER_REGISTRY) {
    upsert.run(
      stableId("provider", provider.slug),
      provider.slug,
      provider.label,
      provider.sourceType,
      provider.defaultEnabled ? 1 : 0,
      JSON.stringify(provider.defaultConfig ?? {}),
      provider.defaultEnabled ? null : provider.disabledReason,
      createdAt,
      createdAt,
    );
  }
}

function upsertListing(
  db: DatabaseSync,
  listing: import("./types").FeedListing,
): "added" | "updated" | "skipped" {
  const product = db
    .prepare("SELECT id FROM Product WHERE slug = ?")
    .get(listing.productSlug) as { id: string } | undefined;
  const seller = db
    .prepare("SELECT id, rating FROM Seller WHERE slug = ?")
    .get(listing.sellerSlug) as { id: string; rating: number | null } | undefined;
  if (!product || !seller) return "skipped";

  const existing = db
    .prepare("SELECT id FROM Listing WHERE productId = ? AND sellerId = ?")
    .get(product.id, seller.id) as { id: string } | undefined;
  const outcome: "added" | "updated" = existing ? "updated" : "added";

  const id = existing?.id ?? stableId("listing", `${listing.productSlug}-${listing.sellerSlug}`);
  const createdAt = now();
  db.prepare(
    `INSERT INTO Listing (id, productId, sellerId, targetUrl, price, originalPrice, discountPct, condition, storage, inStock, stockStatus, sellerRating, offerBadge, isDemo, fetchedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(productId, sellerId) DO UPDATE SET
       targetUrl = excluded.targetUrl, price = excluded.price,
       originalPrice = excluded.originalPrice, discountPct = excluded.discountPct,
       condition = excluded.condition, storage = excluded.storage,
       inStock = excluded.inStock, stockStatus = excluded.stockStatus,
       offerBadge = excluded.offerBadge, isDemo = excluded.isDemo,
       fetchedAt = excluded.fetchedAt, updatedAt = excluded.updatedAt`,
  ).run(
    id,
    product.id,
    seller.id,
    listing.targetUrl,
    listing.price,
    listing.originalPrice,
    listing.discountPct,
    listing.condition,
    listing.storage,
    listing.inStock ? 1 : 0,
    listing.stockStatus,
    seller.rating,
    listing.offerBadge,
    createdAt,
    createdAt,
    createdAt,
  );
  return outcome;
}