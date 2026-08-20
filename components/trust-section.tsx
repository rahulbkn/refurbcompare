import { ShieldCheck, Search, Eye, HandCoins } from "lucide-react";

const ITEMS = [
  {
    icon: Eye,
    title: "Independent",
    text: "We never sell devices ourselves — RefurbCompare is an independent comparison platform.",
  },
  {
    icon: HandCoins,
    title: "Honest referral model",
    text: "Some links are affiliate links. We may earn a commission when you buy — at no extra cost to you.",
  },
  {
    icon: Search,
    title: "One tap to compare",
    text: "Every offer from every participating seller on one page, sorted by real price.",
  },
  {
    icon: ShieldCheck,
    title: "Clarity first",
    text: "Condition and stock are shown next to each offer and we link you to the seller's own page so you can verify before you buy.",
  },
] as const;

export default function TrustSection() {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex flex-col gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-700)] dark:bg-brand-900 dark:text-brand-300">
              <item.icon size={18} />
            </span>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-[var(--text-muted)]">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}