import Link from "next/link";
import type { ListingDto } from "@/lib/repo/types";
import { formatINR } from "@/lib/format";
import { DEMO_MODE } from "@/lib/seo";

export default function SellerComparisonTable({
  listings,
  productName,
}: {
  listings: ListingDto[];
  productName: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <th className="p-3 font-semibold">Seller</th>
            <th className="p-3 font-semibold">Condition</th>
            <th className="p-3 font-semibold">Stock</th>
            <th className="p-3 text-right font-semibold">Price</th>
            <th className="p-3 text-right font-semibold">Change</th>
            <th className="p-3 text-right font-semibold">View</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => {
            const seller = listing.seller;
            if (!seller) return null;
            const outOfStock = !listing.inStock;
            return (
              <tr
                key={listing.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold">
                      {seller.name.charAt(0)}
                    </span>
                    <div>
                      <p className="font-medium">{seller.name}</p>
                      {seller.tagline && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {seller.tagline}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-[var(--text-muted)]">
                  {listing.condition ?? "—"}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      outOfStock
                        ? "bg-[var(--surface-2)] text-[var(--text-muted)]"
                        : listing.stockStatus === "low"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          : "bg-[var(--color-brand-100)] text-[var(--color-brand-700)] dark:bg-brand-900 dark:text-brand-200"
                    }`}
                  >
                    {outOfStock
                      ? "Out"
                      : listing.stockStatus === "low"
                        ? "Low"
                        : "In stock"}
                  </span>
                </td>
                <td className="p-3 text-right font-semibold">
                  {outOfStock ? (
                    <span className="text-[var(--text-muted)] line-through">
                      {formatINR(listing.price)}
                    </span>
                  ) : (
                    formatINR(listing.price)
                  )}
                </td>
                <td className="p-3 text-right">
                  {listing.discountPct ? (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      -{Math.round(listing.discountPct)}%
                    </span>
                  ) : (
                    <span className="text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {outOfStock ? (
                    <span className="inline-flex h-8 items-center rounded-lg bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--text-muted)]">
                      Out of stock
                    </span>
                  ) : DEMO_MODE ? (
                    <span className="inline-flex h-8 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                      TEST
                    </span>
                  ) : (
                    <Link
                      href={`/go/${listing.id}`}
                      className="inline-flex h-8 items-center rounded-lg bg-[var(--color-brand-600)] px-3 text-xs font-semibold text-white hover:bg-[var(--color-brand-700)]"
                    >
                      View
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-[var(--border)] p-3 text-xs text-[var(--text-muted)]">
        RefurbMeter compares third-party offers for {productName}. You will be
        redirected to the seller&apos;s website to complete your purchase. Prices
        and availability may change.
      </div>
    </div>
  );
}