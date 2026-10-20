import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { BasketButton, Price, ProductImage } from "@/components/StoreBits";
import { formatPence } from "@/lib/money";
import { fetchStoreProduct, useBasket, useStoreOpen } from "@/lib/store";

export const Route = createFileRoute("/store/$slug")({
  head: () => ({ meta: [{ title: "RevMate Store" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const open = useStoreOpen();
  const { add } = useBasket();
  const [image, setImage] = useState(0);
  const { data: product, isLoading } = useQuery({
    queryKey: ["store", "product", slug],
    queryFn: () => fetchStoreProduct(slug),
    retry: false,
  });

  if (isLoading) return <main className="min-h-[60vh]" />;
  if (!product || !open) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">This product isn't available.</p>
        <Link to="/store" className="mt-3 inline-block text-primary underline">
          Back to the store
        </Link>
      </main>
    );
  }
  const out = product.stock !== null && product.stock <= 0;
  const src = product.images[image];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <Link to="/store" className="text-sm text-muted-foreground hover:text-foreground">
          ← Store
        </Link>
        <BasketButton />
      </div>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        <div>
          {src ? (
            <span className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-white">
              <img src={src} alt={product.title} className="size-full object-contain" />
            </span>
          ) : (
            <ProductImage product={product} className="aspect-square rounded-3xl" />
          )}
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setImage(i)}
                  className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${i === image ? "border-primary" : "border-transparent"}`}
                >
                  <img src={img} alt="" className="size-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {product.brand && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.brand}</p>
          )}
          <h1 className="text-2xl font-extrabold leading-tight">{product.title}</h1>
          <div className="mt-2">
            <Price product={product} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Truck className="size-4 text-muted-foreground" />
              {product.delivery_pence === 0
                ? "Free UK delivery"
                : `UK delivery ${formatPence(product.delivery_pence)}`}{" "}
              · {product.delivery_estimate}
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw className="size-4 text-muted-foreground" /> 14-day returns
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" /> Secure payment by Stripe
            </li>
            {product.fits_makes.length > 0 && (
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 text-emerald-600" />
                Fits: {product.fits_makes.join(", ")}
              </li>
            )}
          </ul>
          {product.description && (
            <p className="mt-4 whitespace-pre-wrap break-words text-sm">{product.description}</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Sold by RevMate.{" "}
            <Link to="/legal/terms" className="underline">
              Delivery &amp; returns
            </Link>
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Price product={product} />
          <button
            type="button"
            disabled={out}
            onClick={() => {
              add(product.id);
              toast.success("Added to your basket", {
                action: { label: "View basket", onClick: () => window.location.assign("/basket") },
              });
            }}
            className="ml-auto min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {out ? "Out of stock" : "Add to basket"}
          </button>
        </div>
      </div>
    </main>
  );
}
