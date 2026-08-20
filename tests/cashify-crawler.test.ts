import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCashifyProductPage } from '@refurbcompare/ingestion';
import { matchProducts } from '@refurbcompare/core';

const FIXTURE = resolve(__dirname, '../services/ingestion/test/fixtures/cashify-iphone-13-pro.html');

describe('cashify crawler parser', () => {
  it('extracts provider products from a ProductGroup page', () => {
    const html = readFileSync(FIXTURE, 'utf8');
    const pageUrl = 'https://www.cashify.in/buy-refurbished-mobile-phones/renewed-apple-iphone-13-pro';
    const items = parseCashifyProductPage(html, pageUrl);
    expect(items.length).toBeGreaterThan(10);
    expect(items.length).toBeLessThanOrEqual(120);

    const first = items[0]!;
    expect(first.sourceProductId).toBeTruthy();
    expect(first.title).toContain('Apple iPhone 13 Pro');
    expect(first.price).toBeGreaterThan(0);
    expect(first.currency).toBe('INR');
    expect(first.condition).toMatch(/refurbished/i);
    expect(first.url).toContain(pageUrl);
    expect(first.url).toContain('variant=');
    expect(first.warrantyMonths).toBe(6);
    expect(first.stockStatus).toBe('IN_STOCK');
  });

  it('parses storage/ram/color from the variant spec line', () => {
    const html = readFileSync(FIXTURE, 'utf8');
    const items = parseCashifyProductPage(html, 'https://www.cashify.in/buy-refurbished-mobile-phones/renewed-apple-iphone-13-pro');
    const withSpec = items.find((i) => i.storageGB != null && i.color != null);
    expect(withSpec).toBeTruthy();
    expect(withSpec!.storageGB).toBeGreaterThan(50);
    expect(withSpec!.ramGB).toBeGreaterThan(0);
    expect(withSpec!.title).toContain(`${withSpec!.storageGB} GB`);
  });

  it('emits titles that match the canonical catalog', () => {
    const html = readFileSync(FIXTURE, 'utf8');
    const items = parseCashifyProductPage(html, 'https://www.cashify.in/buy-refurbished-mobile-phones/renewed-apple-iphone-13-pro');
    const candidates = [{ id: 'p_iphone13', brand: 'Apple', model: 'iPhone 13', modelNumber: 'A2633', storage: 128, ram: 4, color: 'Midnight', variant: null }];
    const matched = items
      .map((i) => ({ item: i, match: matchProducts(candidates, i.title) }))
      .filter((x) => x.match && x.match.confidence >= 0.45);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched[0]!.match!.product.id).toBe('p_iphone13');
  });

  it('returns no items for unrelated HTML', () => {
    expect(parseCashifyProductPage('<html><body>hello</body></html>', 'https://www.cashify.in/x').length).toBe(0);
  });
});