import ProductCard, { type ProductCardProduct } from "./product-card";
import EmptyState from "./empty-state";

export default function ProductGrid({
  products,
  emptyTitle,
  emptyMessage,
}: {
  products: ProductCardProduct[];
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? "No phones match your filters"}
        message={
          emptyMessage ??
          "Try removing a filter or search for a different phone to see more results."
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
