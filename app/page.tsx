import Link from "next/link";
import { getRepository } from "@/lib/repo";
import { buildPageMeta } from "@/lib/seo";
import ProductGrid from "@/components/product-grid";
import TrustSection from "@/components/trust-section";
import DataFreshness from "@/components/data-freshness";
import { ArrowRight, TrendingDown } from "lucide-react";
import { formatINR } from "@/lib/format";
import { DEMO_MODE } from "@/lib/seo";

export const metadata = buildPageMeta({
  title: "Compare Refurbished Smartphone Prices in India",
  canonicalPath: "/",
  description:
    "RefurbMeter compares refurbished smartphone offers from third-party sellers across India. Independent comparison — we never sell devices ourselves.",
});

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repo = await getRepository();

  const [products, deals, brands] = await Promise.all([
    repo.listProducts({ sort: "price_asc", limit: 8 }),
    repo.listDeals(4),
    repo.brandCounts(),
  ]);

  return (
    <div className="space-y-14 py-10">
      {/* Hero */}
      <section className="container">
        <div className="rounded-3xl bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-900)] px-6 py-12 text-white sm:px-12 sm:py-16">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            <TrendingDown size={14} /> Independent price comparison
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Compare refurbished phone prices across India&apos;s best sellers
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
            See every refurbished iPhone, Galaxy, Pixel and Redmi offer in one
            place, find the cheapest price, and buy directly from the seller.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/phones"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[var(--color-brand-800)] transition-colors hover:bg-white/90"
            >
              Browse all phones <ArrowRight size={16} />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex h-11 items-center rounded-xl border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Brand shortcuts */}
      {brands.length > 0 && (
        <section className="container">
          <div className="flex flex-wrap gap-2">
            {brands.map(({ brand, count }) => (
              <Link
                key={brand}
                href={`/phones?brand=${encodeURIComponent(brand)}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm hover:border-[var(--color-brand-500)]"
              >
                {brand} <span className="text-[var(--text-muted)]">({count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="container">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Popular refurbished phones</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {DEMO_MODE ? "Sample catalogue" : "Current offers across sellers"}
            </p>
          </div>
          <Link
            href="/phones"
            className="text-sm font-semibold text-[var(--color-brand-700)] dark:text-brand-300 hover:underline"
          >
            View all
          </Link>
        </div>
        <ProductGrid products={products} />
      </section>

      {/* Deals */}
      {deals.length > 0 && (
        <section className="container">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold">Best discounts right now</h2>
            <Link
              href="/deals"
              className="text-sm font-semibold text-[var(--color-brand-700)] dark:text-brand-300 hover:underline"
            >
              All deals
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                href={deal.product ? `/phones/${deal.product.slug}` : "/deals"}
                className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-semibold">{deal.product?.name ?? deal.seller?.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    via {deal.seller?.name} · {deal.condition}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatINR(deal.price)}</p>
                  {deal.discountPct ? (
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                      -{Math.round(deal.discountPct)}%
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <DataFreshness />
          </div>
        </section>
      )}

      {/* Trust */}
      <section className="container">
        <TrustSection />
      </section>
    </div>
  );
}