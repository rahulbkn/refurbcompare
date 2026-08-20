import Link from "next/link";
import type { ListingDto } from "@/lib/repo/types";
import { formatINR } from "@/lib/format";
import AffiliateDisclosure from "./affiliate-disclosure";
import { DEMO_MODE } from "@/lib/seo";

export default function SellerOfferCard({ listing }: { listing: ListingDto }) {
  const { seller } = listing;
  if (!seller) return null;

  const isLow = listing.stockStatus === "low";
  const outOfStock = !listing.inStock;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {seller.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={seller.logoUrl}
              alt={seller.name}
              className="h-7 w-7 rounded-full object-contain"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold">
              {seller.name.charAt(0)}
            </span>
          )}
          <span className="font-semibold">{seller.name}</span>
        </div>
        {listing.offerBadge && !outOfStock && (
          <span className="rounded-full bg-[var(--color-brand-100)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-brand-700)] dark:bg-brand-900 dark:text-brand-200">
            {listing.offerBadge}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          {listing.originalPrice ? (
            <p className="text-sm text-[var(--text-muted)] line-through">
              {formatINR(listing.originalPrice)}
            </p>
          ) : null}
          <p className="text-2xl font-bold">{formatINR(listing.price)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {DEMO_MODE && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              TEST data
            </span>
          )}
          {listing.discountPct ? (
            <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600 dark:bg-red-950 dark:text-red-300">
              -{Math.round(listing.discountPct)}%
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--text-muted)]">
        {listing.condition && (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            {listing.condition}
          </span>
        )}
        {listing.storage ? (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            {listing.storage} GB
          </span>
        ) : null}
        {seller.rating ? (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
            ★ {seller.rating.toFixed(1)}
          </span>
        ) : null}
      </div>

      {isLow && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Only a few left — price may change.
        </p>
      )}

      <AffiliateDisclosure compact />

      {outOfStock ? (
        <span className="pointer-events-none inline-flex h-10 items-center justify-center rounded-xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text-muted)]">
          Out of stock
        </span>
      ) : DEMO_MODE ? (
        <span className="pointer-events-none inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          TEST data — no live redirect
        </span>
      ) : (
        <Link
          href={`/go/${listing.id}`}
          className="mt-auto inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-700)]"
        >
          Buy now
        </Link>
      )}
    </div>
  );
}
