import { MIN_MATCH_CONFIDENCE, type MatchingMethod } from '../types/enums.js';
import { canonicalizeBrand, extractModelNumber } from '../normalization/model.js';
import { parseRamGB, parseStorageGB } from '../normalization/storage.js';

export interface MatchableProduct {
  id: string;
  brand: string;
  model: string;
  modelNumber: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  variant: string | null;
}

export interface ParsedTitle {
  brand: string | null;
  modelNumber: string | null;
  storage: number | null;
  ram: number | null;
  rest: string;
}

const STORAGE_PATTERN = /(\d{2,3})\s*gb|(\d{1,3})\s*tb/i;
const RAM_PATTERN = /(\d{1,2})\s*gb\s*ram/i;

/**
 * Sub-model differentiators that must not fold one device tier into another:
 * "iPhone 13 Mini" is not "iPhone 13", "Galaxy S23 FE" is not "Galaxy S23".
 * When a title mentions a differentiator the canonical model does not, the
 * candidate is excluded instead of merging into the base model.
 */
const MODEL_DIFFERENTIATORS = new Set(['mini', 'pro', 'plus', 'max', 'ultra', 'lite', 'fe', 'promax']);

/**
 * Tokens that carry no model identity ("iPhone 13" vs "iPhone 11" both contain
 * "iphone"; "5G"/"Galaxy" add nothing). A candidate whose discriminating token
 * is missing from the title must not win on brand+storage points alone, or the
 * matcher folds iPhone 11 into iPhone 13 and Galaxy A54 into Galaxy S22.
 */
const GENERIC_MODEL_TOKENS = new Set([
  'iphone', 'ipad', 'galaxy', 'pixel', 'phone', 'smartphone', 'smartphones', 'mobile',
  'moto', 'oneplus', 'xperia', 'zenfone', 'redmi', 'poco', 'realme', 'honor', 'itel',
  'asus', 'nokia', 'mi', 'tab', 'tablet', '5g', '4g', '3g', 'lte', 'volte', 'cellular',
  'android', 'ios', 'ios', 'dual', 'sim', 'twin', 'edge', 'a', 's', 'm', 'f', 'c',
]);

/** Parse a free-text listing title into structured signals. */
export function parseTitle(title: string, knownBrands: string[]): ParsedTitle {
  const normalized = title.replace(/\s+/g, ' ').trim();

  let storage: number | null = null;
  const storageMatch = normalized.match(STORAGE_PATTERN);
  if (storageMatch) {
    // Prefer a TB group first, else the GB group.
    const unit = storageMatch[2] !== undefined ? 'tb' : 'gb';
    const value = storageMatch[2] !== undefined ? storageMatch[2] : storageMatch[1];
    storage = parseStorageGB(`${value} ${unit}`);
  }

  let ram: number | null = null;
  const ramMatch = normalized.match(RAM_PATTERN);
  if (ramMatch) ram = Number(ramMatch[1]);
  ram = parseRamGB(ram?.toString()) ?? ram;

  const modelNumber = extractModelNumber(normalized);

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
  if (!brand) {
    const inferred = canonicalizeBrand(normalized.trim().split(/\s+/)[0]);
    if (inferred) {
      brand = inferred;
      rest = normalized.slice(inferred.length).trim();
    }
  }

  return { brand, modelNumber, storage, ram, rest };
}

export interface ProductMatch {
  product: MatchableProduct;
  storage: number;
  confidence: number; // 0..1
  method: MatchingMethod;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[\s\-+]+/).filter((t) => t.length > 0);
}

/** Differentiators present in the title; matching candidates that carry none of
 * these are excluded so sub-models never fold into their base model. */
function titleDifferentiators(titleLower: string): string[] {
  const tokens = new Set(tokenize(titleLower));
  return [...MODEL_DIFFERENTIATORS].filter((d) => tokens.has(d));
}

/**
 * Score every candidate product against a parsed title and return the best
 * match with its method + confidence, or null below the confidence gate.
 */
export function matchProducts(
  candidates: MatchableProduct[],
  title: string,
): ProductMatch | null {
  if (candidates.length === 0) return null;
  const knownBrands = [...new Set(candidates.map((c) => c.brand))];
  const parsed = parseTitle(title, knownBrands);
  if (!parsed.brand) return null;

  // 1. Exact model number match wins outright.
  if (parsed.modelNumber) {
    for (const product of candidates) {
      if (!product.modelNumber) continue;
      if (parsed.modelNumber === product.modelNumber.toUpperCase()) {
        return {
          product,
          storage: parsed.storage ?? product.storage ?? 0,
          confidence: 0.98,
          method: 'EXACT_MODEL_NUMBER',
        };
      }
    }
  }

  const titleLower = title.toLowerCase();
  const titleTokens = new Set(tokenize(titleLower));
  const bannedDifferentiators = titleDifferentiators(titleLower);
  const results = candidates
    .filter((c) => c.brand === parsed.brand)
    .filter((c) => {
      const modelTokens = new Set(tokenize(c.model));
      if (bannedDifferentiators.length && !bannedDifferentiators.every((d) => modelTokens.has(d))) {
        return false;
      }
      const strong = [...modelTokens].filter((t) => !GENERIC_MODEL_TOKENS.has(t));
      if (strong.length === 0) return true; // no discriminating token — legacy overlap
      return strong.every((t) => titleTokens.has(t));
    })
    .map<MatchableProduct & { score: number }>((product) => {
      let score = 0;

      if (parsed.storage !== null && product.storage !== null && product.storage === parsed.storage) {
        score += 40;
      }

      const modelTokens = tokenize(product.model);
      const overlap = modelTokens.filter((token) => titleTokens.has(token)).length;
      score += (overlap / Math.max(modelTokens.length, 1)) * 50;

      if (product.color && titleLower.includes(product.color.toLowerCase())) {
        score += 6;
      }
      if (product.variant && titleLower.includes(product.variant.toLowerCase())) {
        score += 4;
      }

      return { ...product, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = results[0];
  if (!best || best.score < MIN_MATCH_CONFIDENCE * 100) return null;

  const confidence = Math.round(best.score) / 100;
  let method: MatchingMethod = 'FUZZY';
  if (parsed.storage !== null) method = 'BRAND_MODEL_STORAGE';
  if (best.variant && parsed.rest.toLowerCase().includes(best.variant.toLowerCase())) {
    method = 'BRAND_MODEL_STORAGE_VARIANT';
  }

  return {
    product: best,
    storage: parsed.storage ?? best.storage ?? 0,
    confidence,
    method,
  };
}

export function unmatchedProduct(confidence = 0): ProductMatch | null {
  return null;
}

export { canonicalizeBrand } from '../normalization/model.js';