import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center gap-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]">
        <SearchX size={28} />
      </span>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="max-w-md text-sm text-[var(--text-muted)]">
        We couldn&apos;t find that page. It may have moved, or the product you
        were looking for may not be tracked anymore.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-700)]"
        >
          Back to home
        </Link>
        <Link
          href="/phones"
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-brand-500)]"
        >
          Browse phones
        </Link>
      </div>
    </div>
  );
}