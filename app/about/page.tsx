import type { Metadata } from "next";
import { buildPageMeta, DEMO_MODE } from "@/lib/seo";

export const metadata: Metadata = buildPageMeta({
  title: "About RefurbMeter",
  canonicalPath: "/about",
  description:
    "RefurbMeter is an independent comparison platform for refurbished smartphones in India. We never sell, ship or service devices — we compare third-party offers.",
});

export default function AboutPage() {
  return (
    <div className="container max-w-3xl space-y-8 py-10">
      <h1 className="text-2xl font-bold">About RefurbMeter</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What we do</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          RefurbMeter is an independent comparison platform for refurbished
          smartphones in India. We collect offers from multiple third-party
          sellers, normalise condition grades, and show every in-stock price on
          one page so you can pick the cheapest — or the best-value — option.
        </p>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          We are not a seller. We never own, ship, service or refund devices, and
          we never handle payment. When you buy, you buy directly from the
          seller whose offer you chose.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">How we make money</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          RefurbMeter is an independent comparison platform. We do not receive
          commissions or affiliate fees from any seller. Our operating costs are
          covered independently, and no referral arrangement changes the price
          you pay or the ranking of offers shown.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Where our data comes from</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Prices come from authorized feeds or per-listing data supplied by the
          sellers themselves — never from scraping a website without permission.
          Each provider is independently configurable and can be disabled at any
          time.
        </p>
        {DEMO_MODE && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            Demo mode: the offers currently shown are sample data generated for
            demonstration. No live prices are claimed.
          </p>
        )}
      </section>

      <section id="contact" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Questions about an offer should go to the seller — they handle orders,
          warranty and returns. For anything about this platform, email{" "}
          <a href="mailto:hello@refurbmeter.in" className="text-[var(--color-brand-700)] dark:text-brand-300 underline">
            hello@refurbmeter.in
          </a>
          .
        </p>
      </section>
    </div>
  );
}