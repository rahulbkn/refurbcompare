import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractZohoCategory, parseSahiValueCategory } from '@refurbcompare/ingestion';

const FIXTURE = resolve(__dirname, '../services/ingestion/test/fixtures/sahivalue-category.html');

describe('sahivalue connector parser', () => {
  it('extracts the embedded zs_category product grid', () => {
    const html = readFileSync(FIXTURE, 'utf8');
    const category = extractZohoCategory(html);
    expect(category?.name).toBe('Apple iPhone');
    expect(category?.products).toHaveLength(3);
  });

  it('turns purchaseable refurbished SKUs into offers, excluding new-seal and out-of-stock', () => {
    const html = readFileSync(FIXTURE, 'utf8');
    const items = parseSahiValueCategory(extractZohoCategory(html)!);
    expect(items).toHaveLength(1);

    const item = items[0]!;
    expect(item.title).toBe('Apple iPhone 13 Pro 512GB');
    expect(item.price).toBe(33999);
    expect(item.storageGB).toBe(512);
    expect(item.color).toBe('Graphite');
    expect(item.condition).toBe('Refurbished - Good');
    expect(item.sourceProductId).toBe('zoho-SV-IP13P-512');
    expect(item.currency).toBe('INR');
  });
});