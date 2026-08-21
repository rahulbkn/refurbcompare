import Link from "next/link";
import type { ProductDto } from "@/lib/repo/types";
import { formatINR } from "@/lib/format";
import ProductImage from "@/components/product-image";

export type ProductCardProduct = ProductDto & { bestPrice?: number | null };

export default function ProductCard({ product }: { product: ProductCardProduct }) {
  const bestPrice = product.bestPrice;

  return (
    <Link
      href={`/phones/${product.slug}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-3 h-36 overflow-hidden rounded-xl bg-[var(--surface-2)]">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="transition-transform group-hover:scale-105"
        />
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-700)] dark:text-brand-300">
        {product.brand}
      </p>
      <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{product.name}</h3>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-muted)]">
        {product.storage > 0 && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            {product.storage} GB
          </span>
        )}
        {product.ram && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            {product.ram} GB RAM
          </span>
        )}
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
          {product.condition}
        </span>
      </div>

      <div className="mt-auto pt-4">
        {bestPrice !== undefined && bestPrice !== null ? (
          <p className="text-xl font-bold">
            {formatINR(bestPrice)}
            <span className="ml-1 text-xs font-medium text-[var(--text-muted)]">from</span>
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Check price</p>
        )}
      </div>
    </Link>
  );
}
