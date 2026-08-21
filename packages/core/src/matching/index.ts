import { MIN_MATCH_CONFIDENCE, type MatchingMethod } from '../types/enums.js';
import { buildSlug, canonicalizeBrand, extractModelNumber } from '../normalization/model.js';

export interface MatchableProduct {
  id: string;
  brand: string;
  model: string;
  modelNumber: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  variant: string | null;
  imageUrl?: string | null;
}

export interface ParsedTitle {
  brand: string | null;
  modelNumber: string | null;
  storage: number | null;
  ram: number | null;
  rest: string;
}

/**
 * RAM-vs-storage aware capacity extraction. Labeled fragments win ("8GB RAM",
 * "256GB Storage/ROM"), then paired forms split by magnitude ("12+256GB",
 * "8/256", "8GB/256GB", "512GB/1TB"), then fused tokens ("12256GB"), then lone
 * capacity tokens classified by size (RAM <= 24 GB, storage >= 32 GB). RAM is
 * never reported as storage. All consumed fragments are stripped from the
 * returned remainder so they cannot leak into derived model names.
 */
const RAM_LABELED_RE = /(\d{1,2})\s*(?:gb|g)\s*(?:ram|memory)\b/gi;
const STORAGE_LABELED_RE = /(\d{1,4}(?:\.\d+)?)\s*(tb|gb|g)\s*(?:storage|rom|internal|emmc|ufs)\b/gi;
const PAIRED_RE = /\b(\d{1,2})\s*(?:gb|g)?\s*[+/|]\s*(\d{1,4})\s*(gb|tb|g)?(?!\w)/gi;
const FUSED_RE = /\b(\d{1,2})(64|128|256|512)gb\b/gi;
const FUSED_UNITED_RE = /\b(\d{1,2})gb(\d{2,4})gb\b/gi;
// Bare "g" is deliberately excluded: "5G"/"4G" network markers outnumber real
// "128g" capacity spellings by orders of magnitude.
const GENERIC_CAP_RE = /(\d{1,4}(?:\.\d+)?)\s*(gb|tb)\b/gi;

function toGB(value: number, unit: string | undefined): number {
  return unit && unit.toLowerCase() === 'tb' ? value * 1024 : value;
}

function extractCapacities(text: string): { storage: number | null; ram: number | null; cleaned: string } {
  let working = text;
  const ramValues: number[] = [];
  const storageValues: number[] = [];

  working = working.replace(RAM_LABELED_RE, (_m, v: string) => {
    ramValues.push(Number(v));
    return ' ';
  });
  working = working.replace(STORAGE_LABELED_RE, (_m, v: string, u: string) => {
    storageValues.push(toGB(Number(v), u));
    return ' ';
  });
  working = working.replace(PAIRED_RE, (_m, a: string, b: string, ub?: string) => {
    const va = Number(a);
    const vb = toGB(Number(b), ub);
    if (va <= 24 && vb >= 32) {
      ramValues.push(va);
      storageValues.push(vb);
    } else if (vb <= 24 && va >= 32) {
      ramValues.push(vb);
      storageValues.push(va);
    } else if (va >= 32 && vb >= 32) {
      storageValues.push(Math.max(va, vb));
    }
    return ' ';
  });
  working = working.replace(FUSED_RE, (_m, a: string, b: string) => {
    ramValues.push(Number(a));
    storageValues.push(Number(b));
    return ' ';
  });
  working = working.replace(FUSED_UNITED_RE, (_m, a: string, b: string) => {
    ramValues.push(Number(a));
    if (Number(b) >= 32) storageValues.push(Number(b));
    return ' ';
  });
  working = working.replace(GENERIC_CAP_RE, (_m, v: string, u: string) => {
    const gb = toGB(Number(v), u);
    if (gb >= 32) storageValues.push(gb);
    else ramValues.push(gb);
    return ' ';
  });

  return {
    storage: storageValues.length > 0 ? Math.max(...storageValues) : null,
    ram: ramValues.length > 0 ? Math.min(...ramValues) : null,
    cleaned: working.replace(/\s+/g, ' ').trim(),
  };
}

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
  const cap = extractCapacities(normalized);
  const remainder = cap.cleaned;

  const modelNumber = extractModelNumber(remainder);

  let brand: string | null = null;
  let rest = remainder;
  for (const candidate of knownBrands) {
    const index = remainder.toLowerCase().indexOf(candidate.toLowerCase());
    if (index >= 0) {
      brand = candidate;
      rest = remainder.slice(index + candidate.length).trim();
      break;
    }
  }
  if (!brand) {
    const inferred = canonicalizeBrand(remainder.trim().split(/\s+/)[0]);
    if (inferred) {
      brand = inferred;
      rest = remainder.slice(inferred.length).trim();
    }
  }

  return { brand, modelNumber, storage: cap.storage, ram: cap.ram, rest };
}

export interface ProductMatch {
  product: MatchableProduct;
  storage: number;
  confidence: number; // 0..1
  method: MatchingMethod;
}

/** Canonical product identity derived from a live listing title that did not
 * match any known catalog product. Used to grow the catalog from provider data
 * instead of silently dropping eligible devices. */
export interface DerivedProduct {
  brand: string;
  model: string;
  modelNumber: string | null;
  variant: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  slug: string;
  confidence: number;
  method: MatchingMethod;
}

const BRANDS_FOR_PARSE = [
  'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Redmi', 'Poco', 'Oppo', 'Vivo',
  'Realme', 'Nokia', 'Asus', 'ROG', 'Honor', 'itel', 'Infinix', 'Tecno', 'Nothing', 'Motorola', 'Moto',
];

type DeriveSignals = {
  storageGB?: number | null;
  ramGB?: number | null;
  modelNumber?: string | null;
};

/** Words that carry no model identity in a listing title. Kept intentionally
 * larger than GENERIC_MODEL_TOKENS because derive runs on unmatched titles that
 * often contain retail filler ("Excel+", "A+ grade", "with box"). */
const DERIVE_NOISE = new Set([
  ...GENERIC_MODEL_TOKENS,
  'new', 'used', 'open', 'box', 'sealed', 'unlocked', 'locked', 'network', 'unlockedonly',
  'refurbished', 'renewed', 'like', 'mint', 'excellent', 'good', 'fair', 'poor', 'graded',
  'grade', 'a', 'a+', 'premium', 'certified', 'authorised', 'authorized', 'original', 'genuine',
  'official', 'condition', 'warranty', 'months', 'days', 'return', 'returns', 'guarantee',
  'with', 'without', 'and', 'or', 'the', 'from', 'in', 'on', 'for', 'you', 'your', 'upgrade',
  'offer', 'offers', 'deal', 'deals', 'price', 'rates', 'rate', 'best', 'buy', 'now',
  'black', 'white', 'silver', 'gold', 'rose', 'midnight', 'starlight', 'graphite', 'space',
  'blue', 'green', 'purple', 'red', 'pink', 'yellow', 'orange', 'gray', 'grey', 'brown',
  'titanium', 'sand', 'cream', 'navy', 'teal', 'copper', 'beige', 'olive', 'charcoal',
  'newer', 'latest', 'demo', 'display', 'piece', 'stock', 'inbox', 'boxed', 'sim', 'tray',
  'charger', 'charging', 'cable', 'cables', 'usb', 'case', 'cover', 'cover', 'screen',
  'glass', 'tempered', 'protector', 'guard', 'stand', 'holder', 'earbuds', 'earphone',
  'headphone', 'headphones', 'adapter', 'sleeve', 'pouch', 'skin', 'bumper', 'strap',
  'replacement', 'accessory', 'accessories', 'smartwatch', 'band', 'watch',
]);

const STORAGE_TOKEN_RE = /^\d{1,3}\s*(gb|tb|gigs?|rom)$/i;
const RAM_TOKEN_RE = /^\d{1,2}\s*gb\s*ram$/i;

/** Capacity fragments that arrive fused into a single token ("8GB/128GB",
 * "12+256GB", "8gb128gb", "12256gb") and would otherwise leak into derived
 * model names. Applied to the title remainder before tokenizing. */
function stripCapacityFragments(value: string): string {
  return value
    .replace(/\b\d{1,2}\s*(?:gb)?\s*[/|]\s*\d{2,4}\s*(?:gb|tb)\b/gi, ' ')
    .replace(/\b\d{1,2}\s*(?:gb)?\s*\+\s*\d{2,4}\s*(?:gb|tb)\b/gi, ' ')
    .replace(/\b\d{1,2}gb\d{2,4}gb\b/gi, ' ')
    .replace(/\b\d{4,6}\s*(?:gb|tb)\b/gi, ' ');
}

/** Brand-line words stripped by GENERIC_MODEL_TOKENS for matching purposes but
 * required in a derived display name ("Google 10 Pro" is meaningless without
 * "Pixel"). Only tokens that ARE the model line for their brand belong here. */
const DERIVE_MODEL_LINE_TOKENS = new Set(['pixel']);

/**
 * Derives a canonical product identity from an unmatched listing title.
 * Returns null when the title is too ambiguous (no brand, no distinguishing
 * model token) so we never fabricate junk products from noise titles.
 */
export function deriveCanonicalProduct(
  title: string,
  signals: DeriveSignals = {},
): DerivedProduct | null {
  const parsed = parseTitle(title, BRANDS_FOR_PARSE);
  if (!parsed.brand) return null;

  const storage = parsed.storage ?? signals.storageGB ?? null;
  const ram = parsed.ram ?? signals.ramGB ?? null;
  const modelNumber = parsed.modelNumber ?? signals.modelNumber ?? null;

  const rest = stripCapacityFragments(parsed.rest);

  const tokens = tokenize(rest)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 0 && t !== storage?.toString())
    .filter((t) => !DERIVE_NOISE.has(t) || DERIVE_MODEL_LINE_TOKENS.has(t))
    .filter((t) => !STORAGE_TOKEN_RE.test(t))
    .filter((t) => !RAM_TOKEN_RE.test(t));

  const differentiators = titleDifferentiators(rest.toLowerCase()).map((d) => d.toUpperCase());
  const variant = differentiators.length > 0 ? differentiators.join(' ') : null;

  // Keep only tokens that carry model identity: digit-bearing tokens (s23, a54,
  // g991, 11, 12 mini) or known words. Numeric tokens that merely echo the parsed
  // storage (e.g. a bare "128" after "128 GB") are dropped to avoid noise models.
  const modelTokens = tokens.filter((t) => {
    if (storage !== null && /^\d+$/.test(t) && Number(t) === storage) return false;
    if (ram !== null && /^\d+$/.test(t) && Number(t) === ram) return false;
    return /^[a-z]+\d+/i.test(t) || /\d/.test(t) || MODEL_DIFFERENTIATORS.has(t) || ['se', 'es', 'edge'].includes(t) || DERIVE_MODEL_LINE_TOKENS.has(t);
  });
  // De-duplicate repeated fragments ("Pro Pro", doubled capacity leftovers)
  // while preserving first-seen order.
  const seenTokens = new Set<string>();
  const uniqueModelTokens = modelTokens.filter((t) => {
    const key = t.toLowerCase();
    if (seenTokens.has(key)) return false;
    seenTokens.add(key);
    return true;
  });
  let model = uniqueModelTokens
    .map((t) => (MODEL_DIFFERENTIATORS.has(t) ? t.toUpperCase() : t))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!model) return null;
  model = model
    .split(' ')
    .map((w) => (w === w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');

  const slug = buildSlug(parsed.brand, model, storage, ram);
  return {
    brand: parsed.brand,
    model,
    modelNumber,
    variant,
    storage,
    ram,
    color: parsedColor(parsed.rest),
    slug,
    confidence: 0.5,
    method: 'UNMATCHED',
  };
}

function parsedColor(rest: string): string | null {
  const lower = rest.toLowerCase();
  const colors = ['midnight', 'starlight', 'graphite', 'silver', 'gold', 'rose', 'blue', 'green', 'purple', 'red', 'pink', 'yellow', 'black', 'white', 'gray', 'grey', 'titanium', 'space black'];
  const found = colors.find((c) => lower.includes(c));
  return found
    ? found.split(' ').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')
    : null;
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

      // RAM variants are distinct SKUs: a title stating its RAM must never
      // attach to a catalog row with conflicting RAM, and prefers one that
      // agrees. Rows with unknown RAM stay neutral so legacy data still matches.
      if (parsed.ram !== null && product.ram !== null) {
        if (product.ram !== parsed.ram) score -= 100;
        else score += 5;
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