import type { Metadata } from "next";
import { getRepository } from "@/lib/repo";
import { buildPageMeta } from "@/lib/seo";
import { formatINR } from "@/lib/format";
import Link from "next/link";
import { Tag } from "lucide-react";
import DataFreshness from "@/components/data-freshness";

export const metadata: Metadata = buildPageMeta({
  title: "Best Refurbished Phone Deals",
  canonicalPath: "/deals",
  description:
    "The biggest discounts on refurbished smartphones across India's third-party sellers, ranked by cash savings.",
});

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const repo = await getRepository();
  const deals = await repo.listDeals(30);

  const cheapestDeal = deals.length ? Math.min(...deals.map((d) => d.price)) : null;

  return (
    <div className="container space-y-6 py-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Tag size={22} className="text-[var(--color-brand-600)]" />
          Best refurbished phone deals
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {deals.length} discounted offer{deals.length === 1 ? "" : "s"} right now
          {cheapestDeal ? `, cheapest at ${formatINR(cheapestDeal)}` : ""}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal, index) => (
          <div
            key={deal.id}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[var(--color-brand-100)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-brand-700)] dark:bg-brand-900 dark:text-brand-200">
                Deals #{index + 1}
              </span>
              {deal.discountPct ? (
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  -{Math.round(deal.discountPct)}%
                </span>
              ) : null}
            </div>

            {deal.product && (
              <Link href={`/phones/${deal.product.slug}`}>
                <h2 className="font-semibold hover:underline">
                  {deal.product.name}
                </h2>
              </Link>
            )}

            <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--text-muted)]">
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                {deal.seller?.name ?? "Seller"}
              </span>
              {deal.condition && (
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                  {deal.condition}
                </span>
              )}
              {deal.offerBadge && (
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                  {deal.offerBadge}
                </span>
              )}
            </div>

            <div className="mt-auto flex items-end justify-between pt-1">
              <div>
                {deal.originalPrice ? (
                  <p className="text-xs text-[var(--text-muted)] line-through">
                    {formatINR(deal.originalPrice)}
                  </p>
                ) : null}
                <p className="text-xl font-bold">{formatINR(deal.price)}</p>
              </div>
              <Link
                href={`/go/${deal.id}`}
                className="rounded-lg bg-[var(--color-brand-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-brand-700)]"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>

      <DataFreshness />
    </div>
  );
}