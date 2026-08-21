import { describe, it, expect } from 'vitest';
import { parseTitle, matchProducts, canonicalizeBrand, MIN_MATCH_CONFIDENCE, deriveCanonicalProduct } from '@refurbcompare/core';
import type { MatchableProduct } from '@refurbcompare/core';

const CANDIDATES: MatchableProduct[] = [
  {
    id: 'prod_apple-iphone-13-128gb',
    brand: 'Apple',
    model: 'iPhone 13',
    modelNumber: 'A2633',
    storage: 128,
    ram: 4,
    color: 'Midnight',
    variant: null,
  },
  {
    id: 'prod_apple-iphone-13-256gb',
    brand: 'Apple',
    model: 'iPhone 13',
    modelNumber: null,
    storage: 256,
    ram: 4,
    color: null,
    variant: null,
  },
  {
    id: 'prod_samsung-galaxy-s22-5g-128gb',
    brand: 'Samsung',
    model: 'Galaxy S22 5G',
    modelNumber: 'SM-S901E',
    storage: 128,
    ram: 8,
    color: null,
    variant: null,
  },
  {
    id: 'prod_google-pixel-7-128gb',
    brand: 'Google',
    model: 'Pixel 7',
    modelNumber: null,
    storage: 128,
    ram: 8,
    color: 'Snow',
    variant: null,
  },
  {
    id: 'prod_oneplus-11-5g-128gb',
    brand: 'OnePlus',
    model: '11 5G',
    modelNumber: null,
    storage: 128,
    ram: 8,
    color: null,
    variant: null,
  },
];

describe('parseTitle', () => {
  it('extracts brand, storage and leaves the rest of the title', () => {
    const parsed = parseTitle('Apple iPhone 13 128GB Certified', ['Apple']);
    expect(parsed.brand).toBe('Apple');
    expect(parsed.storage).toBe(128);
    expect(parsed.rest).toContain('128GB');
  });

  it('detects storage with different spacing', () => {
    expect(parseTitle('Samsung Galaxy S22 256 gb', ['Samsung']).storage).toBe(256);
  });

  it('parses terabyte (1TB) storage from raw seller catalog text', () => {
    expect(parseTitle('Apple iPhone 16 Pro 1TB Natural', ['Apple']).storage).toBe(1024);
    expect(parseTitle('Samsung Galaxy 24 Ultra 1 TB Titanium', ['Samsung']).storage).toBe(1024);
  });

  it('falls back to brand alias inference for unknown brands', () => {
    const parsed = parseTitle('Pixel 7 128GB Snow', ['Apple', 'Samsung']);
    expect(parsed.brand).toBe('Google');
  });

  it('inferences a brand from the first word for unknown brands', () => {
    const parsed = parseTitle('Unbranded Phone 128GB', ['Apple']);
    expect(parsed.brand).toBe('Unbranded');
    expect(parsed.rest).toBe('Phone 128GB');
  });
});

describe('matchProducts', () => {
  it('returns an exact model-number match with high confidence', () => {
    const match = matchProducts(CANDIDATES, 'Apple iPhone 13 A2633 128GB Midnight');
    expect(match).not.toBeNull();
    expect(match?.product.id).toBe('prod_apple-iphone-13-128gb');
    expect(match?.method).toBe('EXACT_MODEL_NUMBER');
    expect(match?.confidence).toBeGreaterThan(MIN_MATCH_CONFIDENCE);
  });

  it('matches brand + model + storage when no model number present', () => {
    const match = matchProducts(CANDIDATES, 'Google Pixel 7 128GB Snow');
    expect(match?.product.id).toBe('prod_google-pixel-7-128gb');
    expect(match?.confidence).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });

  it('picks the storage variant that appears in the title', () => {
    const match = matchProducts(CANDIDATES, 'Apple iPhone 13 256GB');
    expect(match?.product.id).toBe('prod_apple-iphone-13-256gb');
  });

  it('returns null below the confidence gate (unrelated brand)', () => {
    const match = matchProducts(CANDIDATES, 'Nokia 3310 64GB');
    expect(match).toBeNull();
  });

  it('matches the canonical catalog headlines exercised by the live crawler (iPhone 13 / S22 / OnePlus 11 / Pixel 7)', () => {
    const headline = (brand: string, model: string, storage: string) => `${brand} ${model} ${storage} Refurbished`;

    const iphone = matchProducts(CANDIDATES, headline('Apple', 'iPhone 13', '128GB'));
    expect(iphone?.product.id).toBe('prod_apple-iphone-13-128gb');
    expect(iphone?.confidence).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);

    const s22 = matchProducts(CANDIDATES, headline('Samsung', 'Galaxy S22', '128GB'));
    expect(s22?.product.id).toBe('prod_samsung-galaxy-s22-5g-128gb');
    expect(s22?.confidence).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);

    const pixel = matchProducts(CANDIDATES, headline('Google', 'Pixel 7', '128GB'));
    expect(pixel?.product.id).toBe('prod_google-pixel-7-128gb');
    expect(pixel?.confidence).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);

    const onePlus = matchProducts(CANDIDATES, 'OnePlus 11 5G 128GB Green');
    expect(onePlus?.method).toBe('BRAND_MODEL_STORAGE');
    expect(onePlus?.confidence).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });

  it('returns null for an EMPTY candidate set', () => {
    expect(matchProducts([], 'Apple iPhone 13 128GB')).toBeNull();
  });

  it('never folds a sub-model into its base model (iPhone 13 Mini != iPhone 13)', () => {
    const match = matchProducts(CANDIDATES, 'Apple iPhone 13 Mini 128GB renewed');
    expect(match).toBeNull();
  });

  it('rejects a different device tier mentioned in the title (Pixel 7 Pro != Pixel 7)', () => {
    const match = matchProducts(CANDIDATES, 'Google Pixel 7 Pro 128GB Snow');
    expect(match).toBeNull();
  });

  it('never lets brand+storage win when the model token is absent (iPhone 11 != iPhone 13)', () => {
    const match = matchProducts(CANDIDATES, 'Apple iPhone 11 128GB renewed');
    expect(match).toBeNull();
  });

  it('never lets brand+storage win for a different model series (Galaxy A54 != Galaxy S22)', () => {
    const match = matchProducts(CANDIDATES, 'Samsung Galaxy A54 5G 128GB');
    expect(match).toBeNull();
  });

  it('keeps the differentiated model when the candidate list carries it', () => {
    const withPro = [
      ...CANDIDATES,
      {
        id: 'prod_google-pixel-7-pro-128gb',
        brand: 'Google',
        model: 'Pixel 7 Pro',
        modelNumber: null,
        storage: 128,
        ram: 12,
        color: null,
        variant: null,
      },
    ];
    const match = matchProducts(withPro, 'Google Pixel 7 Pro 128GB Snow');
    expect(match?.product.id).toBe('prod_google-pixel-7-pro-128gb');
    expect(match?.confidence).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
  });
});

describe('canonicalizeBrand passthrough', () => {
  it('is re-exported from the core barrel', () => {
    expect(canonicalizeBrand('poco')).toBe('Xiaomi');
    expect(canonicalizeBrand('samsung')).toBe('Samsung');
  });
});

describe('deriveCanonicalProduct name normalization', () => {
  it('strips fused slash-separated capacity fragments from the model name', () => {
    const d = deriveCanonicalProduct(
      'Samsung Galaxy S21 FE 5G (8GB/128GB) 8GB/128GB Phantom Black',
    );
    expect(d).not.toBeNull();
    expect(d!.brand).toBe('Samsung');
    expect(d!.model).toBe('S21 FE');
    expect(d!.model).not.toMatch(/gb/i);
    expect(d!.variant).toBe('FE');
    expect(d!.storage).toBe(128);
    expect(d!.slug).toBe('samsung-s21-fe-128gb');
  });

  it('keeps the Pixel model line in derived Google product names', () => {
    const d = deriveCanonicalProduct('Google Pixel 10 Pro 16/256GB Obsidian');
    expect(d).not.toBeNull();
    expect(d!.brand).toBe('Google');
    expect(d!.model).toContain('Pixel');
    expect(d!.model).not.toMatch(/\d{4,}gb/i);
    expect(d!.variant).toBe('PRO');
    expect(d!.slug).toBe('google-pixel-10-pro-256gb');
  });

  it('normalizes plus-separated and pre-concatenated capacity tokens', () => {
    const plus = deriveCanonicalProduct('Vivo X9s 5G 12+256GB');
    expect(plus!.model).toBe('X9s');
    expect(plus!.slug).toBe('vivo-x9s-256gb');

    const fused = deriveCanonicalProduct('Oppo X9s 8gb128gb');
    expect(fused!.model).toBe('X9s');
    expect(fused!.model).not.toMatch(/gb/i);
    expect(fused!.slug).toBe('oppo-x9s-128gb');

    const blob = deriveCanonicalProduct('Realme 13 Pro 12256gb');
    expect(blob!.model).toBe('13 PRO');
    expect(blob!.model).not.toMatch(/gb/i);
  });

  it('removes duplicated capacity/model fragments', () => {
    const d = deriveCanonicalProduct(
      'Samsung S21 FE 8GB/128GB 8GB/128GB Unlocked',
    );
    expect(d!.model).toBe('S21 FE');
    expect(d!.model.split('S21').length - 1).toBe(1);

    const dup = deriveCanonicalProduct('OnePlus Nord CE4 Lite Pro Pro 128GB');
    expect(dup!.model.split(' ').filter((w) => w === 'PRO')).toHaveLength(1);
  });

  it('keeps variants separated and preserves meaningful model tokens', () => {
    const cases: Array<[string, string, string | null]> = [
      ['Apple iPhone 13 Mini 128GB Midnight', '13 MINI', 'MINI'],
      ['Samsung Galaxy S22 Plus 5G 128GB', 'S22 PLUS', 'PLUS'],
      ['Xiaomi 14 Ultra 5G 512GB', '14 ULTRA', 'ULTRA'],
      ['Google Pixel 8 Pro 5G 128GB', 'Pixel 8 PRO', 'PRO'],
      ['OnePlus 12 Pro Max 16GB+512GB', '12 PRO MAX', 'PRO MAX'],
    ];
    for (const [title, model, variant] of cases) {
      const d = deriveCanonicalProduct(title);
      expect(d, title).not.toBeNull();
      expect(d!.model, title).toBe(model);
      expect(d!.variant, title).toBe(variant);
    }
  });

  it('drops bare numeric echoes of parsed storage and ram', () => {
    const d = deriveCanonicalProduct('Nothing Phone 2 5G 256 GB', { ramGB: 12 });
    expect(d!.model).toBe('2');
    expect(d!.storage).toBe(256);
    expect(d!.ram).toBe(12);
  });
});