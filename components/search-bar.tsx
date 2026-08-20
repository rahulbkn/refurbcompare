"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="relative w-full max-w-xs"
      aria-label="Search refurbished phones"
    >
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search iPhone 13, Galaxy S24…"
        aria-label="Search"
        className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-brand-500)]"
      />
    </form>
  );
}
