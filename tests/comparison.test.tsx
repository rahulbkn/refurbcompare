import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildComparisonGroups } from '../lib/comparison';
import type { ListingDto } from '../lib/repo/types';

function listing(overrides: Partial<ListingDto> & { id: string }): ListingDto {
  return {
    productId: 'prod_1',
    sellerId: 'seller_' + overrides.id,
    targetUrl: 'https://seller.example/x',
    price: 20000,
    originalPrice: null,
    discountPct: null,
    condition: 'Refurbished',
    storage: null,
    inStock: true,
    stockStatus: 'in_stock',
    sellerRating: null,
    offerBadge: null,
    isDemo: false,
    fetchedAt: new Date().toISOString(),
    seller: {
      id: 'seller_1',
      slug: 'seller-1',
      name: 'Cashify',
      websiteUrl: null,
      logoUrl: null,
      tagline: null,
      rating: null,
      reviewCount: 0,
      supportsAffiliate: false,
      allowRedirects: true,
    },
    ...overrides,
  } as ListingDto;
}

describe('buildComparisonGroups', () => {
  it('one row = one condition, cheapest live in-stock listing per seller', () => {
    const listings = [
      listing({ id: 'l_cash_hi', price: 21299, condition: 'Refurbished', seller: { ...listing({ id: 'x' }).seller!, name: 'ReFit' } }),
      listing({ id: 'l_cash_lo', price: 19899, condition: 'Refurbished' }),
      listing({ id: 'l_sahi', price: 22099, condition: 'Refurbished', seller: { ...listing({ id: 'x' }).seller!, name: 'SahiValue' } }),
    ];
    const { groups, sellers } = buildComparisonGroups(listings);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.condition).toBe('Refurbished');
    expect(sellers).toEqual(['ReFit', 'Cashify', 'SahiValue']);
    const cashify = groups[0]!.offers.find((o) => o.sellerName === 'Cashify');
    expect(cashify!.listingId).toBe('l_cash_lo');
    expect(cashify!.price).toBe(19899);
    expect(groups[0]!.best!.listingId).toBe('l_cash_lo');
  });

  it('keeps conditions separate — never merges Good with Superb', () => {
    const listings = [
      listing({ id: 'l_good', price: 18000, condition: 'Good' }),
      listing({ id: 'l_superb', price: 21000, condition: 'Superb' }),
    ];
    const { groups } = buildComparisonGroups(listings);
    expect(groups.map((g) => g.condition).sort()).toEqual(['Good', 'Superb']);
  });

  it('excludes out-of-stock listings from offers', () => {
    const listings = [
      listing({ id: 'l_in', price: 19000 }),
      listing({ id: 'l_out', price: 15000, inStock: false, stockStatus: 'out' }),
    ];
    const { groups } = buildComparisonGroups(listings);
    expect(groups[0]!.offers).toHaveLength(1);
    expect(groups[0]!.offers[0]!.listingId).toBe('l_in');
  });

  it('sorts rows by best price ascending', () => {
    const listings = [
      listing({ id: 'l_exp', price: 30000, condition: 'Superb' }),
      listing({ id: 'l_cheap', price: 15000, condition: 'Fair' }),
    ];
    const { groups } = buildComparisonGroups(listings);
    expect(groups[0]!.condition).toBe('Fair');
    expect(groups[1]!.condition).toBe('Superb');
  });

  it('returns empty groups when nothing is in stock', () => {
    const { groups } = buildComparisonGroups([listing({ id: 'l_out', inStock: false, stockStatus: 'out' })]);
    expect(groups).toHaveLength(0);
  });
});

describe('SellerComparisonTable rendering', () => {
  it('renders the grouped table with a dash for absent sellers', async () => {
    const { default: SellerComparisonTable } = await import('../components/seller-comparison-table');
    const listings = [
      listing({ id: 'l_a', price: 19899 }),
      listing({ id: 'l_b', price: 22099, condition: 'Superb', seller: { ...listing({ id: 'x' }).seller!, name: 'SahiValue' } }),
    ];
    const html = renderToStaticMarkup(
      <SellerComparisonTable listings={listings} productName="Pixel 7A" />,
    );
    expect(html).toContain('Refurbished');
    expect(html).toContain('Superb');
    expect(html).toContain('₹19,899');
    expect(html).toContain('₹22,099');
    // Buy link preserves the exact listing id of the row's best offer
    expect(html).toContain('/go/l_a');
  });

  it('shows an empty state when there are no live offers', async () => {
    const { default: SellerComparisonTable } = await import('../components/seller-comparison-table');
    const html = renderToStaticMarkup(
      <SellerComparisonTable
        listings={[listing({ id: 'l_out', inStock: false, stockStatus: 'out' })]}
        productName="Pixel 7A"
      />,
    );
    expect(html).toContain('No live offers');
  });
});
