const BRAND_ALIASES: Record<string, string> = {
  apple: 'Apple',
  iphone: 'Apple',
  samsung: 'Samsung',
  galaxy: 'Samsung',
  'oneplus': 'OnePlus',
  'one plus': 'OnePlus',
  google: 'Google',
  pixel: 'Google',
  xiaomi: 'Xiaomi',
  'redmi': 'Xiaomi',
  poco: 'Xiaomi',
  oppo: 'Oppo',
  vivo: 'Vivo',
  motorola: 'Motorola',
  moto: 'Motorola',
  realme: 'Realme',
  nokia: 'Nokia',
  asus: 'Asus',
  'rog': 'Asus',
};

export function canonicalizeBrand(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const alias = BRAND_ALIASES[key];
  if (alias) return alias;
  const words = key.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return null;
  return words.map((w) => (w[0]?.toUpperCase() ?? '') + w.slice(1)).join(' ');
}

const KNOWN_MODEL_NUMBER_PATTERNS: RegExp[] = [
  /\b[A-Z]{1,2}[- ]?\d{4,5}\b/i, // Samsung SM-S901E, SM-G991B
  /\bSM-[A-Z]?\d{3,4}[A-Z]?\b/i, // Samsung SM-S901E / SM-A346E
  /\bA\d{4}\b/i, // iPhone A2633
  /\bM[A-Z]\d{3,4}[A-Z]{1,2}\s*\/?\s*[A-Z]?\b/i, // iPhone MLPF3LL/A
  /\b[A-Z]{2}\d{3,5}\b/, // OnePlus/Google PCB patterns (NE2213)
  /\b\d{5}[A-Z]{1,3}\b/, // misc model codes
];

/**
 * Attempts to extract a hardware model number from a title.
 * Returns the uppercased code or null. Conservative: only accepts
 * well-formed codes so common words are not misread as model numbers.
 */
export function extractModelNumber(title: string): string | null {
  for (const pattern of KNOWN_MODEL_NUMBER_PATTERNS) {
    const match = title.match(pattern);
    if (!match) continue;
    const raw = match[0];
    const code = raw.replace(/[\s-]/g, '').toUpperCase();
    // Guard against matching the phone-size number itself (e.g. "12 128GB")
    // by requiring a letter prefix except for the pure numeric AC vendor codes.
    if (/^\d{5}[A-Z]{1,3}$/.test(code)) {
      const isACCode = code.startsWith('1100') || code.startsWith('PM');
      if (!isACCode) continue;
    }
    return code;
  }
  return null;
}

/** Build a URL-safe slug for a product. */
export function buildSlug(brand: string, model: string, storageGb: number | null): string {
  const base = `${brand} ${model}${storageGb ? ` ${storageGb}GB` : ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base;
}