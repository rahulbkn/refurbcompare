import type { Metadata } from "next";
import { buildPageMeta, DEMO_MODE } from "@/lib/seo";

export const metadata: Metadata = buildPageMeta({
  title: "Disclaimers",
  canonicalPath: "/disclaimer",
  description:
    "RefurbCompare's disclaimers: we are an independent comparison platform, prices change, some links are affiliate links, and purchases happen with the seller.",
});

export default function DisclaimerPage() {
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <h1 className="text-2xl font-bold">Disclaimers</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Independent platform</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          RefurbCompare is an independent comparison platform and is not
          affiliated with any seller unless explicitly stated. The presence of a
          seller on this site is not an endorsement, and their offers are their
          own responsibility.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">No selling, no shipping, no payments</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          RefurbCompare never owns, sells, ships, services, refunds or
          warranties devices, and never handles payments. All transactions occur
          directly between you and the seller. RefurbCompare is not a party to
          any purchase contract.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Prices change</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Prices and availability are supplied by third-party sellers and may
          change at any time without notice. Always confirm the final price,
          stock and terms on the seller&apos;s website before completing a
          purchase.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Affiliate disclosure</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Some outbound links on RefurbCompare are affiliate links. If you buy
          through one, the seller may pay us a commission — at no extra cost to
          you. Commission arrangements never change the price shown or the way
          offers are ranked.
        </p>
      </section>

      {DEMO_MODE && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <h2 className="font-semibold">Demo mode notice</h2>
          <p className="mt-1 leading-relaxed">
            This installation runs in demo mode. All products, prices, stock and
            price history shown are synthetic sample data generated for
            demonstration purposes. No live prices are claimed, and outbound
            links point to example URLs.
          </p>
        </section>
      )}
    </div>
  );
}