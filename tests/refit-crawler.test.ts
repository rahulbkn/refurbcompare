import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isRefitPhone, parseRefitProduct, type ShopifyProduct } from '@refurbcompare/ingestion';

const FIXTURE = resolve(__dirname, '../services/ingestion/test/fixtures/refit-products.json');

function products(): ShopifyProduct[] {
  return (JSON.parse(readFileSync(FIXTURE, 'utf8')) as { products: ShopifyProduct[] }).products;
}

describe('refit connector parser', () => {
  it('keeps refurbished phones and drops laptops/accessories', () => {
    const ps = products();
    const phone = ps.find((p) => p.handle.includes('samsung-galaxy-s21'))!;
    const laptop = ps.find((p) => p.handle.includes('dell-latitude'))!;
    expect(isRefitPhone(phone)).toBe(true);
    expect(isRefitPhone(laptop)).toBe(false);
  });

  it('parses purchaseable variants into offers with real prices', () => {
    const items = parseRefitProduct(products().find((p) => p.handle.includes('samsung-galaxy-s21'))!);
    expect(items).toHaveLength(1);
    expect(items[0]!.price).toBe(19149);
    expect(items[0]!.sourceProductId).toContain('RF-S21-FE-128');
    expect(items[0]!.url).toBe('https://refitglobal.com/products/samsung-galaxy-s21-fe-5g-refurbished-brand-box');
    expect(items[0]!.condition).toMatch(/refurbished/i);
    expect(items[0]!.currency).toBe('INR');
  });

  it('derives device storage from the variant title', () => {
    const items = parseRefitProduct(products().find((p) => p.handle.includes('google-pixel-7a'))!);
    expect(items[0]!.storageGB).toBe(128);
  });

  it('propagates the Shopify product image to every offer', () => {
    const items = parseRefitProduct(products().find((p) => p.handle.includes('samsung-galaxy-s21'))!);
    expect(items[0]!.imageUrl).toBe(
      'https://cdn.shopify.com/s/files/1/0606/9204/3823/products/s21fe.jpg?v=1690000000',
    );
  });

  it('leaves imageUrl null when the feed has no images', () => {
    const items = parseRefitProduct(products().find((p) => p.handle.includes('google-pixel-7a'))!);
    expect(items[0]!.imageUrl).toBeNull();
  });

  it('skips zero-price and sold-out variants (keeps only live offer on multi-variant products)', () => {
    const items = parseRefitProduct(products().find((p) => p.handle.includes('apple-iphone-13'))!);
    expect(items).toHaveLength(1);
    expect(items[0]!.price).toBe(36499);
  });
});