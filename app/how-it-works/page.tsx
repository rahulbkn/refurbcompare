import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMeta } from "@/lib/seo";

export const metadata: Metadata = buildPageMeta({
  title: "How It Works",
  canonicalPath: "/how-it-works",
  description:
    "How RefurbMeter works: we compare third-party refurbished phone offers, you choose, and we redirect you to the seller to complete your purchase.",
});

const STEPS = [
  {
    title: "We collect seller offers",
    text: "Authorized feeds from each partner seller give us their refurbished listings: price, condition, stock and warranty. No scraping without permission, ever.",
  },
  {
    title: "We normalise and compare",
    text: "Condition grades are mapped to a common scale and every offer for a phone is listed side by side, sorted by price or by an overall value score.",
  },
  {
    title: "You choose an offer",
    text: "Pick the cheapest, the best value, or the seller you trust most. The comparison page shows all of them before you decide.",
  },
  {
    title: "We redirect you to the seller",
    text: "Clicking a buy button takes you to the seller's own website — marked with referral tags so the seller knows we sent you. We never handle payment.",
  },
  {
    title: "The seller handles the rest",
    text: "Order, warranty, shipping and returns are between you and the seller. If something's wrong, contact them directly.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="container max-w-3xl space-y-8 py-10">
      <h1 className="text-2xl font-bold">How it works</h1>

      <ol className="space-y-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-sm font-bold text-white">
              {index + 1}
            </span>
            <div>
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-semibold">The important part</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
          RefurbMeter never owns or sells devices. Every purchase happens on
          the seller&apos;s website. We do not receive commissions or referral
          fees from any seller — no arrangement changes the price you pay.{" "}
          <Link href="/disclaimer" className="text-[var(--color-brand-700)] dark:text-brand-300 underline">
            Read the full disclaimer
          </Link>
          .
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          We do not claim live availability or live pricing unless an
          authorized source is configured. Prices, stock and condition grades
          shown here are as last reported by each seller and can change before
          you check out.
        </p>
      </div>
    </div>
  );
}