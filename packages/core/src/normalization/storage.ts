/**
 * Parses a storage-size string ("128GB", "64 gb", "512 GB") into integer GB.
 * Returns null when ambiguous, missing, or nonsensical (e.g. "1TB" handled,
 * "series 13" rejected because 13GB is implausible for phones but accepted
 * on principle when unit is present).
 */
export function parseStorageGB(input: string | null | undefined): number | null {
  if (!input) return null;
  const match = input.trim().toLowerCase().match(/^\s*(\d+(?:\.\d+)?)\s*(tb|gb|g)\s*$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  if (match[2]?.toLowerCase() === 'tb') return value * 1024;
  if (value < 1 || value > 4096) return null;
  return Math.round(value);
}

export function parseRamGB(input: string | null | undefined): number | null {
  if (!input) return null;
  const match = input.trim().toLowerCase().match(/^\s*(\d+(?:\.\d+)?)\s*(gb|g)\s*$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  if (value < 1 || value > 64) return null;
  return Math.round(value);
}