import type { Metadata } from "next";
import { getRepository } from "@/lib/repo";
import { buildPageMeta } from "@/lib/seo";
import { searchQuerySchema } from "@/lib/validation";
import ProductGrid from "@/components/product-grid";
import EmptyState from "@/components/empty-state";
import type { ProductDto } from "@/lib/repo/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const parsed = searchQuerySchema.safeParse(params);
  const q = parsed.success ? parsed.data.q : "refurbished phones";
  return buildPageMeta({
    title: `Search: ${q}`,
    description: `Refurbished smartphone prices matching "${q}" across third-party sellers in India.`,
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = searchQuerySchema.safeParse(params);

  let products: Array<ProductDto & { bestPrice?: number }> = [];
  let q = "";
  if (parsed.success) {
    q = parsed.data.q;
    const repo = await getRepository();
    products = await repo.listProducts({ query: q, limit: 30 });
  }

  return (
    <div className="container space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">
          {q ? `Results for "${q}"` : "Search"}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {q ? `Meaningful matches for "${q}".` : "Type a phone name to search."}
        </p>
      </div>

      {q ? (
        <ProductGrid
          products={products}
          emptyTitle={`No matches for "${q}"`}
          emptyMessage="Try a different brand, model or storage size — e.g. “iPhone 13”, “Galaxy S24”, “Pixel 7”."
        />
      ) : (
        <EmptyState
          title="Enter a search term"
          message="Search for a brand, model or phone name to compare refurbished prices."
        />
      )}
    </div>
  );
}