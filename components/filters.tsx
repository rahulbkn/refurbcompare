import { sortOrders, type SortOrder } from "@/lib/validation";

export type FiltersProps = {
  query?: string;
  brand?: string;
  brands: Array<{ brand: string; count: number }>;
  minPrice?: number;
  maxPrice?: number;
  sort: SortOrder;
  action?: string;
};

/**
 * Server-rendered filter form. Submitting navigates to the same route with the
 * chosen query string, keeping filtering free of client-side state.
 */
export default function Filters(props: FiltersProps) {
  const { query, brand, brands, minPrice, maxPrice, sort, action = "/phones" } = props;

  return (
    <form
      method="get"
      action={action}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      {query !== undefined && (
        <input type="hidden" name="q" value={query} />
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Brand</legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="submit"
            name="brand"
            value=""
            className={`rounded-full border px-3 py-1 text-xs ${
              !brand
                ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white"
                : "border-[var(--border)] hover:border-[var(--color-brand-500)]"
            }`}
          >
            All
          </button>
          {brands.map(({ brand: b, count }) => (
            <button
              key={b}
              type="submit"
              name="brand"
              value={b}
              className={`rounded-full border px-3 py-1 text-xs ${
                brand === b
                  ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white"
                  : "border-[var(--border)] hover:border-[var(--color-brand-500)]"
              }`}
            >
              {b} <span className="opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Price range (₹)</legend>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            name="minPrice"
            defaultValue={minPrice ?? ""}
            min={0}
            step={500}
            placeholder="Min"
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
          />
          <input
            type="number"
            name="maxPrice"
            defaultValue={maxPrice ?? ""}
            min={0}
            step={500}
            placeholder="Max"
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Sort by</legend>
        <select
          name="sort"
          defaultValue={sort}
          className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
        >
          {sortOrders.map((value) => (
            <option key={value} value={value}>
              {sortLabel(value)}
            </option>
          ))}
        </select>
      </fieldset>

      <button
        type="submit"
        className="w-full rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-700)]"
      >
        Apply filters
      </button>
    </form>
  );
}

export function sortLabel(value: SortOrder): string {
  switch (value) {
    case "price_asc":
      return "Price: low to high";
    case "price_desc":
      return "Price: high to low";
    case "discount_desc":
      return "Best discount";
    case "rating_desc":
      return "Seller rating";
    case "newest":
      return "Newest";
  }
}
