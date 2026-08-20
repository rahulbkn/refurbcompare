// Normalized condition grades used across the platform.
export type NormalizedCondition = "Like New" | "Excellent" | "Very Good" | "Good";

export const CONDITION_ORDER: NormalizedCondition[] = [
  "Good",
  "Very Good",
  "Excellent",
  "Like New",
];

const CONDITIONS: Record<string, NormalizedCondition> = {
  "like new": "Like New",
  "likenew": "Like New",
  "like-new": "Like New",
  "as new": "Like New",
  "unboxed": "Like New",
  "excellent": "Excellent",
  "excellent condition": "Excellent",
  "certified": "Excellent",
  "a": "Excellent",
  "a+": "Like New",
  "very good": "Very Good",
  "verygood": "Very Good",
  "great": "Very Good",
  "b": "Very Good",
  "b+": "Very Good",
  "good": "Good",
  "good condition": "Good",
  "used": "Good",
  "c": "Good",
  "functional": "Good",
  "fair": "Good",
};

/**
 * Normalize an arbitrary seller condition label ("A+/Certified", "Verygood",
 * "Good", etc.) to a canonical grade. Unknown labels fall back to "Good".
 *
 * Matching strategy, most specific first:
 *   1. exact normalized key lookup ("a+", "certified", "very good")
 *   2. whole-token lookup among space-separated words ("A+" in "A+ Certified")
 *   3. longest multi-character substring match (avoids the greedy single
 *      letters "a"/"b"/"c" matching common words like "label")
 */
export function normalizeCondition(label?: string | null): NormalizedCondition {
  if (!label) return "Good";

  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+/g, "");

  if (normalized in CONDITIONS) return CONDITIONS[normalized];

  // Whole-token match (spaces preserved this time).
  const words = label
    .trim()
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((w) => w.replace(/^[^a-z0-9+]+|[^a-z0-9+]+$/g, ""))
    .filter(Boolean);
  for (const word of words) {
    if (word in CONDITIONS) return CONDITIONS[word];
  }

  // Longest multi-character substring match.
  const candidates = Object.keys(CONDITIONS)
    .filter((candidate) => candidate.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    if (normalized.includes(candidate)) return CONDITIONS[candidate];
  }

  return "Good";
}

/** Numeric grade for a condition (higher is better). */
export function conditionScore(condition?: string | null): number {
  const normalized = normalizeCondition(condition);
  return CONDITION_ORDER.indexOf(normalized);
}

/** Human-friendly label for a normalized condition. */
export function conditionLabel(condition?: string | null): string {
  return normalizeCondition(condition);
}