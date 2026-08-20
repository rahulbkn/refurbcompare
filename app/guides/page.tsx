import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMeta } from "@/lib/seo";

export const metadata: Metadata = buildPageMeta({
  title: "Refurbished Phone Buying Guides",
  canonicalPath: "/guides",
  description:
    "Practical guides to buying refurbished phones in India: what the condition grades mean, how to check warranty, and how to spot a good deal.",
});

const GUIDES = [
  {
    title: "What refurbished condition grades actually mean",
    href: "/guides#condition-grades",
    summary:
      "A+, Certified, Excellent, Very Good, Good — how sellers grade used phones and what you should expect from each tier.",
  },
  {
    title: "Is a refurbished iPhone worth it in 2026?",
    href: "/guides#iphone",
    summary:
      "Battery, warranty, price drop vs a new iPhone, and which generation gives the best value on the Indian refurb market.",
  },
  {
    title: "How to check the warranty on a refurbished phone",
    href: "/guides#warranty",
    summary:
      "Seller warranty vs brand warranty, what's covered, and the questions to ask before you pay.",
  },
  {
    title: "Red flags in refurbished listings",
    href: "/guides#red-flags",
    summary:
      "Photos that don't match the grade, no warranty stated, vague returns policy — what to look out for.",
  },
] as const;

export default function GuidesPage() {
  return (
    <div className="container space-y-10 py-10">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">Refurbished phone buying guides</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          We compare offers for you, but knowing what to look for makes the
          difference between a bargain and a regret. These guides cover the
          basics for the Indian refurbished market.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold group-hover:underline">{guide.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{guide.summary}</p>
          </Link>
        ))}
      </div>

      <article id="condition-grades" className="scroll-mt-24 space-y-4">
        <h2 className="text-xl font-bold">Condition grades explained</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="p-3 font-semibold">Grade</th>
                <th className="p-3 font-semibold">Typical condition</th>
                <th className="p-3 font-semibold">Warranty</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Like New / A+", "No visible wear, 100% battery health", "Usually full"],
                ["Excellent / Certified", "Minor cosmetic wear, 90%+ battery", "Usually 6–12 months"],
                ["Very Good", "Visible but light scratches, 80%+ battery", "Varies by seller"],
                ["Good", "Clear signs of use, battery may be <80%", "Often limited"],
              ].map((row) => (
                <tr key={row[0]} className="border-b border-[var(--border)] last:border-0">
                  <td className="p-3 font-medium">{row[0]}</td>
                  <td className="p-3 text-[var(--text-muted)]">{row[1]}</td>
                  <td className="p-3 text-[var(--text-muted)]">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Grades vary between sellers. Always read the specific listing&apos;s
          condition notes, not just the label.
        </p>
      </article>

      <article id="iphone" className="scroll-mt-24 max-w-2xl space-y-3">
        <h2 className="text-xl font-bold">Is a refurbished iPhone worth it?</h2>
        <p className="text-sm leading-relaxed">
          Refurbished iPhones hold value better than almost any Android phone, so
          the savings on the device itself are the point — not resale. Look for a
          fresh battery, a warranty of at least 6 months, and iOS support
          remaining on the model year. For most buyers the sweet spot is two
          generations back from the current flagship.
        </p>
      </article>

      <article id="warranty" className="scroll-mt-24 max-w-2xl space-y-3">
        <h2 className="text-xl font-bold">Checking warranty</h2>
        <p className="text-sm leading-relaxed">
          Two warranties can exist: the brand&apos;s remaining warranty and the
          seller&apos;s own refurb warranty. Ask which one applies to the exact
          unit, how claims are handled (pickup? drop-off?), and whether cosmetic
          damage is excluded. A seller who won&apos;t put the warranty in writing
          is a red flag.
        </p>
      </article>

      <article id="red-flags" className="scroll-mt-24 max-w-2xl space-y-3">
        <h2 className="text-xl font-bold">Red flags in listings</h2>
        <ul className="list-inside list-disc space-y-1.5 text-sm leading-relaxed">
          <li>Stock photo instead of the actual unit or accurate grade photo.</li>
          <li>No warranty, return window or cancellation policy stated.</li>
          <li>Price far below every other seller — especially for &quot;new&quot;.</li>
          <li>Vague condition language (&quot;may have scratches&quot; without photos).</li>
          <li>Pressure to pay outside the platform.</li>
        </ul>
      </article>
    </div>
  );
}