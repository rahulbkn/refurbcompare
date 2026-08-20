import { describe, it, expect } from 'vitest';
import { parseTitle, matchProducts, canonicalizeBrand, MIN_MATCH_CONFIDENCE } from '@refurbcompare/core';
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