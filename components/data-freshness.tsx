import { timeAgo } from "@/lib/format";

export default function DataFreshness({ since }: { since?: string | null }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-brand-400)] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-brand-500)]" />
      </span>
      {since
        ? `Prices refreshed ${timeAgo(since)}`
        : "Prices are supplied by third-party sellers and may change at any time."}
    </p>
  );
}