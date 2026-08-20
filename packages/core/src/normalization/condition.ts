import type { NormalizedCondition } from '../types/enums.js';

export const CONDITION_SCORES: Record<NormalizedCondition, number> = {
  LIKE_NEW: 100,
  EXCELLENT: 90,
  GOOD: 75,
  REFURBISHED: 70,
  PRE_OWNED: 60,
  FAIR: 50,
  UNKNOWN: 40,
};

export const CONDITION_DESCRIPTIONS: Record<NormalizedCondition, string> = {
  LIKE_NEW: 'Pristine, looks and performs new',
  EXCELLENT: 'Light use, no visible wear',
  GOOD: 'Minor signs of use, fully functional',
  REFURBISHED: 'Professionally restored/grade-certified',
  PRE_OWNED: 'Used, fully functional',
  FAIR: 'Noticeable wear, fully functional',
  UNKNOWN: 'Condition grade not provided by seller',
};

const EXACT_KEYS: Record<string, NormalizedCondition> = {
  'a+': 'LIKE_NEW',
  'like new': 'LIKE_NEW',
  'like-new': 'LIKE_NEW',
  'pristine': 'LIKE_NEW',
  'sealed': 'LIKE_NEW',
  'unused': 'LIKE_NEW',
  'excellent': 'EXCELLENT',
  'very good': 'EXCELLENT',
  'a': 'EXCELLENT',
  'good': 'GOOD',
  'b+': 'GOOD',
  'refurbished': 'REFURBISHED',
  'refurb': 'REFURBISHED',
  'renewed': 'REFURBISHED',
  'certified': 'REFURBISHED',
  'pre owned': 'PRE_OWNED',
  'pre-owned': 'PRE_OWNED',
  'used': 'PRE_OWNED',
  'lightly used': 'PRE_OWNED',
  'fair': 'FAIR',
  'b': 'FAIR',
  'c': 'FAIR',
};

const TOKEN_KEYS: Record<string, NormalizedCondition> = {
  'new': 'LIKE_NEW',
  'excellent': 'EXCELLENT',
  'verygood': 'EXCELLENT',
  'good': 'GOOD',
  'refurbished': 'REFURBISHED',
  'refurb': 'REFURBISHED',
  'renewed': 'REFURBISHED',
  'certified': 'REFURBISHED',
  'used': 'PRE_OWNED',
  'preowned': 'PRE_OWNED',
  'pre-owned': 'PRE_OWNED',
  'fair': 'FAIR',
};

const SUBSTRING_KEYS: { key: string; value: NormalizedCondition }[] = [
  { key: 'like new', value: 'LIKE_NEW' },
  { key: 'like-new', value: 'LIKE_NEW' },
  { key: 'excellent', value: 'EXCELLENT' },
  { key: 'refurbished', value: 'REFURBISHED' },
  { key: 'refurb', value: 'REFURBISHED' },
  { key: 'renewed', value: 'REFURBISHED' },
  { key: 'certified', value: 'REFURBISHED' },
  { key: 'pre-owned', value: 'PRE_OWNED' },
  { key: 'pre owned', value: 'PRE_OWNED' },
  { key: 'preowned', value: 'PRE_OWNED' },
  { key: 'very good', value: 'EXCELLENT' },
  { key: 'lightly used', value: 'PRE_OWNED' },
  { key: 'good', value: 'GOOD' },
  { key: 'used', value: 'PRE_OWNED' },
  { key: 'fair', value: 'FAIR' },
];

export interface ConditionResult {
  normalized: NormalizedCondition;
  score: number;
  description: string;
  source: string | null;
}

/**
 * Maps a raw seller condition string to a normalized grade.
 * Order: exact key -> whole token -> longest multi-char substring.
 * Single letters ("a", "b", "c") are only honored as exact keys to avoid
 * false positives on words that merely contain those letters.
 */
export function normalizeCondition(raw: string | null | undefined): ConditionResult {
  const source = raw?.trim().toLowerCase() || null;
  if (!source) {
    return {
      normalized: 'UNKNOWN',
      score: CONDITION_SCORES.UNKNOWN,
      description: CONDITION_DESCRIPTIONS.UNKNOWN,
      source: null,
    };
  }

  if (EXACT_KEYS[source]) {
    const normalized = EXACT_KEYS[source]!;
    return finish(normalized, source);
  }

  const tokens = source.split(/[^a-z0-9+]/).filter((t) => t.length > 0);
  for (const token of tokens) {
    const hit = TOKEN_KEYS[token];
    if (hit) return finish(hit, source);
  }

  for (const { key, value } of SUBSTRING_KEYS) {
    if (source.includes(key)) return finish(value, source);
  }

  return {
    normalized: 'UNKNOWN',
    score: CONDITION_SCORES.UNKNOWN,
    description: CONDITION_DESCRIPTIONS.UNKNOWN,
    source,
  };
}

function finish(normalized: NormalizedCondition, source: string): ConditionResult {
  return {
    normalized,
    score: CONDITION_SCORES[normalized],
    description: CONDITION_DESCRIPTIONS[normalized],
    source,
  };
}