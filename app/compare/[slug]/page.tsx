import { notFound } from "next/navigation";
import { getRepository } from "@/lib/repo";
import { slugParamSchema } from "@/lib/validation";
import { rankOffers } from "@/lib/scoring";
import SellerComparisonTable from "@/components/seller-comparison-table";
import SellerOfferCard from "@/components/seller-offer-card";
import PriceHistoryChart from "@/components/price-history-chart";
import AdSlot from "@/components/adsense";
import { formatINR } from "@/lib/format";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = slugParamSchema.parse(await params);

  const repo = await getRepository();
  const product = await repo.getProductBySlug(slug);
  if (!product) notFound();

  const [rawListings, history] = await Promise.all([
    repo.listListingsForProduct(product.id),
    repo.getPriceHistory(product.id, 45),
  ]);

  const listings = rankOffers(rawListings);
  const topOffer = listings.find((l) => l.inStock);
  const inStockCount = listings.filter((l) => l.inStock).length;

  const series = [...new Set(history.map((h) => h.sellerName ?? "Unknown"))].map(
    (sellerName) => ({
      sellerName,
      points: history
        .filter((h) => (h.sellerName ?? "Unknown") === sellerName)
        .map(({ recordedAt, price }) => ({ recordedAt, price })),
    }),
  );

  return (
    <div className="container space-y-8 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Compare offers for {product.name}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {inStockCount} in-stock seller offer{inStockCount === 1 ? "" : "s"} ranked
          by overall value (price, condition, seller rating, stock).
          {topOffer ? (
            <span>
              {" "}Best pick from {topOffer.seller?.name} at {formatINR(topOffer.price)}.
            </span>
          ) : null}
        </p>
      </div>

      {topOffer && (
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gradient-to-br from-[var(--color-brand-700)] to-[var(--color-brand-900)] p-4 text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Flame size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold">Best value offer</p>
            <p className="text-xs text-white/80">
              {topOffer.seller?.name} · {formatINR(topOffer.price)}
              {topOffer.discountPct ? ` · -${Math.round(topOffer.discountPct)}%` : ""}
            </p>
          </div>
        </div>
      )}

      <SellerComparisonTable listings={listings} productName={product.name} />

      <AdSlot pname="refurbcompare-compare-1" />

      <div>
        <h2 className="mb-3 text-xl font-bold">Deal breakdown</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.slice(0, 6).map((listing) => (
            <SellerOfferCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold">45-day price history</h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <PriceHistoryChart series={series} />
        </div>
      </div>
    </div>
  );
}