import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repo";
import { slugParamSchema } from "@/lib/validation";
import PriceHistoryChart from "@/components/price-history-chart";
import PriceAlertForm from "@/components/price-alert-form";
import { formatINR } from "@/lib/format";
import DataFreshness from "@/components/data-freshness";

export const dynamic = "force-dynamic";

export default async function PriceHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = slugParamSchema.parse(await params);

  const repo = await getRepository();
  const product = await repo.getProductBySlug(slug);
  if (!product) notFound();

  const [history, best] = await Promise.all([
    repo.getPriceHistory(product.id, 45),
    repo.bestListingForProduct(product.id),
  ]);

  const series = [...new Set(history.map((h) => h.sellerName ?? "Unknown"))].map(
    (sellerName) => ({
      sellerName,
      points: history
        .filter((h) => (h.sellerName ?? "Unknown") === sellerName)
        .map(({ recordedAt, price }) => ({ recordedAt, price })),
    }),
  );

  const allPrices = history.map((h) => h.price);
  const lowest = allPrices.length ? Math.min(...allPrices) : null;

  return (
    <div className="container space-y-8 py-10">
      <div>
        <h1 className="text-2xl font-bold">{product.name} — price history</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          45 days of per-seller prices.
          {lowest !== null ? ` Lowest recorded: ${formatINR(lowest)}.` : ""}{" "}
          {best ? (
            <span>
              Current best: {best.seller?.name} at {formatINR(best.price)}.
            </span>
          ) : null}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <PriceHistoryChart series={series} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-2 font-semibold">How to read this chart</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-muted)]">
            <li>Each line is one seller&apos;s listed refurbished price over time.</li>
            <li>Lines are drawn from each seller&apos;s sampled price history.</li>
            <li>Prices are in Indian rupees (INR), whole amounts.</li>
            <li>
              In demo mode these are synthetic trends generated for
              demonstration only.
            </li>
          </ul>
        </div>
        <PriceAlertForm productId={product.id} currentBestPrice={best?.price} />
      </div>

      <DataFreshness />
    </div>
  );
}