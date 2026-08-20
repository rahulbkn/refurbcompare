import type { Metadata } from "next";
import Link from "next/link";
import { getRepository } from "@/lib/repo";
import { buildPageMeta } from "@/lib/seo";
import { formatINR } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import type { ProductDto } from "@/lib/repo/types";

export const metadata: Metadata = buildPageMeta({
  title: "Price History",
  canonicalPath: "/price-history",
  description:
    "Track refurbished smartphone price trends across India's third-party sellers over the last 45 days.",
});

export const dynamic = "force-dynamic";

export default async function PriceHistoryIndexPage() {
  const repo = await getRepository();
  const products = (await repo.listProducts({
    sort: "price_asc",
    limit: 60,
  })) as Array<ProductDto & { bestPrice?: number }>;

  return (
    <div className="container space-y-6 py-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <TrendingUp size={22} className="text-[var(--color-brand-600)]" />
          Price history
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          See how refurbished prices moved over the last 45 days, per seller.
          Pick a phone to open its chart.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/price-history/${product.slug}`}
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-shadow hover:shadow-md"
          >
            <div>
              <p className="font-semibold">{product.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {product.storage} GB · {product.condition}
              </p>
            </div>
            {product.bestPrice !== undefined && (
              <p className="font-bold">{formatINR(product.bestPrice)}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}