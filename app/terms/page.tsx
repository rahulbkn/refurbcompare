import type { Metadata } from "next";
import { buildPageMeta } from "@/lib/seo";

export const metadata: Metadata = buildPageMeta({
  title: "Terms of Use",
  canonicalPath: "/terms",
  description:
    "The terms governing your use of RefurbCompare, an independent refurbished phone comparison platform.",
});

export default function TermsPage() {
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <h1 className="text-2xl font-bold">Terms of Use</h1>
      <p className="text-sm text-[var(--text-muted)]">Last updated: August 2026</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. What RefurbCompare is</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          RefurbCompare is an independent comparison platform. It displays offers
          from third-party sellers. It is not a party to any purchase, and it
          never handles payment, shipping, returns or warranty claims.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. Purchases are with the seller</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          When you buy a product through a link on this site, your contract is
          with the seller, not with RefurbCompare. Prices, availability, warranty
          and returns are governed by the seller&apos;s terms, and may change
          after we display them.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. Information accuracy</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          We work from feeds supplied by sellers, but we cannot guarantee that
          prices, stock or condition descriptions are always current or error
          free. Always confirm the final price and terms on the seller&apos;s
          website before buying.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. Affiliate links</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Some links are affiliate links. RefurbCompare may receive a commission
          if you purchase through them, at no additional cost to you. Commission
          never affects the ranking or price shown.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. Acceptable use</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          You may not scrape, bulk-harvest, or systematically re-publish this
          site&apos;s data without permission, or use the service to misrepresent
          prices or sellers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. Limitation of liability</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          To the fullest extent permitted by law, RefurbCompare is not liable for
          losses arising from your purchase or use of products listed on this
          site, or from reliance on the information displayed.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. Changes</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          We may update these terms from time to time. Continued use of the
          service after changes means you accept the updated terms.
        </p>
      </section>
    </div>
  );
}