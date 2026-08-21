"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingDto } from "@/lib/repo/types";
import { formatINR } from "@/lib/format";
import { buildComparisonGroups } from "@/lib/comparison";
import { DEMO_MODE } from "@/lib/seo";

const INITIAL_GROUPS = 4;

function BuyButton({ listingId }: { listingId: string }) {
  if (DEMO_MODE) {
    return (
      <span className="inline-flex h-8 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
        TEST
      </span>
    );
  }
  return (
    <Link
      href={`/go/${listingId}`}
      className="inline-flex h-8 items-center rounded-lg bg-[var(--color-brand-600)] px-3 text-xs font-semibold text-white hover:bg-[var(--color-brand-700)]"
    >
      View
    </Link>
  );
}

/**
 * Condition-grouped offer comparison.
 *
 * ONE ROW = ONE CONDITION: each row shows every provider's cheapest live
 * in-stock listing for that condition (exact listing id preserved in the Buy
 * link); providers without an offer show "—". Desktop renders a comparison
 * table, mobile renders compact per-condition cards.
 */
export default function SellerComparisonTable({
  listings,
  productName,
}: {
  listings: ListingDto[];
  productName: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const { groups, sellers } = buildComparisonGroups(listings);
  const visibleGroups = showAll ? groups : groups.slice(0, INITIAL_GROUPS);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
        No live offers available for {productName} right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop: comparison table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className="p-3 font-semibold">Condition</th>
              {sellers.map((seller) => (
                <th key={seller} className="p-3 text-right font-semibold">
                  {seller}
                </th>
              ))}
              <th className="p-3 text-right font-semibold">Best</th>
              <th className="p-3 text-right font-semibold">Buy</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map((group) => {
              const bySeller = new Map(group.offers.map((o) => [o.sellerName, o]));
              return (
                <tr key={group.condition} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 font-medium">{group.condition}</td>
                  {sellers.map((seller) => {
                    const offer = bySeller.get(seller);
                    return (
                      <td key={seller} className="p-3 text-right">
                        {offer ? formatINR(offer.price) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right font-bold text-[var(--color-brand-700)] dark:text-brand-300">
                    {group.best ? formatINR(group.best.price) : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {group.best ? <BuyButton listingId={group.best.listingId} /> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-[var(--border)] p-3 text-xs text-[var(--text-muted)]">
          Cheapest live in-stock offer per seller and condition. You will be
          redirected to the seller&apos;s website to complete your purchase.
          Prices and availability may change.
        </div>
      </div>

      {/* Mobile: compact condition cards */}
      <div className="space-y-3 md:hidden">
        {visibleGroups.map((group) => (
          <div
            key={group.condition}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold">{group.condition}</h4>
              {group.best && (
                <p className="text-lg font-bold text-[var(--color-brand-700)] dark:text-brand-300">
                  {formatINR(group.best.price)}
                </p>
              )}
            </div>
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {group.offers.map((offer) => (
                <li key={offer.listingId} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-[var(--text-muted)]">{offer.sellerName}</span>
                  <span className="font-semibold">{formatINR(offer.price)}</span>
                </li>
              ))}
            </ul>
            {group.best && (
              <div className="mt-3">
                <BuyButton listingId={group.best.listingId} />
              </div>
            )}
          </div>
        ))}
      </div>

      {groups.length > INITIAL_GROUPS && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-semibold text-[var(--color-brand-700)] hover:bg-[var(--surface-2)] dark:text-brand-300"
        >
          Show more ({groups.length - INITIAL_GROUPS} more conditions)
        </button>
      )}
    </div>
  );
}
