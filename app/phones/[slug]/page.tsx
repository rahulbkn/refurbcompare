import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repo";
import { DEMO_MODE } from "@/lib/seo";
import { slugParamSchema } from "@/lib/validation";
import { formatINR } from "@/lib/format";
import SellerComparisonTable from "@/components/seller-comparison-table";
import PriceHistoryChart from "@/components/price-history-chart";
import PriceAlertForm from "@/components/price-alert-form";
import AffiliateDisclosure from "@/components/affiliate-disclosure";

export const dynamic = "force-dynamic";

export default async function PhonePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = slugParamSchema.parse(await params);

  const repo = await getRepository();
  const product = await repo.getProductBySlug(slug);
  if (!product) notFound();

  const [listings, best, history] = await Promise.all([
    repo.listListingsForProduct(product.id),
    repo.bestListingForProduct(product.id),
    repo.getPriceHistory(product.id, 30),
  ]);

  const inStockListings = listings.filter((l) => l.inStock);
  const bestPrice = best?.price;
  const cheapestCondition = inStockListings[0]?.condition;

  const series = groupBySeller(history);

  const attributes = [
    ...(product.storage ? [["Storage", `${product.storage} GB`]] : []),
    ...(product.ram ? [["RAM", `${product.ram} GB`]] : []),
    ...(product.color ? [["Colour", product.color]] : []),
    ...(product.condition ? [["Condition", product.condition]] : []),
    ...(product.releaseYear ? [["Released", String(product.releaseYear)]] : []),
    ...Object.entries(product.attributes ?? {}).map(([key, value]) => [
      prettyKey(key),
      String(value),
    ]),
  ];

  return (
    <div className="container space-y-8 py-8">
      {/* Product hero */}
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-700)] dark:text-brand-300">
                {product.brand}
              </p>
              <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
            </div>
            {product.imageUrl && (
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </div>

          {bestPrice !== undefined && (
            <div className="rounded-xl bg-[var(--surface-2)] p-4">
              <p className="text-xs text-[var(--text-muted)]">
                Best price across {inStockListings.length} in-stock seller
                {inStockListings.length === 1 ? "" : "s"}
              </p>
              <p className="text-3xl font-bold">{formatINR(bestPrice)}</p>
              {cheapestCondition && (
                <p className="text-xs text-[var(--text-muted)]">
                  {product.storage} GB · {cheapestCondition} condition
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {attributes.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-[var(--border)] p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  {key}
                </p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <PriceAlertForm
            productId={product.id}
            currentBestPrice={bestPrice}
          />
          <AffiliateDisclosure />
          {DEMO_MODE && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Demo mode: prices and offers are sample data generated for
              demonstration only.
            </p>
          )}
        </div>
      </section>

      {/* Seller comparison */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Compare offers</h2>
        <SellerComparisonTable listings={listings} productName={product.name} />
      </section>

      {/* Price history */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">30-day price history</h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <PriceHistoryChart series={series} />
        </div>
      </section>
    </div>
  );
}

function groupBySeller(
  history: Array<{ sellerName?: string; recordedAt: string; price: number }>,
) {
  const names = [...new Set(history.map((h) => h.sellerName ?? "Unknown"))];
  return names.map((sellerName) => ({
    sellerName,
    points: history
      .filter((h) => (h.sellerName ?? "Unknown") === sellerName)
      .map(({ recordedAt, price }) => ({ recordedAt, price })),
  }));
}

function prettyKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}