import type { AuthoringProduct } from "@/services/ingestion/mock/data";
import { normalizeCondition } from "./condition-mapping";

export type MatchedProduct = {
  product: AuthoringProduct;
  storage: number;
  confidence: number;
};

const STORAGE_PATTERN = /(\d{2,3})\s*gb/i;

/**
 * Extract (brand, modelTokens, storageGb) from a free-text product title.
 * Used to match a provider's listing title against our canonical products.
 */
export function parseTitle(
  title: string,
  knownBrands: string[],
): { brand: string | null; storage: number | null; rest: string } {
  const normalized = title.replace(/\s+/g, " ").trim();

  const storageMatch = normalized.match(STORAGE_PATTERN);
  const storage = storageMatch ? Number(storageMatch[1]) : null;

  let brand: string | null = null;
  let rest = normalized;
  for (const candidate of knownBrands) {
    const index = normalized.toLowerCase().indexOf(candidate.toLowerCase());
    if (index >= 0) {
      brand = candidate;
      rest = normalized.slice(index + candidate.length).trim();
      break;
    }
  }

  return { brand, storage, rest };
}

/**
 * Score every canonical product against a normalized title and return the
 * best candidate (brand + storage overlap wins).
 */
export function matchTitle(
  products: AuthoringProduct[],
  title: string,
): MatchedProduct | null {
  const brands = [...new Set(products.map((product) => product.brand))];
  const parsed = parseTitle(title, brands);

  if (!parsed.brand) return null;

  const candidates = products
    .filter((product) => product.brand === parsed.brand)
    .map<AuthoringProduct & { score: number }>((product) => {
      let score = 0;
      const titleLower = title.toLowerCase();

      if (parsed.storage !== null && product.storage === parsed.storage) {
        score += 40;
      }

      const modelTokens = product.model.toLowerCase().split(/[\s-]+/);
      const overlap = modelTokens.filter((token) =>
        titleLower.includes(token),
      ).length;
      score += (overlap / Math.max(modelTokens.length, 1)) * 50;

      if (titleLower.includes(product.color?.toLowerCase() ?? "___")) {
        score += 10;
      }

      return { ...product, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 45) return null;

  const product = best;

  return {
    product,
    storage: parsed.storage ?? best.storage,
    confidence: Math.round(best.score),
  };
}

export type NormalizedListing = {
  title: string;
  match: MatchedProduct | null;
  condition: string;
};

/** Clean a provider title and attach the matched canonical product. */
export function normalizeListing(
  products: AuthoringProduct[],
  title: string,
): NormalizedListing {
  return {
    title,
    match: matchTitle(products, title),
    condition: normalizeCondition(title),
  };
}