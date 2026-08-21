import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProductImage from '../components/product-image';
import ProductCard from '../components/product-card';
import type { ProductDto } from '../lib/repo/types';

const IMG = 'https://cdn.shopify.com/s/files/1/0606/9204/3823/products/s21fe.jpg';

function product(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 'prod_1',
    slug: 'samsung-galaxy-s21-fe',
    name: 'Samsung Galaxy S21 FE',
    brand: 'Samsung',
    model: 'Galaxy S21 FE',
    modelNumber: null,
    variant: null,
    storage: 128,
    ram: 8,
    color: null,
    network: null,
    condition: 'Refurbished',
    releaseYear: 2021,
    imageUrl: null,
    attributes: null,
    ...overrides,
  } as ProductDto;
}

describe('ProductImage component', () => {
  it('renders the product image when a URL is present', () => {
    const html = renderToStaticMarkup(<ProductImage src={IMG} alt="S21 FE" />);
    expect(html).toContain(`src="${IMG}"`);
    expect(html).toContain('alt="S21 FE"');
  });

  it('renders a generic placeholder (no img) when the URL is missing', () => {
    const html = renderToStaticMarkup(<ProductImage src={null} alt="S21 FE" />);
    expect(html).not.toContain('<img');
    expect(html).toContain('<svg');
  });

  it('placeholder is generic — never another product’s image', () => {
    const html = renderToStaticMarkup(<ProductImage src={null} alt="Pixel 7a" />);
    expect(html).not.toContain('http');
    expect(html).not.toContain('.jpg');
  });
});

describe('ProductCard image handling', () => {
  it('shows the card image from the product DTO', () => {
    const html = renderToStaticMarkup(
      <ProductCard product={{ ...product(), imageUrl: IMG, bestPrice: 22849 }} />,
    );
    expect(html).toContain(`src="${IMG}"`);
  });

  it('falls back to the generic glyph when no image exists', () => {
    const html = renderToStaticMarkup(
      <ProductCard product={{ ...product(), bestPrice: 22849 }} />,
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('<svg');
  });
});
