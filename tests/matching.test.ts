import { describe, it, expect } from 'vitest';
import { parseTitle, matchProducts, canonicalizeBrand, MIN_MATCH_CONFIDENCE, deriveCanonicalProduct } from '@refurbcompare/core';
import type { MatchableProduct } from '@refurbcompare/core';

const CANDIDATES: MatchableProduct[] = [
  {
    id: 'prod_apple-13-128gb',
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
    // Capacity fragments are consumed by parsing and must not leak into `rest`.
    expect(parsed.rest).not.toContain('128GB');
    expect(parsed.rest).toContain('Certified');
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
    expect(parsed.rest).toBe('Phone');
  });
});

describe('parseTitle RAM-vs-storage separation', () => {
  it('labeled RAM + labeled storage ("8GB RAM + 128GB Storage")', () => {
    const parsed = parseTitle('Samsung Galaxy S21 FE 5G (8GB RAM + 128GB Storage)', ['Samsung']);
    expect(parsed.ram).toBe(8);
    expect(parsed.storage).toBe(128);
  });

  it('labeled RAM + labeled storage without separators ("12GB RAM 256GB Storage")', () => {
    const parsed = parseTitle('Nothing Phone (2) 12GB RAM 256GB Storage', ['Nothing']);
    expect(parsed.ram).toBe(12);
    expect(parsed.storage).toBe(256);
  });

  it('plus-separated pair ("12+256GB")', () => {
    const parsed = parseTitle('OnePlus Nord 2T 5G 12+256GB', ['OnePlus']);
    expect(parsed.ram).toBe(12);
    expect(parsed.storage).toBe(256);
  });

  it('slash-separated bare pair ("8/256")', () => {
    const parsed = parseTitle('Redmi Note 12 5G 8/256', ['Xiaomi']);
    expect(parsed.ram).toBe(8);
    expect(parsed.storage).toBe(256);
  });

  it('slash-separated units on both sides ("8GB/256GB")', () => {
    const parsed = parseTitle('Vivo V25 5G 8GB/256GB', ['Vivo']);
    expect(parsed.ram).toBe(8);
    expect(parsed.storage).toBe(256);
  });

  it('bare space-separated pair ("8GB 128GB")', () => {
    const parsed = parseTitle('Google Pixel 7a 5G 8GB 128GB', ['Google']);
    expect(parsed.ram).toBe(8);
    expect(parsed.storage).toBe(128);
  });

  it('comma-separated pair ("4GB, 64GB")', () => {
    const parsed = parseTitle('Redmi 12C 4GB, 64GB Mint Green', ['Xiaomi']);
    expect(parsed.ram).toBe(4);
    expect(parsed.storage).toBe(64);
  });

  it('reversed order ("256GB 16GB RAM")', () => {
    const parsed = parseTitle('ASUS ROG Phone 6 5G 256GB 16GB RAM', ['Asus']);
    expect(parsed.ram).toBe(16);
    expect(parsed.storage).toBe(256);
  });

  it('standalone storage token keeps ram null', () => {
    const parsed = parseTitle('Apple iPhone 13 128GB Midnight', ['Apple']);
    expect(parsed.storage).toBe(128);
    expect(parsed.ram).toBeNull();
  });

  it('never treats RAM as storage when only RAM is stated', () => {
    const parsed = parseTitle('Samsung Galaxy S22 5G 8GB RAM', ['Samsung']);
    expect(parsed.ram).toBe(8);
    expect(parsed.storage).toBeNull();
  });

  it('parses fused capacity tokens ("464GB" = 4GB RAM + 64GB)', () => {
    const parsed = parseTitle('Moto G32 464GB Satin Silver', ['Motorola']);
    expect(parsed.ram).toBe(4);
    expect(parsed.storage).toBe(64);
  });

  it('does not mistake 5G network markers for RAM', () => {
    const parsed = parseTitle('Samsung Galaxy A54 5G 128GB Awesome Lime', ['Samsung']);
    expect(parsed.ram).toBeNull();
    expect(parsed.storage).toBe(128);
  });

  it('ROM label counts as storage even below 32GB', () => {
    const parsed = parseTitle('itel A60s 4GB RAM 128GB ROM', ['itel']);
    expect(parsed.ram).toBe(4);
    expect(parsed.storage).toBe(128);
  });
});

describe('matchProducts', () => {
  it('returns an exact model-number match with high confidence', () => {
    const match = matchProducts(CANDIDATES, 'Apple iPhone 13 A2633 128GB Midnight');
    expect(match).not.toBeNull();
    expect(match?.product.id).toBe('prod_apple-13-128gb');
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
    expect(iphone?.product.id).toBe('prod_apple-13-128gb');
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
    expect(d!.ram).toBe(8);
    expect(d!.slug).toBe('samsung-s21-fe-128gb-8gb-ram');
  });

  it('keeps the Pixel model line in derived Google product names', () => {
    const d = deriveCanonicalProduct('Google Pixel 10 Pro 16/256GB Obsidian');
    expect(d).not.toBeNull();
    expect(d!.brand).toBe('Google');
    expect(d!.model).toContain('Pixel');
    expect(d!.model).not.toMatch(/\d{4,}gb/i);
    expect(d!.variant).toBe('PRO');
    expect(d!.slug).toBe('google-pixel-10-pro-256gb-16gb-ram');
  });

  it('normalizes plus-separated and pre-concatenated capacity tokens', () => {
    const plus = deriveCanonicalProduct('Vivo X9s 5G 12+256GB');
    expect(plus!.model).toBe('X9s');
    expect(plus!.slug).toBe('vivo-x9s-256gb-12gb-ram');

    const fused = deriveCanonicalProduct('Oppo X9s 8gb128gb');
    expect(fused!.model).toBe('X9s');
    expect(fused!.model).not.toMatch(/gb/i);
    expect(fused!.slug).toBe('oppo-x9s-128gb-8gb-ram');

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

  it('separates Nothing Phone (2) 256GB from 512GB despite identical RAM', () => {
    const d256 = deriveCanonicalProduct('Nothing Phone (2) 5G 12GB + 256GB');
    const d512 = deriveCanonicalProduct('Nothing Phone (2) 5G 12GB + 512GB');
    expect(d256).not.toBeNull();
    expect(d512).not.toBeNull();
    expect(d256!.slug).toBe('nothing-2-256gb-12gb-ram');
    expect(d512!.slug).toBe('nothing-2-512gb-12gb-ram');
    expect(d256!.slug).not.toBe(d512!.slug);
  });

  it('separates iQOO Z6 RAM variants sharing 128GB storage', () => {
    const d8 = deriveCanonicalProduct('iQOO Z6 5G (8GB RAM + 128GB Storage)');
    const d6 = deriveCanonicalProduct('iQOO Z6 5G (6GB RAM + 128GB Storage)');
    const d4 = deriveCanonicalProduct('iQOO Z6 5G (4GB RAM + 128GB Storage)');
    expect(d8!.slug).toBe('iqoo-z6-128gb-8gb-ram');
    expect(d6!.slug).toBe('iqoo-z6-128gb-6gb-ram');
    expect(d4!.slug).toBe('iqoo-z6-128gb-4gb-ram');
    expect(new Set([d8!.slug, d6!.slug, d4!.slug]).size).toBe(3);
  });

  it('separates Xiaomi 14C RAM variants', () => {
    const d4 = deriveCanonicalProduct('Xiaomi 14C 4GB 128GB');
    const d6 = deriveCanonicalProduct('Xiaomi 14C 6GB 128GB');
    expect(d4!.slug).toBe('xiaomi-14c-128gb-4gb-ram');
    expect(d6!.slug).toBe('xiaomi-14c-128gb-6gb-ram');
    expect(d4!.slug).not.toBe(d6!.slug);
  });

  it('omits the RAM segment when no RAM is stated (legacy slug shape preserved)', () => {
    const d = deriveCanonicalProduct('Apple iPhone 13 128GB Midnight');
    expect(d!.slug).toBe('apple-13-128gb');
  });

  it('preserves PRO / PRO MAX / PLUS / FE / MINI / ULTRA tiers alongside correct capacities', () => {
    const cases: Array<[string, string]> = [
      ['Apple iPhone 14 Pro Max 256GB', 'apple-14-pro-max-256gb'],
      ['Samsung Galaxy S21 FE 5G 8GB RAM 128GB', 'samsung-s21-fe-128gb-8gb-ram'],
      ['OnePlus 11 Pro Max 16GB+512GB', 'oneplus-11-pro-max-512gb-16gb-ram'],
      ['Xiaomi 13 Ultra 5G 12GB 512GB', 'xiaomi-13-ultra-512gb-12gb-ram'],
      ['Apple iPhone 13 Mini 128GB', 'apple-13-mini-128gb'],
    ];
    for (const [title, slug] of cases) {
      const d = deriveCanonicalProduct(title);
      expect(d, title).not.toBeNull();
      expect(d!.slug, title).toBe(slug);
    }
  });
});

describe('matchProducts RAM variant awareness', () => {
  const Z6_VARIANTS: MatchableProduct[] = [
    {
      id: 'prod_iqoo-z6-128gb-6gb-ram',
      brand: 'iQOO',
      model: 'Z6',
      modelNumber: null,
      storage: 128,
      ram: 6,
      color: null,
      variant: null,
    },
    {
      id: 'prod_iqoo-z6-128gb-8gb-ram',
      brand: 'iQOO',
      model: 'Z6',
      modelNumber: null,
      storage: 128,
      ram: 8,
      color: null,
      variant: null,
    },
  ];

  it('routes an 8GB-RAM title to the 8GB product, never the 6GB one', () => {
    const m = matchProducts(Z6_VARIANTS, 'iQOO Z6 5G (8GB RAM + 128GB Storage)');
    expect(m).not.toBeNull();
    expect(m!.product.id).toBe('prod_iqoo-z6-128gb-8gb-ram');
  });

  it('refuses to attach a stated-RAM title to a conflicting-RAM-only catalog', () => {
    const m = matchProducts([Z6_VARIANTS[0]], 'iQOO Z6 5G (8GB RAM + 128GB Storage)');
    expect(m).toBeNull();
  });

  it('keeps legacy rows (unknown RAM) matchable for titles that state RAM', () => {
    const legacy: MatchableProduct = { ...Z6_VARIANTS[0], id: 'prod_legacy', ram: null };
    const m = matchProducts([legacy], 'iQOO Z6 5G (8GB RAM + 128GB Storage)');
    expect(m).not.toBeNull();
    expect(m!.product.id).toBe('prod_legacy');
  });
});