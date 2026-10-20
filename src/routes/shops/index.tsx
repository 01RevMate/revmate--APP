import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Store } from "lucide-react";
import { fetchShops, isPromotedShop, SHOP_CATEGORIES, shopCategoryLabel } from "@/lib/shops";
import { seo } from "@/lib/seo";

type ShopSearch = { category?: string | undefined };

export const Route = createFileRoute("/shops/")({
  validateSearch: (search: Record<string, unknown>): ShopSearch =>
    typeof search["category"] === "string" && search["category"]
      ? { category: search["category"] }
      : {},
  head: () =>
    seo({
      title: "Car shops — parts, detailing, air fresheners & more — RevMate",
      description:
        "Car stuff from UK brands and small makers: parts, detailing, air fresheners, styling, wheels, tech and merch.",
      path: "/shops",
    }),
  component: ShopsPage,
});

function ShopsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shops/" });
  const {
    data: shops,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shops", "list", search.category ?? ""],
    queryFn: () => fetchShops(search.category),
    retry: false,
  });
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Store className="size-6 text-primary" /> Shops
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Car stuff from UK brands and small makers. You buy on their own website.
      </p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
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

      <ul className="mt-4 space-y-2">
        {shops?.map((s) => (
          <li key={s.id}>
            <Link
              to="/shops/$slug"
              params={{ slug: s.slug }}
              className="flex gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted/50"
            >
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="size-full object-contain" />
                ) : (
                  <Store className="size-6 text-neutral-400" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                  {s.name}
                  {isPromotedShop(s) && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Promoted
                    </span>
                  )}
                  {s.made_in_uk && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                      🇬🇧 Made in UK
                    </span>
                  )}
                </span>
                {s.tagline && (
                  <span className="block truncate text-sm text-muted-foreground">{s.tagline}</span>
                )}
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {s.categories.map(shopCategoryLabel).join(" · ")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {!isLoading && !error && shops?.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No shops here yet. Make something for cars? Be the first.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-muted-foreground">Shops aren't available yet.</p>}

      <Link
        to="/shops/new"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4"
      >
        <Plus className="size-6 shrink-0 text-primary" />
        <span className="text-sm">
          <span className="block font-semibold">List your shop free</span>
          <span className="text-muted-foreground">
            Brands, parts sellers and small makers: get a shop page in front of UK car people.
          </span>
        </span>
      </Link>
    </main>
  );
}
