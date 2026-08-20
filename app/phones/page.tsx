import type { Metadata } from "next";
import Link from "next/link";
import { getRepository } from "@/lib/repo";
import { buildPageMeta } from "@/lib/seo";
import { productQuerySchema } from "@/lib/validation";
import Filters from "@/components/filters";
import ProductGrid from "@/components/product-grid";
import DataFreshness from "@/components/data-freshness";

export const metadata: Metadata = buildPageMeta({
  title: "All Refurbished Phones",
  canonicalPath: "/phones",
  description:
    "Browse every refurbished smartphone RefurbMeter tracks across third-party sellers, filtered by brand and price, sorted by price.",
});

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

function parseSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  return productQuerySchema.safeParse(searchParams);
}

export default async function PhonesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = parseSearchParams(params);
  const filter = parsed.success
    ? parsed.data
    : productQuerySchema.parse({});

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = PAGE_SIZE;

  const repo = await getRepository();
  const [products, brands, total] = await Promise.all([
    repo.listProducts({
      query: filter.q,
      brand: filter.brand,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      sort: filter.sort,
      page,
      pageSize,
    }),
    repo.brandCounts(),
    repo.countProducts({ brand: filter.brand }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">All refurbished phones</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {total} product{total === 1 ? "" : "s"} &middot; prices are the cheapest
          in-stock offer across sellers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Filters
            query={filter.q}
            brand={filter.brand}
            brands={brands}
            minPrice={filter.minPrice}
            maxPrice={filter.maxPrice}
            sort={filter.sort}
          />
        </aside>

        <div className="space-y-4">
          <ProductGrid products={products} />
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-4">
              {page > 1 && (
                <Link
                  href={`/phones?${new URLSearchParams({
                    ...(filter.q ? { q: filter.q } : {}),
                    ...(filter.brand ? { brand: filter.brand } : {}),
                    ...(filter.minPrice != null ? { minPrice: String(filter.minPrice) } : {}),
                    ...(filter.maxPrice != null ? { maxPrice: String(filter.maxPrice) } : {}),
                    sort: filter.sort,
                    page: String(page - 1),
                  })}`}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-[var(--text-muted)]">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/phones?${new URLSearchParams({
                    ...(filter.q ? { q: filter.q } : {}),
                    ...(filter.brand ? { brand: filter.brand } : {}),
                    ...(filter.minPrice != null ? { minPrice: String(filter.minPrice) } : {}),
                    ...(filter.maxPrice != null ? { maxPrice: String(filter.maxPrice) } : {}),
                    sort: filter.sort,
                    page: String(page + 1),
                  })}`}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
          <DataFreshness />
        </div>
      </div>
    </div>
  );
}
