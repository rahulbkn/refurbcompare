import type { Metadata } from "next";
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
    "Browse every refurbished smartphone RefurbCompare tracks across third-party sellers, filtered by brand and price, sorted by price.",
});

export const dynamic = "force-dynamic";

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

  const repo = await getRepository();
  const [products, brands, total] = await Promise.all([
    repo.listProducts({
      query: filter.q,
      brand: filter.brand,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      sort: filter.sort,
      limit: 60,
    }),
    repo.brandCounts(),
    repo.countProducts({ brand: filter.brand }),
  ]);

  return (
    <div className="container space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">All refurbished phones</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {total} product{total === 1 ? "" : "s"} · prices are the cheapest
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
          <DataFreshness />
        </div>
      </div>
    </div>
  );
}