import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingBag, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BasketButton, ProductCard } from "@/components/StoreBits";
import { fetchGarage } from "@/lib/garage";
import { formatPence, useMoneySettings } from "@/lib/money";
import { SHOP_CATEGORIES } from "@/lib/shops";
import { useStoreOpen, useStoreProducts } from "@/lib/store";
import { seo } from "@/lib/seo";

type StoreSearch = { category?: string | undefined };

export const Route = createFileRoute("/store/")({
  validateSearch: (search: Record<string, unknown>): StoreSearch =>
    typeof search["category"] === "string" && search["category"]
      ? { category: search["category"] }
      : {},
  head: () =>
    seo({
      title: "RevMate Store — car parts, detailing & accessories delivered",
      description:
        "Car care, air fresheners, parts and accessories delivered to your door across the UK.",
      path: "/store",
    }),
  component: StorePage,
});

function StorePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/store/" });
  const open = useStoreOpen();
  const settings = useMoneySettings();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [fitsMine, setFitsMine] = useState(false);
  const { data: products, isLoading } = useStoreProducts(search.category);
  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });
  const myMakes = new Set(
    (garage ?? [])
      .filter((c) => c.ownership_status !== "previous")
      .map((c) => c.make.trim().toLowerCase()),
  );

  if (!open) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-bold">The RevMate Store isn't open yet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          In the meantime, browse independent car shops.
        </p>
        <a href="/shops" className="mt-4 inline-block text-primary underline">
          Browse shops
        </a>
      </main>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = (products ?? []).filter(
    (p) =>
      (!q || `${p.title} ${p.brand}`.toLowerCase().includes(q)) &&
      (!fitsMine ||
        p.fits_makes.length === 0 ||
        p.fits_makes.some((m) => myMakes.has(m.trim().toLowerCase()))),
  );
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">RevMate Store</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Truck className="size-4" /> Delivered across the UK
            {settings?.store_free_delivery_over
              ? ` · free over ${formatPence(settings.store_free_delivery_over)}`
              : ""}
          </p>
        </div>
        <BasketButton />
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-input bg-background px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the store"
          className="min-h-11 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
        {myMakes.size > 0 && (
          <button type="button" className={chip(fitsMine)} onClick={() => setFitsMine((v) => !v)}>
            🚗 Fits my car
          </button>
        )}
        <button
          type="button"
          className={chip(!search.category)}
          onClick={() => void navigate({ search: {}, replace: true })}
        >
          All
        </button>
        {SHOP_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={chip(search.category === c.id)}
            onClick={() => void navigate({ search: { category: c.id }, replace: true })}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {!isLoading && shown.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>
      )}
    </main>
  );
}
