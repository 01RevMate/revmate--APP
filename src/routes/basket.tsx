import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { ProductImage } from "@/components/StoreBits";
import { formatPence, useMoneySettings } from "@/lib/money";
import { fetchStoreProductsByIds, startStoreCheckout, useBasket, useStoreOpen } from "@/lib/store";

export const Route = createFileRoute("/basket")({
  head: () => ({
    meta: [{ title: "Basket — RevMate Store" }, { name: "robots", content: "noindex" }],
  }),
  component: BasketPage,
});

function BasketPage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const open = useStoreOpen();
  const settings = useMoneySettings();
  const { lines, setQty } = useBasket();
  const [busy, setBusy] = useState(false);
  const ids = lines.map((l) => l.product_id);
  const { data: products } = useQuery({
    queryKey: ["store", "basket", ids.join(",")],
    queryFn: () => fetchStoreProductsByIds(ids),
    enabled: ids.length > 0,
  });

  const rows = lines
    .map((l) => ({ line: l, product: products?.find((p) => p.id === l.product_id) }))
    .filter((r) => r.product && r.product.active);
  const subtotal = rows.reduce((n, r) => n + r.product!.price_pence * r.line.qty, 0);
  const freeOver = settings?.store_free_delivery_over ?? 0;
  const delivery =
    freeOver > 0 && subtotal >= freeOver
      ? 0
      : rows.reduce((max, r) => Math.max(max, r.product!.delivery_pence), 0);

  async function checkout() {
    if (!user) {
      openAuthModal("Create a free account to check out.");
      return;
    }
    setBusy(true);
    try {
      await startStoreCheckout(rows.map((r) => r.line));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start checkout");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <ShoppingCart className="size-6" /> Basket
      </h1>
      {rows.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">Your basket is empty.</p>
          <Link to="/store" className="mt-3 inline-block text-primary underline">
            Browse the store
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {rows.map(({ line, product }) => (
              <li key={line.product_id} className="flex gap-3 p-3">
                <ProductImage product={product!} className="size-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/store/$slug"
                    params={{ slug: product!.slug }}
                    className="line-clamp-2 text-sm font-medium hover:underline"
                  >
                    {product!.title}
                  </Link>
                  <p className="font-bold">{formatPence(product!.price_pence * line.qty)}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="One fewer"
                      onClick={() => setQty(line.product_id, line.qty - 1)}
                      className="rounded-full bg-muted p-1.5"
                    >
                      {line.qty === 1 ? (
                        <Trash2 className="size-3.5" />
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">{line.qty}</span>
                    <button
                      type="button"
                      aria-label="One more"
                      disabled={line.qty >= 10}
                      onClick={() => setQty(line.product_id, line.qty + 1)}
                      className="rounded-full bg-muted p-1.5 disabled:opacity-50"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatPence(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>UK delivery</dt>
              <dd className="tabular-nums">{delivery === 0 ? "Free" : formatPence(delivery)}</dd>
            </div>
            {freeOver > 0 && subtotal < freeOver && (
              <p className="text-xs text-muted-foreground">
                Spend {formatPence(freeOver - subtotal)} more for free delivery.
              </p>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPence(subtotal + delivery)}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void checkout()}
            disabled={busy || !open}
            className="mt-4 min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
          >
            {!open ? "The store is closed right now" : busy ? "Opening…" : "Checkout securely"}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            You'll add your delivery address on the next page. Payment by Stripe.
          </p>
        </>
      )}
    </main>
  );
}
