import { describe, it, expect, vi } from 'vitest';
import { processItem, type SyncRunContext } from '@refurbcompare/ingestion';
import { deriveCanonicalProduct, stableId } from '@refurbcompare/core';
import type { ProviderProduct, Repository } from '@refurbcompare/core';

const IMAGE_A = 'https://cdn.shopify.com/s/files/1/0606/9204/3823/products/s21fe.jpg';
const IMAGE_B = 'https://cdn2.zohoecommerce.com/product-images/s21fe/123.jpg';

type SyncRow = {
  id: string;
  brand: string;
  model: string;
  modelNumber: string | null;
  storage: number | null;
  ram: number | null;
  color: string | null;
  variant: string | null;
  imageUrl: string | null;
};

function syncRow(overrides: Partial<SyncRow> = {}): SyncRow {
  return {
    id: 'prod_existing',
    brand: 'Samsung',
    model: 'Galaxy S21 FE',
    modelNumber: 'SM-G990E',
    storage: 128,
    ram: 8,
    color: null,
    variant: null,
    imageUrl: null,
    ...overrides,
  };
}

function item(overrides: Partial<ProviderProduct> = {}): ProviderProduct {
  return {
    sourceProductId: 'src-1',
    title: 'Samsung Galaxy S21 FE 5G 128GB',
    brand: 'Samsung',
    modelNumber: null,
    storageGB: 128,
    ramGB: null,
    color: null,
    variant: null,
    price: 20000,
    currency: 'INR',
    condition: 'Refurbished',
    warrantyMonths: 6,
    returnDays: 7,
    stockStatus: 'IN_STOCK',
    url: 'https://example.com/p/1',
    imageUrl: IMAGE_A,
    sellerName: 'Test Seller',
    availability: null,
    lastUpdated: new Date(),
    extra: {},
    ...overrides,
  };
}

function fakeCtx(productsForSync: SyncRow[]) {
  const updated: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const upserted: Array<Record<string, unknown>> = [];

  const repo = {
    listProductsForSync: async () => productsForSync,
    updateProduct: async (id: string, patch: Record<string, unknown>) => {
      updated.push({ id, patch });
      const row = productsForSync.find((p) => p.id === id);
      if (row && typeof patch.imageUrl === 'string') row.imageUrl = patch.imageUrl;
      return row ?? null;
    },
    upsertProduct: async (input: Record<string, unknown>) => {
      upserted.push(input);
      return input as unknown as SyncRow;
    },
    upsertListing: async () => ({ status: 'added' }),
  } as unknown as Repository;

  const ctx: SyncRunContext = {
    repo,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    config: { dataMode: 'live' } as never,
  };
  const connector = { slug: 'test', name: 'Test' } as never;

  return { ctx, connector, updated, upserted };
}

async function run(ctx: SyncRunContext, connector: never, cache: SyncRow[], it: ProviderProduct) {
  const counts = { seen: 1, added: 0, updated: 0, skipped: 0, failed: 0 };
  await processItem(ctx, connector, 'prov_1', cache as never, it, counts);
  return counts;
}

describe('pipeline image propagation', () => {
  it('backfills a matched product that has no image yet', async () => {
    const row = syncRow();
    const { ctx, connector, updated } = fakeCtx([row]);
    await run(ctx, connector, [row], item());

    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual({ id: 'prod_existing', patch: { imageUrl: IMAGE_A } });
    expect(row.imageUrl).toBe(IMAGE_A);
  });

  it('backfills an existing derived product reached via slug (previously imageless)', async () => {
    const derivedItem = item({
      sourceProductId: 'src-2',
      title: 'Nothing Phone 2 256GB',
      brand: 'Nothing',
      modelNumber: null,
      storageGB: 256,
    });
    const derived = deriveCanonicalProduct(derivedItem.title, { storageGB: 256 })!;
    const row = syncRow({ id: stableId('prod', derived.slug), brand: 'Nothing', model: 'Phone 2' });
    const { ctx, connector, updated } = fakeCtx([row]);

    await run(ctx, connector, [row], derivedItem);

    expect(updated).toHaveLength(1);
    expect(updated[0]!.id).toBe(row.id);
    expect(updated[0]!.patch).toEqual({ imageUrl: IMAGE_A });
    expect(row.imageUrl).toBe(IMAGE_A);
  });

  it('never overwrites an existing valid image', async () => {
    const row = syncRow({ imageUrl: IMAGE_B });
    const { ctx, connector, updated } = fakeCtx([row]);
    await run(ctx, connector, [row], item({ imageUrl: IMAGE_A }));

    expect(updated).toHaveLength(0);
    expect(row.imageUrl).toBe(IMAGE_B);
  });

  it('does nothing when the item carries no image', async () => {
    const row = syncRow();
    const { ctx, connector, updated } = fakeCtx([row]);
    await run(ctx, connector, [row], item({ imageUrl: null }));

    expect(updated).toHaveLength(0);
    expect(row.imageUrl).toBeNull();
  });

  it('sets the image at creation time for a brand-new derived product', async () => {
    const { ctx, connector, upserted } = fakeCtx([]);
    await run(ctx, connector, [], item({ title: 'Google Pixel 7a 128GB', brand: 'Google', storageGB: 128 }));

    expect(upserted).toHaveLength(1);
    expect(upserted[0]!.imageUrl).toBe(IMAGE_A);
    expect(upserted[0]!.images).toEqual([IMAGE_A]);
  });
});

describe('pipeline image repair', () => {
  it('replaces a known-broken Zoho URL with the sized variant', async () => {
    const broken = 'https://cdn2.zohoecommerce.com/product-images/IMG_2857.jpg/293890000079297558';
    const fixed = 'https://cdn2.zohoecommerce.com/product-images/IMG_2857.jpg/293890000079297558/400x400?storefront_domain=www.sahivalue.com';
    const row = syncRow({ imageUrl: broken });
    const { ctx, connector, updated } = fakeCtx([row]);
    await run(ctx, connector, [row], item({ imageUrl: fixed }));

    expect(updated).toHaveLength(1);
    expect(updated[0]!.patch).toEqual({ imageUrl: fixed });
    expect(row.imageUrl).toBe(fixed);
  });

  it('still refuses to overwrite valid images with other valid images', async () => {
    const row = syncRow({ imageUrl: IMAGE_B });
    const { ctx, connector, updated } = fakeCtx([row]);
    await run(ctx, connector, [row], item({ imageUrl: IMAGE_A }));
    expect(updated).toHaveLength(0);
  });
});
