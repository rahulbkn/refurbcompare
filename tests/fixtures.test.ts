import { describe, it, expect } from 'vitest';
import {
  buildDemoProviderProducts,
  DEMO_PRODUCTS,
  DEMO_PROVIDERS,
  TEST_FIXTURE_VARIANTS,
  TEST_FIXTURE_UPDATED_AT,
} from '@refurbcompare/db';

const SLUG_ORDER = DEMO_PROVIDERS.map((p) => p.slug);

describe('TEST provider fixtures (demo-mode connections)', () => {
  it('pins the reference iPhone 13 128GB ladder Cashify 26,799 → MobileGoo 28,499', () => {
    const prices = SLUG_ORDER.map(
      (slug) => buildDemoProviderProducts(slug).find((p) => p.brand === 'Apple' && p.model === 'iPhone 13' && p.storageGB === 128)!.price,
    );
    expect(prices).toEqual([26799, 27199, 27599, 27999, 28499]);
  });

  it('serves every fixture variant for every provider with a monotonic ladder', () => {
    for (const variant of TEST_FIXTURE_VARIANTS) {
      for (const slug of SLUG_ORDER) {
        const item = buildDemoProviderProducts(slug).find(
          (p) => p.brand === variant.brand && p.model === variant.model && p.storageGB === variant.storage,
        );
        expect(item).toBeDefined();
        expect(item!.price).toBe(variant.prices[slug]);
      }
      const ladder = SLUG_ORDER.map((slug) => variant.prices[slug]);
      for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!);
    }
  });

  it('marks every demo row TEST (source id suffix, test host, timestamp)', () => {
    for (const slug of SLUG_ORDER) {
      for (const item of buildDemoProviderProducts(slug)) {
        expect(item.sourceProductId.startsWith('demo-')).toBe(true);
        expect(item.sourceProductId.endsWith('-test')).toBe(true);
        expect(item.url).toMatch(new RegExp(`^https://test-${slug}\\.refurbcompare\\.in/`));
        expect(item.lastUpdated).toBeInstanceOf(Date);
        expect((item.lastUpdated as Date).toISOString()).toBe(TEST_FIXTURE_UPDATED_AT);
        expect(item.extra).toMatchObject({ testData: true });
      }
    }
  });

  it('yields exactly one TEST listing per provider for every canonical product', () => {
    for (const product of DEMO_PRODUCTS) {
      for (const slug of SLUG_ORDER) {
        const match = buildDemoProviderProducts(slug).filter(
          (p) => p.brand === product.brand && p.model === product.model && p.storageGB === product.storage,
        );
        expect(match).toHaveLength(1);
      }
    }
  });
});