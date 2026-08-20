// Deterministic demo fixture data.
//
// POLICIES:
// - This module is the single source of truth for the *canonical product
//   catalogue* and the *mock provider feed*.
// - It is consumed by prisma/seed.ts (Prisma/Postgres) AND the node:sqlite
//   bootstrap (dev sandbox), so the two never drift.
// - Prices are sample data: RefurbMeter never claims live prices or
//   scraping. See PROVIDER_INTEGRATION.md.

export type AuthoringProduct = {
  slug: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  storage: number;
  ram: number;
  color: string;
  condition: string;
  releaseYear: number;
  basePrice: number; // modal refurbished resale price, INR
  imageUrl: string;
  attributes: Record<string, string | number | boolean>;
};

export const PRODUCTS: AuthoringProduct[] = [
  {
    slug: "apple-iphone-13-128gb",
    name: "Apple iPhone 13 (128 GB)",
    brand: "Apple",
    model: "iPhone 13",
    category: "smartphone",
    storage: 128,
    ram: 4,
    color: "Midnight",
    condition: "Excellent",
    releaseYear: 2021,
    basePrice: 45999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/iphone-13.png",
    attributes: {
      display: "6.1\" Super Retina XDR OLED",
      chip: "A15 Bionic",
      camera: "Dual 12MP",
      batteryCapacity: "3240 mAh",
      os: "iOS",
      network5g: true,
    },
  },
  {
    slug: "apple-iphone-13-256gb",
    name: "Apple iPhone 13 (256 GB)",
    brand: "Apple",
    model: "iPhone 13",
    category: "smartphone",
    storage: 256,
    ram: 4,
    color: "Starlight",
    condition: "Very Good",
    releaseYear: 2021,
    basePrice: 50999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/iphone-13-256.png",
    attributes: {
      display: "6.1\" Super Retina XDR OLED",
      chip: "A15 Bionic",
      camera: "Dual 12MP",
      batteryCapacity: "3240 mAh",
      os: "iOS",
      network5g: true,
    },
  },
  {
    slug: "apple-iphone-14-128gb",
    name: "Apple iPhone 14 (128 GB)",
    brand: "Apple",
    model: "iPhone 14",
    category: "smartphone",
    storage: 128,
    ram: 6,
    color: "Blue",
    condition: "Excellent",
    releaseYear: 2022,
    basePrice: 54999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/iphone-14.png",
    attributes: {
      display: "6.1\" Super Retina XDR",
      chip: "A15 Bionic",
      camera: "Dual 12MP",
      batteryCapacity: "3279 mAh",
      os: "iOS",
      network5g: true,
    },
  },
  {
    slug: "apple-iphone-14-pro-128gb",
    name: "Apple iPhone 14 Pro (128 GB)",
    brand: "Apple",
    model: "iPhone 14 Pro",
    category: "smartphone",
    storage: 128,
    ram: 6,
    color: "Deep Purple",
    condition: "Excellent",
    releaseYear: 2022,
    basePrice: 72999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/iphone-14-pro.png",
    attributes: {
      display: "6.1\" Super Retina XDR ProMotion",
      chip: "A16 Bionic",
      camera: "Pro 48MP",
      batteryCapacity: "3200 mAh",
      os: "iOS",
      network5g: true,
    },
  },
  {
    slug: "samsung-galaxy-s22-128gb",
    name: "Samsung Galaxy S22 (128 GB)",
    brand: "Samsung",
    model: "Galaxy S22",
    category: "smartphone",
    storage: 128,
    ram: 8,
    color: "Phantom Black",
    condition: "Excellent",
    releaseYear: 2022,
    basePrice: 34999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/galaxy-s22.png",
    attributes: {
      display: "6.1\" Dynamic AMOLED 2X",
      chip: "Exynos 2200",
      camera: "Triple 50MP",
      batteryCapacity: "3700 mAh",
      os: "Android 12",
      network5g: true,
    },
  },
  {
    slug: "samsung-galaxy-s24-128gb",
    name: "Samsung Galaxy S24 (128 GB)",
    brand: "Samsung",
    model: "Galaxy S24",
    category: "smartphone",
    storage: 128,
    ram: 8,
    color: "Onyx Black",
    condition: "Like New",
    releaseYear: 2024,
    basePrice: 57999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/galaxy-s24.png",
    attributes: {
      display: "6.2\" Dynamic AMOLED 2X",
      chip: "Snapdragon 8 Gen 3",
      camera: "Triple 50MP",
      batteryCapacity: "4000 mAh",
      os: "Android 14",
      network5g: true,
    },
  },
  {
    slug: "oneplus-11r-128gb",
    name: "OnePlus 11R (128 GB)",
    brand: "OnePlus",
    model: "11R",
    category: "smartphone",
    storage: 128,
    ram: 8,
    color: "Galactic Silver",
    condition: "Excellent",
    releaseYear: 2023,
    basePrice: 27999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/oneplus-11r.png",
    attributes: {
      display: "6.7\" Fluid AMOLED",
      chip: "Snapdragon 8+ Gen 1",
      camera: "Triple 50MP",
      batteryCapacity: "5000 mAh",
      os: "Android 13",
      network5g: true,
    },
  },
  {
    slug: "xiaomi-redmi-note-12-pro-128gb",
    name: "Redmi Note 12 Pro+ (128 GB)",
    brand: "Xiaomi",
    model: "Redmi Note 12 Pro+",
    category: "smartphone",
    storage: 128,
    ram: 8,
    color: "Arctic White",
    condition: "Very Good",
    releaseYear: 2023,
    basePrice: 16999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/redmi-note-12-pro.png",
    attributes: {
      display: "6.67\" AMOLED",
      chip: "Dimensity 1080",
      camera: "Triple 200MP",
      batteryCapacity: "5000 mAh",
      os: "Android 12",
      network5g: true,
    },
  },
  {
    slug: "google-pixel-7-128gb",
    name: "Google Pixel 7 (128 GB)",
    brand: "Google",
    model: "Pixel 7",
    category: "smartphone",
    storage: 128,
    ram: 8,
    color: "Obsidian",
    condition: "Excellent",
    releaseYear: 2022,
    basePrice: 31999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/pixel-7.png",
    attributes: {
      display: "6.3\" OLED",
      chip: "Google Tensor G2",
      camera: "Dual 50MP",
      batteryCapacity: "4355 mAh",
      os: "Android 13",
      network5g: true,
    },
  },
  {
    slug: "vivo-v27-128gb",
    name: "Vivo V27 (128 GB)",
    brand: "Vivo",
    model: "V27",
    category: "smartphone",
    storage: 128,
    ram: 8,
    color: "Emerald Green",
    condition: "Excellent",
    releaseYear: 2023,
    basePrice: 22999,
    imageUrl: "https://cdn.demo.refurbcompare.in/products/vivo-v27.png",
    attributes: {
      display: "6.78\" AMOLED",
      chip: "Dimensity 7200",
      camera: "Triple 50MP",
      batteryCapacity: "4600 mAh",
      os: "Android 13",
      network5g: true,
    },
  },
];

export type AuthoringSeller = {
  slug: string;
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
  tagline: string | null;
  rating: number;
  reviewCount: number;
  supportsAffiliate: boolean;
  allowRedirects: boolean;
};

export const SELLERS: AuthoringSeller[] = [
  {
    slug: "budli",
    name: "Budli",
    websiteUrl: "https://budli.in",
    logoUrl: "https://cdn.demo.refurbcompare.in/sellers/budli.png",
    tagline: "Refurbished smartphones marketplace",
    rating: 4.6,
    reviewCount: 12400,
    supportsAffiliate: false,
    allowRedirects: true,
  },
  {
    slug: "cashify",
    name: "Cashify",
    websiteUrl: "https://www.cashify.in",
    logoUrl: "https://cdn.demo.refurbcompare.in/sellers/cashify.png",
    tagline: "Buy certified pre-owned phones",
    rating: 4.4,
    reviewCount: 98000,
    supportsAffiliate: true,
    allowRedirects: true,
  },
  {
    slug: "refit",
    name: "Refit",
    websiteUrl: "https://www.refit.in",
    logoUrl: "https://cdn.demo.refurbcompare.in/sellers/refit.png",
    tagline: "Refurbished at honest prices",
    rating: 4.3,
    reviewCount: 5600,
    supportsAffiliate: false,
    allowRedirects: true,
  },
  {
    slug: "sahivalue",
    name: "SahaValue",
    websiteUrl: "https://www.sahivalue.com",
    logoUrl: "https://cdn.demo.refurbcompare.in/sellers/sahivalue.png",
    tagline: "Value refurbished electronics",
    rating: 4.2,
    reviewCount: 3100,
    supportsAffiliate: false,
    allowRedirects: true,
  },
  {
    slug: "mobilegoo",
    name: "MobileGoo",
    websiteUrl: "https://mobilegoo.in",
    logoUrl: "https://cdn.demo.refurbcompare.in/sellers/mobilegoo.png",
    tagline: "Graded pre-owned smartphones",
    rating: 4.5,
    reviewCount: 8400,
    supportsAffiliate: true,
    allowRedirects: true,
  },
];

export type AuthoringListing = {
  sellerSlug: string;
  productSlug: string;
  targetUrl: string;
  price: number;
  originalPrice: number;
  discountPct: number;
  condition: string;
  storage: number;
  inStock: boolean;
  stockStatus: "in_stock" | "low" | "out";
  offerBadge: string | null;
};

// Deterministic PRNG so demo data is stable across runs.
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: string[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

const CONDITIONS = ["Excellent", "Very Good", "Good"];

/** Build the full demo offer set: every seller × every product. */
export function buildDemoListings(): AuthoringListing[] {
  const listings: AuthoringListing[] = [];

  for (const seller of SELLERS) {
    for (const product of PRODUCTS) {
      const rand = mulberry32(hashSeed(seller.slug, product.slug));
      const priceJitter = 0.955 + rand() * 0.1; // ±5%
      const price = Math.round((product.basePrice * priceJitter) / 100) * 100;

      const originalPrice =
        Math.round((product.basePrice * (1.22 + rand() * 0.1)) / 100) * 100;

      const discountPct = Math.round(
        ((originalPrice - price) / originalPrice) * 100,
      );

      const condition = CONDITIONS[Math.min(CONDITIONS.length - 1, Math.floor(rand() * CONDITIONS.length))];
      const stockRoll = rand();

      listings.push({
        sellerSlug: seller.slug,
        productSlug: product.slug,
        targetUrl: `${seller.websiteUrl}/product/${product.slug}`,
        price,
        originalPrice,
        discountPct,
        condition,
        storage: product.storage,
        inStock: stockRoll > 0.08,
        stockStatus: stockRoll > 0.08 ? (stockRoll > 0.55 ? "in_stock" : "low") : "out",
        offerBadge: rand() > 0.75 ? (rand() > 0.5 ? "Certified" : "Flash Deal") : null,
      });
    }
  }

  return listings;
}

/**
 * TEST listings for a single legacy seller. Used by the five seller adapters
 * (cashify, budli, refit, sahivalue, mobilegoo) so they serve TEST data in demo
 * mode instead of throwing. Prices for the catalog devices that overlap the
 * canonical fixture variants are PINNED to the ladder in
 * packages/db/src/seed-data.ts (TEST_FIXTURE_VARIANTS); everything else uses the
 * deterministic demo walk. Every targetUrl lives on a non-resolvable
 * `test-<seller>.refurbcompare.in` host so Buy redirects are always refused.
 * This module must only be reached with NEXT_PUBLIC_DEMO_MODE=true — the
 * adapters enforce that gate before calling it.
 */
const FIXTURE_PRICE_OVERRIDES: Record<string, Record<string, number>> = {
  cashify: {
    "apple-iphone-13-128gb": 26799,
    "apple-iphone-13-256gb": 30999,
    "apple-iphone-14-128gb": 48799,
    "google-pixel-7-128gb": 24599,
  },
  budli: {
    "apple-iphone-13-128gb": 27199,
    "apple-iphone-13-256gb": 31499,
    "apple-iphone-14-128gb": 49299,
    "google-pixel-7-128gb": 24999,
  },
  refit: {
    "apple-iphone-13-128gb": 27599,
    "apple-iphone-13-256gb": 31999,
    "apple-iphone-14-128gb": 49699,
    "google-pixel-7-128gb": 25399,
  },
  sahivalue: {
    "apple-iphone-13-128gb": 27999,
    "apple-iphone-13-256gb": 32499,
    "apple-iphone-14-128gb": 50099,
    "google-pixel-7-128gb": 25799,
  },
  mobilegoo: {
    "apple-iphone-13-128gb": 28499,
    "apple-iphone-13-256gb": 32699,
    "apple-iphone-14-128gb": 50499,
    "google-pixel-7-128gb": 26299,
  },
};

export function buildDemoListingsForSeller(sellerSlug: string): AuthoringListing[] {
  const seller = SELLERS.find((s) => s.slug === sellerSlug);
  if (!seller) return [];
  const overrides = FIXTURE_PRICE_OVERRIDES[sellerSlug] ?? {};
  const listings: AuthoringListing[] = [];

  for (const product of PRODUCTS) {
    const pinned = overrides[product.slug] ?? null;
    const rand = mulberry32(hashSeed(seller.slug, product.slug));
    const price = pinned ?? Math.round((product.basePrice * (0.955 + rand() * 0.1)) / 100) * 100;
    const originalPrice = pinned !== null ? pinned + 4999 : Math.round((product.basePrice * (1.22 + rand() * 0.1)) / 100) * 100;

    listings.push({
      sellerSlug: seller.slug,
      productSlug: product.slug,
      targetUrl: `https://test-${seller.slug}.refurbcompare.in/product/${product.slug}${pinned ? "?fixture=1" : ""}`,
      price,
      originalPrice,
      discountPct: pinned ? 15 : Math.round(((originalPrice - price) / originalPrice) * 100),
      condition: "Excellent",
      storage: product.storage,
      inStock: true,
      stockStatus: "in_stock",
      offerBadge: pinned ? "TEST" : null,
    });
  }

  return listings;
}

/** Simulate ~45 days of price history per seller × product. */
export function buildDemoPriceHistory(days = 45) {
  type Point = {
    productSlug: string;
    sellerSlug: string;
    price: number;
    date: string;
  };

  const points: Point[] = [];
  const now = new Date();

  for (const product of PRODUCTS) {
    for (const seller of SELLERS) {
      const rand = mulberry32(hashSeed("history", seller.slug, product.slug));
      let price = Math.round((product.basePrice * (0.96 + rand() * 0.08)) / 100) * 100;

      for (let day = days; day >= 0; day--) {
        const drift = 1 - rand() * 0.006; // gentle weekend-dip walk
        price = Math.round((price * drift) / 100) * 100;

        const date = new Date(now);
        date.setDate(date.getDate() - day);
        date.setHours(12, 0, 0, 0);

        points.push({
          productSlug: product.slug,
          sellerSlug: seller.slug,
          price,
          date: date.toISOString(),
        });
      }
    }
  }

  return points;
}