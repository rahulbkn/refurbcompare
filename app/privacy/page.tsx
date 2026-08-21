import type { Metadata } from "next";
import { buildPageMeta } from "@/lib/seo";

export const metadata: Metadata = buildPageMeta({
  title: "Privacy Policy",
  canonicalPath: "/privacy",
  description:
    "How RefurbMeter handles your data: we store the minimum needed for price alerts, and we never sell your personal information.",
});

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-[var(--text-muted)]">Last updated: August 2026</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-[var(--text-muted)]">
          <li>
            <strong className="text-[var(--text)]">Email address</strong> — only
            when you create a price drop alert, so we can notify you.
          </li>
          <li>
            <strong className="text-[var(--text)]">Click records</strong> — when
            you follow a link to a seller, we record the listing, timestamp and
            technical metadata (user agent, referrer) for analytics and to
            prevent fraud. No personal identifiers are linked.
          </li>
          <li>
            <strong className="text-[var(--text)]">Basic usage data</strong> —
            standard server logs (IP address, pages visited) to keep the service
            running and secure.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What we never do</h2>
        <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-[var(--text-muted)]">
          <li>We never sell or rent your personal information.</li>
          <li>
            We never ask for — or store — payment details. Purchases happen on
            the seller&apos;s website.
          </li>
          <li>We don&apos;t run third-party ad trackers that follow you across sites.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Price alerts</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Alerts store the email, target price and product. You can stop receiving
          alerts by following the unsubscribe link in any alert email or by
          contacting us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cookies and local storage</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          We use your browser&apos;s local storage to remember your colour theme
          preference. We do not use cross-site tracking cookies.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your rights</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          You may request a copy or deletion of the data we hold about you at any
          time by emailing hello@refurbmeter.in.
        </p>
      </section>
    </div>
  );
}