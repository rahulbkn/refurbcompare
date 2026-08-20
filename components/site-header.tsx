import Link from "next/link";
import ThemeToggle from "./theme-toggle";
import SearchBar from "./search-bar";
import { DEMO_MODE } from "@/lib/seo";

const NAV = [
  ["Phones", "/phones"],
  ["Deals", "/deals"],
  ["Guides", "/guides"],
] as const;

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-[var(--bg)]/90 backdrop-blur">
      {DEMO_MODE && (
        <div className="bg-amber-100 py-1 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Demo mode — listings are sample data, not live offers.
        </div>
      )}
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] font-black text-white">
            R
          </span>
          <span className="text-lg font-bold tracking-tight">
            Refurb<span className="text-[var(--color-brand-600)]">Compare</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--text-muted)] md:flex">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} className="transition-colors hover:text-[var(--text)]">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SearchBar />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
