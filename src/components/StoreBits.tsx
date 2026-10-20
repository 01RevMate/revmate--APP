import { Link } from "@tanstack/react-router";
import { Package, ShoppingCart } from "lucide-react";
import { formatPence } from "@/lib/money";
import { useBasket, type StoreProduct } from "@/lib/store";

/** Basket button with a count, for store pages. */
export function BasketButton() {
  const { count } = useBasket();
  return (
    <Link
      to="/basket"
      aria-label={`Basket, ${count} item${count === 1 ? "" : "s"}`}
      className="relative inline-flex size-11 items-center justify-center rounded-full bg-muted"
    >
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}

export function ProductImage({
  product,
  className = "",
}: {
  product: StoreProduct;
  className?: string;
}) {
  const src = product.images[0];
  return (
    <span className={`flex items-center justify-center overflow-hidden bg-white ${className}`}>
      {src ? (
        <img src={src} alt={product.title} className="size-full object-contain" loading="lazy" />
      ) : (
        <Package className="size-10 text-neutral-300" />
      )}
    </span>
  );
}

export function Price({ product }: { product: StoreProduct }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-lg font-extrabold">{formatPence(product.price_pence)}</span>
      {product.was_price_pence && product.was_price_pence > product.price_pence && (
        <span className="text-xs text-muted-foreground line-through">
          {formatPence(product.was_price_pence)}
        </span>
      )}
    </span>
  );
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const out = product.stock !== null && product.stock <= 0;
  return (
    <Link
      to="/store/$slug"
      params={{ slug: product.slug }}
      className="block overflow-hidden rounded-2xl border border-border bg-card hover:bg-muted/40"
    >
      <ProductImage product={product} className="aspect-square" />
      <span className="block p-3">
        {product.brand && (
          <span className="block truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </span>
        )}
        <span className="line-clamp-2 text-sm font-medium">{product.title}</span>
        <Price product={product} />
        <span className="block text-[11px] text-muted-foreground">
          {out
            ? "Out of stock"
            : product.delivery_pence === 0
              ? `Free delivery · ${product.delivery_estimate}`
              : `Delivery ${formatPence(product.delivery_pence)} · ${product.delivery_estimate}`}
        </span>
      </span>
    </Link>
  );
}
